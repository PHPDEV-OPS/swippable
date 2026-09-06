import { currentUser } from '@clerk/nextjs/server'
import { bootstrapAdminEmails, resolveAdmin, writeAudit } from '@/lib/admin-db'
import { touchAppSession } from '@/lib/db'
import { HttpError } from '@/lib/http'
import type { AdminSession } from '@/types/admin'

/**
 * Superadmin gate.
 *
 * There is exactly one privilege level here - there are no support roles, so
 * there is nothing to check beyond "is this identity a founder". Access is
 * granted two ways:
 *
 *   1. `users.is_admin` is already true, or
 *   2. the Clerk email is on the bootstrap list (swippable@gmail.com, plus
 *      anything in ADMIN_EMAILS), in which case the flag is set on first sight.
 *
 * The founder account is created in Clerk and in Postgres by hand and out of
 * band, so its Clerk id, uuid and local row id are only knowable once it
 * actually signs in. `resolveAdmin` stitches those identifiers together on that
 * first request and the link is recorded in the audit log.
 */

export class ForbiddenError extends Error {
    constructor(message = 'Superadmin access required') {
        super(message)
        this.name = 'ForbiddenError'
    }
}

export async function getAdminSession(): Promise<AdminSession | null> {
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return null

    const resolved = await resolveAdmin({
        clerkUserId: clerkUser.id,
        email,
        name: clerkUser.fullName || clerkUser.firstName || clerkUser.username || 'Superadmin',
        imageUrl: clerkUser.imageUrl ?? null,
    })

    if (!resolved) return null

    // Same session bookkeeping as the user-facing app, so "last seen" is
    // accurate for the founder account too.
    await touchAppSession(clerkUser.id, resolved.row.id)

    if (resolved.bootstrapped) {
        await writeAudit({
            action: 'ADMIN_BOOTSTRAPPED',
            actorEmail: email,
            actorClerkId: clerkUser.id,
            targetType: 'USER',
            targetId: String(resolved.row.id),
            reason: 'First superadmin sign-in - identity linked',
            after: {
                userId: resolved.row.id,
                uuid: resolved.row.uuid,
                clerkUserId: clerkUser.id,
                email,
            },
        })
    }

    return {
        email,
        name: resolved.row.name,
        clerkUserId: clerkUser.id,
        userId: resolved.row.id,
        imageUrl: resolved.row.image ?? clerkUser.imageUrl ?? null,
        bootstrapped: resolved.bootstrapped,
    }
}

export async function requireAdmin(): Promise<AdminSession> {
    const session = await getAdminSession()
    if (!session) {
        // 404 rather than 403: an unauthorised caller learns nothing about
        // whether this surface exists or who is on the bootstrap list.
        throw new HttpError(404, 'Not found')
    }
    return session
}

/** Client IP for the audit trail, as forwarded by Vercel's proxy. */
export function clientIp(request: Request): string | null {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]!.trim()
    return request.headers.get('x-real-ip')
}

/** Every override must carry a justification - it is the audit log's payload. */
export function requireReason(reason: unknown): string {
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (text.length < 4) {
        throw new HttpError(400, 'A reason of at least 4 characters is required for every override', 'REASON_REQUIRED')
    }
    return text.slice(0, 500)
}

export { bootstrapAdminEmails }
