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
import { add, decimal, formatMoney, gte, isPositive, subtract, toMinor, type Decimal } from '@/lib/money'
import { adjustAllocationFor, issueWithFailover, PROVIDER_LABELS, providerOf } from '@/lib/card-provider'
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

    // Walks the configured issuer order, so the primary being down moves the
    // request to the secondary rather than costing the user their card.
    const outcome = await issueWithFailover({
        amount,
        currency: input.currency,
        billingName,
        email: user.email,
        reference,
    })

    const provider = outcome.provider
    const warning = outcome.warning
    const issued = outcome.card

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
        metadata: { provider, reference, action: 'ISSUE', attempts: outcome.attempts },
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

    // Keep the issuer's view of the card in step with ours where possible.
    // Failing here is not fatal: the local allocation is the source of truth for
    // authorisation, so the limit still moves and the mismatch is surfaced.
    const cardProvider = providerOf(existing)
    if (cardProvider !== 'sandbox') {
        const reference = `swp_fund_${randomUUID().replace(/-/g, '').slice(0, 20)}`
        try {
            await adjustAllocationFor(existing, {
                delta,
                newTotal: add(existing.card_spending_limit, delta),
                currency: input.currency,
                reference,
            })
        } catch (error) {
            console.error(`[cards] ${cardProvider} funding call failed`, error)
            const label = PROVIDER_LABELS[cardProvider]
            warning =
                error instanceof Error
                    ? `${label} reported: ${error.message}. Your local limit was still updated.`
                    : `${label} was unreachable. Your local limit was still updated.`
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
