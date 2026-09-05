import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import {
    deleteCardForUser,
    getCardForUser,
    pushNotification,
    recordTransaction,
    updateCardStatusForUser,
} from '@/lib/db'
import { isFlutterwaveConfigured, setVirtualCardStatus, terminateVirtualCard } from '@/lib/flutterwave'
import { decimal, isPositive, subtract } from '@/lib/money'
import { serializeCard } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** Pauses or resumes a card. The status is mirrored to Flutterwave when possible. */
export const PATCH = withRouteErrors('cards:patch', async (request: Request, ctx: unknown) => {
    const user = await requireUser()
    const { id } = await (ctx as Params).params
    const { status } = await readJson<{ status?: string }>(request)

    const next = String(status ?? '').toUpperCase()
    if (next !== 'ACTIVE' && next !== 'PAUSED') {
        badRequest('status must be ACTIVE or PAUSED', 'INVALID_STATUS')
    }

    const existing = await getCardForUser(user.id, id)
    if (!existing) notFound('Card not found')

    if (isFlutterwaveConfigured() && existing.flutterwave_card_id && existing.provider === 'flutterwave') {
        try {
            await setVirtualCardStatus(existing.flutterwave_card_id, next)
        } catch (error) {
            // A provider hiccup must not desync the local record silently.
            console.error('[cards] failed to mirror status to Flutterwave', error)
        }
    }

    const row = await updateCardStatusForUser(user.id, id, next)
    if (!row) notFound('Card not found')

    await pushNotification(
        user.id,
        next === 'PAUSED' ? 'Card paused' : 'Card resumed',
        `Card •••• ${row.last_4 ?? ''} is now ${next.toLowerCase()}.`,
        next === 'PAUSED' ? 'WARNING' : 'SUCCESS'
    )

    return NextResponse.json(serializeCard(row))
})

/**
 * Terminates a card and returns its unspent allocation to the shared wallet.
 * The wallet balance itself never held the allocation, so releasing it is a
 * ledger entry plus the removal of the reservation.
 */
export const DELETE = withRouteErrors('cards:delete', async (_request: Request, ctx: unknown) => {
    const user = await requireUser()
    const { id } = await (ctx as Params).params

    const existing = await getCardForUser(user.id, id)
    if (!existing) notFound('Card not found')

    const released = subtract(existing.card_spending_limit, existing.total_spent_by_card)

    if (isFlutterwaveConfigured() && existing.flutterwave_card_id && existing.provider === 'flutterwave') {
        try {
            await terminateVirtualCard(existing.flutterwave_card_id)
        } catch (error) {
            console.error('[cards] failed to terminate card at Flutterwave', error)
        }
    }

    const deleted = await deleteCardForUser(user.id, id)
    if (!deleted) notFound('Card not found')

    if (isPositive(released)) {
        await recordTransaction({
            txId: `swp_release_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
            userId: user.id,
            amount: decimal(released),
            currency: existing.currency ?? 'USD',
            type: 'CREDIT',
            channel: 'CARD_FUNDING',
            status: 'SUCCESS',
            merchant: `Card closed • ${existing.last_4 ?? ''}`.trim(),
            category: 'Card Funding',
            metadata: { action: 'TERMINATE', cardId: id, released },
        })
    }

    await pushNotification(
        user.id,
        'Card terminated',
        `Card •••• ${existing.last_4 ?? ''} was closed and its unspent limit released.`,
        'WARNING'
    )

    return NextResponse.json({ message: 'Card terminated', released: decimal(released) })
})
