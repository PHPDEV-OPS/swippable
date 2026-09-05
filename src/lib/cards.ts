import { randomUUID } from 'crypto'
import {
    adjustCardAllocation,
    getCardForUser,
    insertCardIfFunded,
    pushNotification,
    recordTransaction,
    type UserRow,
} from '@/lib/db'
import { conflict, HttpError } from '@/lib/http'
import { decimal, formatMoney, gte, isPositive, subtract, toMinor, type Decimal } from '@/lib/money'
import {
    createVirtualCard,
    FlutterwaveError,
    flutterwaveMode,
    fundVirtualCard,
    isFlutterwaveConfigured,
    withdrawFromVirtualCard,
} from '@/lib/flutterwave'
import { serializeCard } from '@/lib/serialize'
import type { VirtualCard } from '@/types/api'

/**
 * Card issuing and funding.
 *
 * The wallet is the single source of truth: a card never holds money of its
 * own, it holds an *allocation* against the shared balance. Issuing or funding
 * therefore only ever reserves capital, and the database guard rejects any
 * reservation the wallet cannot back.
 */

const DEFAULT_COLOR = 'from-[#6330cf] via-[#824fed] to-[#5b2bd0]'

export interface IssueResult {
    card: VirtualCard
    provider: string
    /** Set when the provider was unavailable and a sandbox card was issued. */
    warning?: string
}

function sandboxCard(reference: string) {
    // Deterministic, obviously-fake identifiers. No PAN is generated or stored.
    const last4 = String(Math.floor(1000 + Math.random() * 9000))
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 3)

    return {
        id: `sbx_${reference}`,
        last4,
        maskedPan: `**** **** **** ${last4}`,
        expiryMonth: String(expiry.getMonth() + 1).padStart(2, '0'),
        expiryYear: String(expiry.getFullYear()).slice(-2),
        brand: 'MASTERCARD',
    }
}

export async function issueCard(
    user: UserRow,
    input: { amount: Decimal | number; currency: string; holder?: string; color?: string; type?: string }
): Promise<IssueResult> {
    const amount = decimal(input.amount)

    if (!isPositive(amount)) {
        throw new HttpError(400, 'Funding amount must be greater than zero', 'INVALID_AMOUNT')
    }

    // Cheap pre-flight so an obviously underfunded request never reaches the
    // provider. The authoritative check runs inside insertCardIfFunded.
    if (!gte(user.wallet_balance, amount)) {
        throw new HttpError(
            402,
            `Insufficient wallet balance. You have ${formatMoney(user.wallet_balance)} available.`,
            'INSUFFICIENT_FUNDS'
        )
    }

    const reference = `swp_card_${randomUUID().replace(/-/g, '').slice(0, 20)}`
    const billingName = (input.holder || user.name || 'Swippable Cardholder').trim()

    let provider = flutterwaveMode() === 'unconfigured' ? 'sandbox' : 'flutterwave'
    let warning: string | undefined
    let issued = sandboxCard(reference)

    if (isFlutterwaveConfigured()) {
        try {
            const card = await createVirtualCard({
                amount,
                currency: input.currency,
                billingName,
                email: user.email,
                reference,
            })
            issued = {
                id: card.id,
                last4: card.last4,
                maskedPan: card.maskedPan,
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear,
                brand: card.brand,
            }
        } catch (error) {
            // The provider being down must not cost the user their card: fall
            // back to a sandbox card and say so, rather than failing silently.
            console.error('[cards] Flutterwave issuance failed, issuing sandbox card', error)
            provider = 'sandbox'
            warning =
                error instanceof FlutterwaveError
                    ? `Flutterwave declined the request (${error.message}). A sandbox card was issued instead.`
                    : 'Flutterwave was unreachable. A sandbox card was issued instead.'
        }
    } else {
        warning = 'Flutterwave credentials are not configured; a sandbox card was issued.'
    }

    const row = await insertCardIfFunded({
        userId: user.id,
        cardId: reference,
        flutterwaveCardId: issued.id || null,
        provider,
        brand: issued.brand,
        maskedPan: issued.maskedPan,
        last4: issued.last4,
        holder: billingName,
        billingName,
        expiry: `${issued.expiryMonth}/${issued.expiryYear}`,
        type: input.type || 'Virtual',
        color: input.color || DEFAULT_COLOR,
        currency: input.currency,
        limit: amount,
    })

    if (!row) {
        // Another request allocated the same capital first.
        conflict(
            'Your wallet balance is already fully allocated to existing cards. Top up or reduce another card limit first.',
            'INSUFFICIENT_UNALLOCATED'
        )
    }

    await recordTransaction({
        txId: `${reference}_alloc`,
        userId: user.id,
        cardId: row.card_id,
        amount,
        currency: input.currency,
        type: 'DEBIT',
        channel: 'CARD_FUNDING',
        status: 'SUCCESS',
        merchant: `Card allocation • ${issued.last4}`,
        category: 'Card Funding',
        metadata: { provider, reference, action: 'ISSUE' },
    })

    await pushNotification(
        user.id,
        'Virtual card issued',
        `Card •••• ${issued.last4} is active with a ${formatMoney(amount, input.currency)} limit.`,
        'SUCCESS'
    )

    return { card: serializeCard({ ...row, transaction_count: 0 }), provider, warning }
}

