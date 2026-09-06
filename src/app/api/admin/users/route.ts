import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listAdminUsers } from '@/lib/admin-db'
import { serializeAdminUser } from '@/lib/admin-serialize'
import { withRouteErrors } from '@/lib/http'
import type { AccountStatus } from '@/types/admin'

export const dynamic = 'force-dynamic'

export const GET = withRouteErrors('admin:users', async (request: Request) => {
    await requireAdmin()
    const params = new URL(request.url).searchParams

    const rows = await listAdminUsers({
        search: params.get('q') ?? undefined,
        status: (params.get('status') as AccountStatus | 'ALL') ?? 'ALL',
        kyc: params.get('kyc') ?? undefined,
        limit: Number(params.get('limit') ?? 100),
    })

    return NextResponse.json(rows.map(serializeAdminUser))
})
