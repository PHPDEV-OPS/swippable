import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { findAdminCard, recordDecline } from '@/lib/admin-db'
import { requireUser } from '@/lib/auth'
import { evaluateAuthorisation, isExpired } from '@/lib/card-authorisation'
import { authoriseCardDebit, findUserById, getCardsByUserId, pushNotification, recordTransaction } from '@/lib/db'
import { diagnose } from '@/lib/decline'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney, isPositive, subtract } from '@/lib/money'
import type { CheckoutRequest, CheckoutResponse } from '@/types/checkout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The test merchant checkout.
 *
 * This is a real charge, not a mock. It resolves the presented card, runs the
 * shared authorisation checklist (`evaluateAuthorisation` - the very same one
 * the simulation lab runs), and on approval hands off to `authoriseCardDebit`,
 * the single guarded statement the live Flutterwave webhook uses. So a payment
 * made here debits the wallet, advances the card's spend counter and writes the
 * ledger row exactly as production does, and a decline here carries the same
 * processor code and diagnosis the command center would show.
 *
 * Scope is the safety boundary: a signed-in user can only charge *their own*
 * cards. Superadmins may charge any card, which is a power they already hold
 * through the simulator. Without that rule this endpoint would let anyone drain
 * any card they could guess four digits of.
 */
