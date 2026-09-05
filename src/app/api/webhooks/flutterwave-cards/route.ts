import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
    authoriseCardDebit,
    claimWebhookEvent,
    finishWebhookEvent,
    getCardByFlutterwaveId,
    pushNotification,
    recordTransaction,
    reverseCardDebit,
} from '@/lib/db'
import { verifyWebhookSignature } from '@/lib/flutterwave'
import { decimal, formatMoney, gte, subtract } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Route C - real-time Flutterwave card transaction webhook.
 *
 * Public and unauthenticated by necessity, so the first thing it does is
 * verify the `verif-hash` header against FLW_SECRET_HASH. Every event id is
 * claimed in `webhook_events` before processing, which makes redelivery a
 * no-op rather than a double charge.
 *
 * The authorisation decision (card ACTIVE, amount within the card's remaining
 * limit, wallet balance sufficient) and the resulting wallet debit, card spend
 * counter and ledger row all happen inside a single guarded SQL statement -
 * see `authoriseCardDebit`. A declined transaction therefore leaves the
 * database completely untouched.
 */
export async function POST(request: Request) {
    // 1. Signature check, before the body is trusted for anything.
    if (!verifyWebhookSignature(request.headers.get('verif-hash'))) {
        return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    let body: Record<string, any>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ status: 'bad_request' }, { status: 400 })
    }

    const eventType = String(body.event ?? body.type ?? 'unknown')
    const data: Record<string, any> = body.data ?? body

    const eventId = String(
        body.id ?? data.id ?? data.reference ?? data.tx_ref ?? `${eventType}:${Date.now()}`
    )

    // 2. Claim the event. A second delivery of the same id gets an immediate 200.
    const claim = await claimWebhookEvent('flutterwave', eventId, eventType, body)
    if (!claim) {
        return NextResponse.json({ status: 'duplicate' })
    }

    try {
        const outcome = await handleEvent(eventType, data, eventId)
        await finishWebhookEvent(claim.id, outcome.status, outcome.reason)
        // Always 200 so Flutterwave stops retrying an event we have decided on.
        return NextResponse.json({ status: 'ok', outcome: outcome.status })
    } catch (error) {
        console.error('[webhook:flutterwave-cards]', error)
        Sentry.captureException(error, { tags: { webhook: 'flutterwave-cards', eventType } })
        await finishWebhookEvent(claim.id, 'ERROR', error instanceof Error ? error.message : 'unknown')
        // 500 asks Flutterwave to retry - the claim row is already marked ERROR
        // and the unique index lets a retry of the same id fall through to
        // 'duplicate', so we surface the failure without risking a re-charge.
        return NextResponse.json({ status: 'error' }, { status: 500 })
    }
}

interface Outcome {
    status: string
    reason?: string
}

const DEBIT_EVENTS = new Set([
    'charge.card.virtual',
    'card.transaction',
    'virtualcard.transaction',
    'card_debit_event.successful',
    'CARD_TRANSACTION',
])

const CREDIT_EVENTS = new Set([
    'card.refund',
    'card_credit_event.successful',
    'virtualcard.refund',
])

