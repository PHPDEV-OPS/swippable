import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { writeAudit } from '@/lib/admin-db'
import { readJson, withRouteErrors } from '@/lib/http'
import { getKillSwitch, setKillSwitch } from '@/lib/platform'
import { PLATFORM_RAILS, RAIL_LABELS, type PlatformRail } from '@/types/admin'

export const dynamic = 'force-dynamic'

export const GET = withRouteErrors('admin:killswitch:get', async () => {
    await requireAdmin()
    return NextResponse.json(await getKillSwitch())
})

/**
 * Engages or releases the global kill switch, or holds an individual rail.
 *
 * The state lands in `platform_settings`, which `assertRailOpen` reads on
 * every deposit, issuance and authorisation - so this takes effect on the very
 * next request rather than at the next deploy.
 */
export const POST = withRouteErrors('admin:killswitch:set', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<{
        engaged?: boolean
        rail?: PlatformRail
        halted?: boolean
        reason?: string
    }>(request)

    const reason = requireReason(body.reason)

    const rails =
        body.rail && PLATFORM_RAILS.includes(body.rail) ? { [body.rail]: Boolean(body.halted) } : undefined

    const { before, after } = await setKillSwitch(
        { engaged: body.engaged, rails, reason },
        admin.email
    )

    const engagedNow = after.haltedRails.length > 0
    const wasEngaged = before.haltedRails.length > 0

    await writeAudit({
        action: body.rail
            ? body.halted
                ? 'RAIL_HALTED'
                : 'RAIL_RESUMED'
            : engagedNow && !wasEngaged
              ? 'KILL_SWITCH_ENGAGED'
              : 'KILL_SWITCH_RELEASED',
        actorEmail: admin.email,
        actorClerkId: admin.clerkUserId,
        targetType: 'PLATFORM',
        targetId: body.rail ? RAIL_LABELS[body.rail] : 'GLOBAL',
        reason,
        before: { haltedRails: before.haltedRails, engaged: before.engaged },
        after: { haltedRails: after.haltedRails, engaged: after.engaged },
        ip: clientIp(request),
    })

    return NextResponse.json(after)
})