export const POST = withRouteErrors('checkout', async (request: Request) => {
    const user = await requireUser()
    const body = await readJson<CheckoutRequest>(request)

    const amount = decimal(body.amount)
    if (!isPositive(amount)) badRequest('Enter an amount greater than zero', 'INVALID_AMOUNT')

    const digits = String(body.cardNumber ?? '').replace(/\D/g, '')
    if (digits.length < 4) badRequest('Enter the card number', 'INVALID_CARD_NUMBER')
    const last4 = digits.slice(-4)

    const merchant = body.merchant?.trim() || 'Swippable Test Store'
    const merchantCountry = (body.merchantCountry ?? 'KE').toUpperCase()
    const currency = (body.currency ?? 'USD').toUpperCase()

    // Resolve the card, scoped to what this caller is allowed to charge.
    const admin = await getAdminSession()
    const card = admin
        ? await findAdminCard(last4)
        : (await getCardsByUserId(user.id)).find((row) => row.last_4 === last4)

    if (!card) {
        // Deliberately vague: confirming which four digits exist would turn this
        // into a card-enumeration oracle.
        notFound('No card on this account matches that number')
    }

    // Both lookups can return a card the caller does not own, so re-check.
    if (!admin && Number(card.user_id) !== user.id) {
        notFound('No card on this account matches that number')
    }

    const owner = await findUserById(Number(card.user_id))
    if (!owner) notFound('The cardholder account could not be loaded')

    const presentedExpiry = body.expiry?.trim() || null
    // The expiry typed at checkout must match the card, before the issuer even
    // looks at whether the card itself has expired.
    if (presentedExpiry && normaliseExpiry(presentedExpiry) !== normaliseExpiry(card.expiry_date ?? '')) {
        return declined({
            code: 'EXPIRED_CARD',
            detail: 'The expiry date entered does not match this card',
            card,
            owner,
            amount,
            currency,
            merchant,
            merchantCountry,
            trace: [
                { step: 'Card lookup', status: 'PASS', detail: `Matched card •••• ${last4}` },
                { step: 'Expiry', status: 'FAIL', detail: 'Entered expiry does not match the card on file' },
            ],
        })
    }

    const decision = await evaluateAuthorisation(
        {
            cardStatus: String(card.status),
            cardSpendingLimit: decimal(card.card_spending_limit),
            totalSpentByCard: decimal(card.total_spent_by_card),
            expiry: card.expiry_date ?? null,
            accountStatus: String(owner.account_status ?? 'ACTIVE'),
            walletBalance: decimal(owner.wallet_balance),
        },
        {
            amount,
            merchantCountry,
            presentedCvv: body.cvv ?? null,
        }
    )

    const trace = [
        { step: 'Card lookup', status: 'PASS' as const, detail: `Matched card •••• ${last4}` },
        ...decision.trace,
    ]

    if (decision.code) {
        return declined({
            code: decision.code,
            card,
            owner,
            amount,
            currency,
            merchant,
            merchantCountry,
            trace,
        })
    }

    // Approved: the same statement the live card webhook calls.
    const txId = `chk_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const settled = await authoriseCardDebit({
        flutterwaveCardId: String(card.flutterwave_card_id ?? card.card_id),
        txId,
        amount,
        currency,
        merchant,
        category: 'Checkout',
        metadata: {
            source: 'checkout',
            merchantCountry,
            initiatedBy: user.email,
            last4,
        },
    })

    if (!settled) {
        // Every pre-flight passed but the guarded statement still refused, which
        // means the account state moved underneath us mid-request.
        return declined({
            code: 'DUPLICATE_TRANSACTION',
            detail: 'The authorisation was refused at settlement',
            card,
            owner,
            amount,
            currency,
            merchant,
            merchantCountry,
            trace: [...trace, { step: 'Settlement', status: 'FAIL', detail: 'The account state changed mid-request' }],
        })
    }

    await pushNotification(
        Number(card.user_id),
        'Card payment',
        `${formatMoney(amount, currency)} at ${merchant}. Balance ${formatMoney(settled.balance_after)}.`,
        'INFO'
    )

    const response: CheckoutResponse = {
        outcome: 'APPROVED',
        txId,
        amount,
        currency,
        merchant,
        last4,
        message: `Payment approved. ${formatMoney(amount, currency)} charged to card •••• ${last4}.`,
        declineCode: null,
        diagnostic: null,
        balanceAfter: decimal(settled.balance_after),
        cardAvailableAfter: subtract(
            subtract(decimal(card.card_spending_limit), decimal(card.total_spent_by_card)),
            amount
        ),
        trace: [
            ...trace,
            {
                step: 'Settlement',
                status: 'PASS',
                detail: `Wallet debited, card spend counter advanced, ledger row ${txId} written`,
            },
        ],
        authorisedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
})

/* ------------------------------------------------------------- helpers */

function normaliseExpiry(value: string): string {
    const match = /^(\d{1,2})\s*\/\s*(\d{2,4})$/.exec(value.trim())
    if (!match) return value.trim()
    const month = match[1]!.padStart(2, '0')
    const year = match[2]!.slice(-2)
    return `${month}/${year}`
}

/**
 * A declined checkout leaves the same trail a real decline does: a diagnostic
 * row for the command center's pane, and a FAILED ledger row so the
 * cardholder's own history reflects the attempt. Nothing else moves.
 */
async function declined(input: {
    code: Parameters<typeof diagnose>[0]
    detail?: string
    card: Record<string, any>
    owner: { id: number; wallet_balance: string }
    amount: string
    currency: string
    merchant: string
    merchantCountry: string
    trace: CheckoutResponse['trace']
}) {
    const diagnostic = diagnose(input.code)
    const txId = `chk_${randomUUID().replace(/-/g, '').slice(0, 24)}`

    await recordDecline({
        code: input.code,
        processorMessage: input.detail ?? diagnostic.title,
        cardId: String(input.card.card_id),
        cardLast4: input.card.last_4 ?? null,
        userId: Number(input.card.user_id),
        amount: input.amount,
        currency: input.currency,
        merchant: input.merchant,
        merchantCountry: input.merchantCountry,
        metadata: { source: 'checkout', txId },
    })

    await recordTransaction({
        txId,
        userId: Number(input.card.user_id),
        cardId: String(input.card.card_id),
        amount: input.amount,
        currency: input.currency,
        type: 'DEBIT',
        channel: 'CARD_TRANSACTION',
        status: 'FAILED',
        merchant: input.merchant,
        category: 'Checkout',
        metadata: { source: 'checkout', declineCode: input.code, merchantCountry: input.merchantCountry },
    })

    await pushNotification(
        Number(input.card.user_id),
        'Card payment declined',
        `${formatMoney(input.amount, input.currency)} at ${input.merchant} was declined — ${diagnostic.title.toLowerCase()}.`,
        'WARNING'
    )

    const response: CheckoutResponse = {
        outcome: 'DECLINED',
        txId,
        amount: input.amount,
        currency: input.currency,
        merchant: input.merchant,
        last4: String(input.card.last_4 ?? ''),
        message: `Declined — ${diagnostic.title}.`,
        declineCode: input.code,
        diagnostic,
        balanceAfter: decimal(input.owner.wallet_balance),
        cardAvailableAfter: subtract(
            decimal(input.card.card_spending_limit),
            decimal(input.card.total_spent_by_card)
        ),
        trace: input.trace,
        authorisedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
}

/** Exposed so the checkout page can show the caller which cards it may charge. */
export const GET = withRouteErrors('checkout:cards', async () => {
    const user = await requireUser()
    const cards = await getCardsByUserId(user.id)

    return NextResponse.json(
        cards.map((card) => ({
            cardId: card.card_id,
            last4: card.last_4 ?? '',
            maskedPan: card.masked_pan ?? '',
            brand: card.brand,
            holder: card.card_holder ?? '',
            expiry: card.expiry_date ?? '',
            status: card.status,
            expired: isExpired(card.expiry_date),
            available: subtract(decimal(card.card_spending_limit), decimal(card.total_spent_by_card)),
            limit: decimal(card.card_spending_limit),
        }))
    )
})