async function handleEvent(eventType: string, data: Record<string, any>, eventId: string): Promise<Outcome> {
    const cardId = String(
        data.card_id ?? data.CardId ?? data.cardId ?? data.card?.id ?? data.virtual_card_id ?? ''
    )

    if (!cardId) {
        return { status: 'IGNORED', reason: 'no card id in payload' }
    }

    const amount = decimal(data.amount ?? data.Amount ?? 0)
    const currency = String(data.currency ?? data.Currency ?? 'USD').toUpperCase()
    const merchant = String(
        data.merchant_name ?? data.merchant?.name ?? data.narration ?? data.description ?? 'Card merchant'
    )
    const category = categoriseMerchant(merchant, data)

    const isCredit =
        CREDIT_EVENTS.has(eventType) ||
        String(data.type ?? '').toUpperCase() === 'CREDIT' ||
        String(data.direction ?? '').toUpperCase() === 'CREDIT'

    const isDebit = DEBIT_EVENTS.has(eventType) || String(data.type ?? '').toUpperCase() === 'DEBIT'

    if (!isCredit && !isDebit) {
        return { status: 'IGNORED', reason: `unhandled event ${eventType}` }
    }

    const txId = `flw_${eventId}`

    if (isCredit) {
        const reversed = await reverseCardDebit({
            flutterwaveCardId: cardId,
            txId,
            amount,
            currency,
            merchant,
            metadata: { eventType, raw: data },
        })
        if (!reversed) return { status: 'IGNORED', reason: 'unknown card or duplicate refund' }

        await pushNotification(
            reversed.user_id,
            'Refund received',
            `${formatMoney(amount, currency)} from ${merchant} was returned to your wallet.`,
            'SUCCESS'
        )
        return { status: 'REFUNDED' }
    }

    // 3. Verification checklist + wallet debit + ledger write, atomically.
    const settled = await authoriseCardDebit({
        flutterwaveCardId: cardId,
        txId,
        amount,
        currency,
        merchant,
        category,
        metadata: { eventType, raw: data },
    })

    if (settled) {
        await pushNotification(
            settled.user_id,
            'Card payment',
            `${formatMoney(amount, currency)} at ${merchant}. Balance ${formatMoney(settled.balance_after)}.`,
            'INFO'
        )
        return { status: 'SETTLED' }
    }

    // 4. Declined. Work out why, log it, and record the attempt as a FAILED
    // ledger row so the user's history reflects what actually happened.
    const card = await getCardByFlutterwaveId(cardId)

    if (!card) {
        return { status: 'IGNORED', reason: `no local card for ${cardId}` }
    }

    const remaining = subtract(card.card_spending_limit, card.total_spent_by_card)
    const reason =
        card.status !== 'ACTIVE'
            ? 'card is not active'
            : !gte(remaining, amount)
              ? `amount exceeds remaining card limit (${remaining})`
              : !gte(card.wallet_balance, amount)
                ? `wallet balance ${card.wallet_balance} is below ${amount}`
                : 'already recorded'

    console.warn(`[webhook:flutterwave-cards] declined ${txId} on card ${cardId}: ${reason}`)

    await recordTransaction({
        txId,
        userId: card.user_id,
        cardId: card.card_id,
        amount,
        currency,
        type: 'DEBIT',
        channel: 'CARD_TRANSACTION',
        status: 'FAILED',
        merchant,
        category,
        metadata: { eventType, declineReason: reason, raw: data },
    })

    await pushNotification(
        card.user_id,
        'Card payment declined',
        `${formatMoney(amount, currency)} at ${merchant} was declined - ${reason}.`,
        'WARNING'
    )

    return { status: 'DECLINED', reason }
}

/** Derives a spending category from the merchant descriptor for the charts. */
const CATEGORY_RULES: Array<[RegExp, string]> = [
    [/uber|lyft|bolt|taxi|transport|fuel|shell|petrol/i, 'Transport'],
    [/airbnb|hotel|booking|flight|airline|travel|expedia/i, 'Travel'],
    [/restaurant|cafe|coffee|food|pizza|kfc|mcdonald|deliveroo|glovo|java/i, 'Food & Drinks'],
    [/netflix|spotify|prime|hulu|cinema|game|steam|playstation|xbox/i, 'Entertainment'],
    [/aws|amazon web|google cloud|azure|github|vercel|digitalocean|openai|anthropic|figma|notion|slack/i, 'Technology'],
    [/amazon|shop|store|market|jumia|aliexpress|ebay|zara|nike/i, 'Shopping'],
    [/electric|water|internet|safaricom|airtel|utility|insurance|rent|bill/i, 'Bills & Utilities'],
    [/pharmacy|hospital|clinic|health|medical|doctor/i, 'Healthcare'],
]

function categoriseMerchant(merchant: string, data: Record<string, any>): string {
    // Prefer the provider's own MCC-derived category when it sends one.
    const provided = data.merchant?.category ?? data.category ?? data.mcc_category
    if (provided) return String(provided)

    for (const [pattern, category] of CATEGORY_RULES) {
        if (pattern.test(merchant)) return category
    }
    return 'Other'
}