export interface FundResult {
    card: VirtualCard
    warning?: string
}

/**
 * Moves capital between the wallet and an existing card's allocation.
 * `delta` is positive to fund the card, negative to release capital back.
 */
export async function adjustCardFunding(
    user: UserRow,
    input: { cardId: string; delta: Decimal | number; currency: string }
): Promise<FundResult> {
    const delta = decimal(input.delta)

    if (toMinor(delta) === 0n) {
        throw new HttpError(400, 'Amount must be non-zero', 'INVALID_AMOUNT')
    }

    const existing = await getCardForUser(user.id, input.cardId)
    if (!existing) {
        throw new HttpError(404, 'Card not found', 'CARD_NOT_FOUND')
    }

    const funding = toMinor(delta) > 0n

    if (funding && !gte(user.wallet_balance, delta)) {
        throw new HttpError(
            402,
            `Insufficient wallet balance. You have ${formatMoney(user.wallet_balance)} available.`,
            'INSUFFICIENT_FUNDS'
        )
    }

    let warning: string | undefined

    // Keep the provider's view of the card in step with ours where possible.
    if (isFlutterwaveConfigured() && existing.flutterwave_card_id && existing.provider === 'flutterwave') {
        const reference = `swp_fund_${randomUUID().replace(/-/g, '').slice(0, 20)}`
        const magnitude = funding ? delta : decimal(subtract('0', delta))
        try {
            if (funding) {
                await fundVirtualCard({
                    cardId: existing.flutterwave_card_id,
                    amount: magnitude,
                    currency: input.currency,
                    reference,
                })
            } else {
                await withdrawFromVirtualCard({
                    cardId: existing.flutterwave_card_id,
                    amount: magnitude,
                    reference,
                })
            }
        } catch (error) {
            console.error('[cards] Flutterwave funding call failed', error)
            warning =
                error instanceof FlutterwaveError
                    ? `Flutterwave reported: ${error.message}. Your local limit was still updated.`
                    : 'Flutterwave was unreachable. Your local limit was still updated.'
        }
    }

    const row = await adjustCardAllocation({ userId: user.id, cardId: input.cardId, delta })

    if (!row) {
        conflict(
            funding
                ? 'That amount exceeds the wallet balance not already allocated to your other cards.'
                : 'You cannot release more than the card has left unspent.',
            'ALLOCATION_REJECTED'
        )
    }

    await recordTransaction({
        txId: `swp_alloc_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
        userId: user.id,
        cardId: row.card_id,
        amount: funding ? delta : decimal(subtract('0', delta)),
        currency: input.currency,
        type: funding ? 'DEBIT' : 'CREDIT',
        channel: 'CARD_FUNDING',
        status: 'SUCCESS',
        merchant: `${funding ? 'Card funding' : 'Card withdrawal'} • ${row.last_4 ?? ''}`.trim(),
        category: 'Card Funding',
        metadata: { action: funding ? 'FUND' : 'WITHDRAW', delta },
    })

    return { card: serializeCard(row), warning }
}
