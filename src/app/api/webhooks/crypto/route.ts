import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
    claimWebhookEvent,
    creditWallet,
    finishWebhookEvent,
    getWalletAddressOwner,
    pushNotification,
    settlePendingDeposit,
} from '@/lib/db'
import { decimal, formatMoney, isPositive } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Crypto (USDC on Base) deposit confirmation.
 *
 * Accepts confirmations from an on-chain indexer - Alchemy, QuickNode, Coinbase
 * Commerce and Helius all post a JSON body with an HMAC-SHA256 signature over
 * the raw payload, which is what `CRYPTO_WEBHOOK_SECRET` verifies here.
 *
 * Two settlement paths:
 *   - the user declared the deposit first, leaving a PENDING row keyed by tx
 *     hash: that row is flipped to SUCCESS and the wallet credited
 *   - the transfer arrives unannounced: the destination address is matched to
 *     a linked wallet and credited directly
 */
export async function POST(request: Request) {
    const raw = await request.text()

    if (!verifySignature(raw, request.headers.get('x-signature') ?? request.headers.get('x-webhook-signature'))) {
        return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    let body: Record<string, any>
    try {
        body = JSON.parse(raw)
    } catch {
        return NextResponse.json({ status: 'bad_request' }, { status: 400 })
    }

    const event = normaliseEvent(body)
    if (!event) {
        return NextResponse.json({ status: 'ignored', reason: 'unrecognised payload' })
    }

    const claim = await claimWebhookEvent('crypto', event.txHash.toLowerCase(), event.type, body)
    if (!claim) {
        return NextResponse.json({ status: 'duplicate' })
    }

    try {
        if (!event.confirmed) {
            await finishWebhookEvent(claim.id, 'PENDING', 'awaiting confirmations')
            return NextResponse.json({ status: 'pending' })
        }
        if (!isPositive(event.amount)) {
            await finishWebhookEvent(claim.id, 'IGNORED', 'non-positive amount')
            return NextResponse.json({ status: 'ignored' })
        }

        const txId = `crypto_${event.txHash.toLowerCase()}`

        // Path 1: settle the row the user created when declaring the deposit.
        const settled = await settlePendingDeposit(txId, {
            confirmations: event.confirmations,
            blockNumber: event.blockNumber,
            fromAddress: event.from,
        })

        if (settled) {
            await pushNotification(
                settled.user_id,
                'Crypto deposit confirmed',
                `${formatMoney(settled.amount)} USDC credited. Balance ${formatMoney(settled.balance_after)}.`,
                'SUCCESS'
            )
            await finishWebhookEvent(claim.id, 'SETTLED')
            return NextResponse.json({ status: 'settled' })
        }

        // Path 2: unannounced transfer - credit whoever owns the destination.
        if (!event.to) {
            await finishWebhookEvent(claim.id, 'ORPHANED', 'no destination address')
            return NextResponse.json({ status: 'orphaned' })
        }

        const owner = await getWalletAddressOwner(event.to)
        if (!owner) {
            await finishWebhookEvent(claim.id, 'ORPHANED', `no linked wallet for ${event.to}`)
            return NextResponse.json({ status: 'orphaned' })
        }

        const credited = await creditWallet({
            txId,
            userId: owner.user_id,
            amount: event.amount,
            currency: 'USD',
            type: 'CREDIT',
            channel: 'CRYPTO',
            status: 'SUCCESS',
            merchant: 'USDC deposit • Base',
            category: 'Crypto Deposit',
            metadata: {
                txHash: event.txHash,
                from: event.from,
                to: event.to,
                asset: event.asset,
                confirmations: event.confirmations,
            },
            txHash: event.txHash,
        })

        if (credited) {
            await pushNotification(
                owner.user_id,
                'Crypto deposit received',
                `${formatMoney(event.amount)} USDC credited. Balance ${formatMoney(credited.balance_after)}.`,
                'SUCCESS'
            )
        }

        await finishWebhookEvent(claim.id, credited ? 'SETTLED' : 'DUPLICATE')
        return NextResponse.json({ status: credited ? 'settled' : 'duplicate' })
    } catch (error) {
        console.error('[webhook:crypto]', error)
        Sentry.captureException(error, { tags: { webhook: 'crypto' } })
        await finishWebhookEvent(claim.id, 'ERROR', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json({ status: 'error' }, { status: 500 })
    }
}

function verifySignature(raw: string, received: string | null): boolean {
    const secret = process.env.CRYPTO_WEBHOOK_SECRET
    if (!secret) {
        console.error('[crypto] CRYPTO_WEBHOOK_SECRET is not set - rejecting webhook')
        return false
    }
    if (!received) return false

    const expected = createHmac('sha256', secret).update(raw).digest('hex')
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(received.replace(/^sha256=/, ''), 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
}

interface CryptoEvent {
    type: string
    txHash: string
    amount: string
    asset: string
    from: string | null
    to: string | null
    confirmations: number
    confirmed: boolean
    blockNumber: number | null
}

const MIN_CONFIRMATIONS = Number(process.env.CRYPTO_MIN_CONFIRMATIONS ?? 3)

/** Flattens the common indexer payload shapes into one event. */
function normaliseEvent(body: Record<string, any>): CryptoEvent | null {
    const activity = body.event?.activity?.[0] ?? body.activity?.[0] ?? body.data ?? body

    const txHash = String(activity.hash ?? activity.txHash ?? activity.transaction_hash ?? body.txHash ?? '')
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return null

    const confirmations = Number(activity.confirmations ?? body.confirmations ?? MIN_CONFIRMATIONS)

    return {
        type: String(body.type ?? body.event?.type ?? 'crypto.deposit'),
        txHash,
        amount: decimal(activity.value ?? activity.amount ?? 0),
        asset: String(activity.asset ?? activity.currency ?? 'USDC').toUpperCase(),
        from: activity.fromAddress ?? activity.from ?? null,
        to: activity.toAddress ?? activity.to ?? null,
        confirmations,
        confirmed: confirmations >= MIN_CONFIRMATIONS,
        blockNumber: activity.blockNum ? Number(activity.blockNum) : null,
    }
}
