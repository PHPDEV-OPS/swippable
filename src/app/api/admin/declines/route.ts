import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDeclineBreakdown, listDeclines } from '@/lib/admin-db'
import { DECLINE_CATALOGUE, diagnose } from '@/lib/decline'
import { withRouteErrors } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * The decline diagnostic feed.
 *
 * Each record is returned already paired with its plain-English diagnosis, so
 * the pane never has to guess what a processor code means - the catalogue is
 * the single source of that mapping for the live path, the simulator and here.
 */
export const GET = withRouteErrors('admin:declines', async (request: Request) => {
    await requireAdmin()
    const params = new URL(request.url).searchParams

    const [records, breakdown] = await Promise.all([
        listDeclines({
            cardId: params.get('cardId') ?? undefined,
            limit: Number(params.get('limit') ?? 60),
            includeSimulated: params.get('simulated') !== 'false',
        }),
        getDeclineBreakdown(Number(params.get('hours') ?? 24)),
    ])

    return NextResponse.json({
        records: records.map((record) => ({ ...record, diagnostic: diagnose(record.code) })),
        breakdown: breakdown.map((entry) => ({ ...entry, diagnostic: diagnose(entry.code) })),
        catalogue: DECLINE_CATALOGUE,
    })
})
