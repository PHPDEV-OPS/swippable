import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
    claimWebhookEvent,
    failPendingDeposit,
    finishWebhookEvent,
    pushNotification,
    settlePendingDeposit,
} from '@/lib/db'
import { parseStkCallback } from '@/lib/mpesa'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Safaricom Daraja STK push callback.
 *
 * Daraja does not sign its callbacks, so the endpoint is hardened three ways:
 *   - an optional shared secret in the path query (MPESA_CALLBACK_SECRET)
 *   - every CheckoutRequestID is claimed once in `webhook_events`
 *   - the credit only ever settles a row this app already created as PENDING,
 *     so an unsolicited callback has nothing to attach to and credits nobody.
 *
 * Daraja retries until it gets a 200, so we answer 200 for anything we have
 * conclusively decided on, including deliberate rejections.
 */
export async function POST(request: Request) {
    const expectedSecret = process.env.MPESA_CALLBACK_SECRET
    if (expectedSecret) {
        const provided = new URL(request.url).searchParams.get('secret')
        if (provided !== expectedSecret) {
            return NextResponse.json({ ResultCode: 1, ResultDesc: 'Rejected' }, { status: 401 })
        }
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid payload' }, { status: 400 })
    }

    const callback = parseStkCallback(body)
    if (!callback) {
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Ignored' })
    }

    const claim = await claimWebhookEvent('mpesa', callback.checkoutRequestId, 'stk_callback', body)
    if (!claim) {
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Duplicate' })
    }

    const txId = `mpesa_${callback.checkoutRequestId}`

    try {
        if (!callback.success) {
            const failed = await failPendingDeposit(txId, {
                resultCode: callback.resultCode,
                resultDesc: callback.resultDesc,
            })
            if (failed) {
                await pushNotification(
                    failed.user_id,
                    'M-Pesa top up failed',
                    callback.resultDesc || 'The payment was not completed.',
                    'WARNING'
                )
            }
            await finishWebhookEvent(claim.id, 'FAILED', callback.resultDesc)
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'Recorded' })
        }

        const settled = await settlePendingDeposit(txId, {
            mpesaReceipt: callback.receipt,
            confirmedPhone: callback.phone,
            confirmedAmountKes: callback.amount,
            resultDesc: callback.resultDesc,
        })

        if (!settled) {
            // Nothing pending under this id - either already settled, or the
            // callback does not correspond to a deposit this app started.
            await finishWebhookEvent(claim.id, 'ORPHANED', 'no matching pending deposit')
            return NextResponse.json({ ResultCode: 0, ResultDesc: 'No matching deposit' })
        }

        await pushNotification(
            settled.user_id,
            'Wallet topped up',
            `${formatMoney(settled.amount)} received via M-Pesa. Balance ${formatMoney(settled.balance_after)}.`,
            'SUCCESS'
        )

        await finishWebhookEvent(claim.id, 'SETTLED')
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    } catch (error) {
        console.error('[webhook:mpesa]', error)
        Sentry.captureException(error, { tags: { webhook: 'mpesa' } })
        await finishWebhookEvent(claim.id, 'ERROR', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json({ ResultCode: 1, ResultDesc: 'Retry' }, { status: 500 })
    }
}

/** Daraja probes the callback URL with a GET during setup. */
export async function GET() {
    return NextResponse.json({ status: 'ok', endpoint: 'mpesa-stk-callback' })
}
