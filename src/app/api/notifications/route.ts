import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withRouteErrors } from '@/lib/http'
import { getNotifications, markNotificationsRead } from '@/lib/db'
import { serializeNotification } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

/** Real notifications, written by the webhooks and card operations. */
export const GET = withRouteErrors('notifications:list', async () => {
    const user = await requireUser()
    const rows = await getNotifications(user.id, 20)
    return NextResponse.json(rows.map(serializeNotification))
})

export const POST = withRouteErrors('notifications:read', async () => {
    const user = await requireUser()
    await markNotificationsRead(user.id)
    return NextResponse.json({ message: 'Marked read' })
})
