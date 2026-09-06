import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listAudit } from '@/lib/admin-db'
import { withRouteErrors } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Append-only record of every override, newest first. */
export const GET = withRouteErrors('admin:audit', async (request: Request) => {
    await requireAdmin()
    const params = new URL(request.url).searchParams

    const entries = await listAudit(
        Number(params.get('limit') ?? 120),
        params.get('targetType') ?? undefined,
        params.get('targetId') ?? undefined
    )

    return NextResponse.json(entries)
})
