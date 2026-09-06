import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { findAdminCard, listAdminCards, overrideCardLimit, overrideCardStatus, writeAudit } from '@/lib/admin-db'
import { serializeAdminCard } from '@/lib/admin-serialize'
import { pushNotification } from '@/lib/db'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney, toMinor } from '@/lib/money'

export const dynamic = 'force-dynamic'

const CARD_STATUSES = ['ACTIVE', 'PAUSED', 'CLOSED']

export const GET = withRouteErrors('admin:cards', async (request: Request) => {
    await requireAdmin()
    const params = new URL(request.url).searchParams

    const rows = await listAdminCards({
        search: params.get('q') ?? undefined,
        status: params.get('status') ?? undefined,
        userId: params.get('userId') ? Number(params.get('userId')) : undefined,
        limit: Number(params.get('limit') ?? 150),
    })

    return NextResponse.json(rows.map(serializeAdminCard))
})

/**
 * Card override: status and allocation.
 *
 * Unlike the user-facing funding path this does not require the wallet to back
 * the limit - a founder raising a limit mid-incident should not be blocked by
 * an allocation guard. The one refusal that stands is dropping a limit below
 * what the card has already spent, which would corrupt the spend counter.
 */
export const PATCH = withRouteErrors('admin:cards:override', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<{ cardId?: string; status?: string; spendingLimit?: string; reason?: string }>(request)
    const reason = requireReason(body.reason)

    if (!body.cardId) badRequest('A card id is required', 'CARD_ID_REQUIRED')

    const card = await findAdminCard(body.cardId)
    if (!card) notFound('Card not found')

    const ip = clientIp(request)
    const applied: string[] = []

    if (body.status) {
        const next = String(body.status).toUpperCase()
        if (!CARD_STATUSES.includes(next)) badRequest('Unknown card status', 'INVALID_CARD_STATUS')

        await overrideCardStatus(String(card.card_id), next)
        await writeAudit({
            action: 'CARD_STATUS_OVERRIDE',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'CARD',
            targetId: String(card.card_id),
            reason,
            before: { status: card.status },
            after: { status: next },
            ip,
        })
        await pushNotification(
            Number(card.user_id),
            next === 'ACTIVE' ? 'Card reactivated' : next === 'PAUSED' ? 'Card paused' : 'Card closed',
            `Card •••• ${card.last_4 ?? ''} is now ${next.toLowerCase()}.`,
            next === 'ACTIVE' ? 'SUCCESS' : 'SECURITY'
        )
        applied.push(`Status → ${next}`)
    }

    if (body.spendingLimit !== undefined) {
        const limit = decimal(body.spendingLimit)
        if (toMinor(limit) < 0n) badRequest('A card limit cannot be negative', 'INVALID_LIMIT')

        const updated = await overrideCardLimit(String(card.card_id), limit)
        if (!updated) {
            badRequest(
                `That limit is below the ${formatMoney(card.total_spent_by_card)} already spent on this card.`,
                'LIMIT_BELOW_SPEND'
            )
        }

        await writeAudit({
            action: 'CARD_LIMIT_OVERRIDE',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'CARD',
            targetId: String(card.card_id),
            reason,
            before: { spendingLimit: decimal(card.card_spending_limit) },
            after: { spendingLimit: limit },
            ip,
        })
        applied.push(`Limit → ${formatMoney(limit)}`)
    }

    if (applied.length === 0) badRequest('No override was supplied', 'NOTHING_TO_APPLY')

    const refreshed = await findAdminCard(String(card.card_id))
    return NextResponse.json({
        status: 'ok',
        applied,
        card: refreshed ? serializeAdminCard(refreshed) : null,
    })
})
