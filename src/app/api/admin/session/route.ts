import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { withRouteErrors } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Whether the caller is a superadmin. The admin shell polls this before it
 * renders anything, so a non-admin never sees the layout at all.
 *
 * 404 rather than 403 for the negative case, matching `requireAdmin`.
 */
export const GET = withRouteErrors('admin:session', async () => {
    const session = await getAdminSession()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(session)
})
