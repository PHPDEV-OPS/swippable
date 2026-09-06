import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { creditWallet, findTransactionByTxId, findUserById, pushNotification } from '@/lib/db'
import { badRequest, HttpError, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney, isPositive } from '@/lib/money'
import { assertRailOpen } from '@/lib/platform'
import {
    createCheckoutSession,
    isStripeCheckoutConfigured,
    retrieveCheckoutSession,
} from '@/lib/stripe-checkout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stripe-hosted test checkout.
 *
 * Opens a real Stripe Checkout session, sends the payer to Stripe's own page,
 * and credits the wallet when they come back having paid. This is the acquiring
 * side, not Issuing, so it works on a plain sandbox account with no extra
 * activation - which makes it the dependable way to exercise a card payment end
 * to end.
 *
 * The credit is keyed on the Stripe session id, so returning to the success URL
 * twice - a refresh, a bookmarked link, a double-submit - credits exactly once.
 */
export const POST = withRouteErrors('checkout:stripe:create', async (request: Request) => {
    const user = await requireUser()

    // A card top-up is a deposit, so it answers to the deposit kill switch.
    await assertRailOpen('CARD_AUTHORISATIONS')

    if (!isStripeCheckoutConfigured()) {
        throw new HttpError(503, 'Stripe is not configured on this deployment.', 'STRIPE_UNCONFIGURED')
    }

    const body = await readJson<{ amount?: string; description?: string }>(request)
    const amount = decimal(body.amount)
    if (!isPositive(amount)) badRequest('Enter an amount greater than zero', 'INVALID_AMOUNT')

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

    const session = await createCheckoutSession({
        userId: user.id,
        email: user.email,
        amount,
        currency: 'USD',
        description: body.description?.trim() || 'Swippable wallet top-up',
        successUrl: `${origin}/checkout?stripe_session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/checkout?stripe_cancelled=1`,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
})

/**
 * Confirms a returning session and credits the wallet.
 *
 * The session is re-fetched from Stripe rather than trusted from the query
 * string, and the payer is checked against the signed-in user, so a session id
 * belonging to someone else credits nobody.
 */
export const GET = withRouteErrors('checkout:stripe:confirm', async (request: Request) => {
    const user = await requireUser()

    const sessionId = new URL(request.url).searchParams.get('sessionId')
    if (!sessionId) badRequest('A session id is required', 'SESSION_REQUIRED')

    const session = await retrieveCheckoutSession(sessionId)

    if (Number(session.metadata.swippable_user_id) !== user.id) {
        notFound('That checkout session does not belong to this account')
    }

    const txId = `stripe_${session.id}`

    if (session.paymentStatus !== 'paid') {
        const existing = await findTransactionByTxId(txId)
        return NextResponse.json({
            status: existing ? String(existing.status).toUpperCase() : 'PENDING',
            paid: false,
            amount: session.amountTotal,
            message:
                session.status === 'expired'
                    ? 'That checkout session expired before it was paid.'
                    : 'This payment has not completed yet.',
        })
    }

    // Idempotent by tx id: a refresh of the success URL credits nothing twice.
    const credited = await creditWallet({
        txId,
        userId: user.id,
        amount: session.amountTotal,
        currency: 'USD',
        type: 'CREDIT',
        channel: 'STRIPE',
        status: 'SUCCESS',
        merchant: 'Stripe test checkout',
        category: 'Card Deposit',
        metadata: { stripeSessionId: session.id, source: 'stripe_checkout' },
    })

    if (credited) {
        await pushNotification(
            user.id,
            'Wallet topped up',
            `${formatMoney(session.amountTotal)} received via Stripe. Balance ${formatMoney(credited.balance_after)}.`,
            'SUCCESS'
        )
    }

    const fresh = await findUserById(user.id)

    return NextResponse.json({
        status: 'SUCCESS',
        paid: true,
        amount: session.amountTotal,
        balance: decimal(fresh?.wallet_balance ?? 0),
        alreadyCredited: !credited,
        message: credited
            ? `${formatMoney(session.amountTotal)} credited to your wallet.`
            : 'This payment was already credited.',
    })
})
