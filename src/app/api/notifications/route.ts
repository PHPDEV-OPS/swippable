import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { readJson, withRouteErrors } from '@/lib/http'
import {
    deleteNotification,
    deleteNotifications,
    getNotifications,
    markNotificationsRead,
} from '@/lib/db'
import { serializeNotification } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

/** Real notifications, written by the webhooks and card operations. */
export const GET = withRouteErrors('notifications:list', async () => {
    const user = await requireUser()
    const rows = await getNotifications(user.id, 20)
    return NextResponse.json(rows.map(serializeNotification))
})

/** Marks every unread notification as read. */
export const POST = withRouteErrors('notifications:read', async () => {
    const user = await requireUser()
    const updated = await markNotificationsRead(user.id)
    return NextResponse.json({ message: 'Marked read', updated })
})

/**
 * Dismisses notifications.
 *   - `{ id }`        removes one
 *   - `{ scope: 'read' }` clears the ones already read (the default)
 *   - `{ scope: 'all' }`  clears everything
 */
export const DELETE = withRouteErrors('notifications:delete', async (request: Request) => {
    const user = await requireUser()
    const { id, scope } = await readJson<{ id?: number; scope?: 'read' | 'all' }>(request)

    if (typeof id === 'number') {
        const removed = await deleteNotification(user.id, id)
        return NextResponse.json({ message: removed ? 'Dismissed' : 'Not found', deleted: removed ? 1 : 0 })
    }

    const deleted = await deleteNotifications(user.id, scope !== 'all')
    return NextResponse.json({ message: 'Cleared', deleted })
})
