import { currentUser } from '@clerk/nextjs/server'
import { findUserByClerkId, touchAppSession, upsertUser, type UserRow } from '@/lib/db'

/**
 * Resolves the Clerk session to the local user row, creating the mirror row on
 * first sight. Every authenticated API route funnels through here, so a request
 * can only ever touch the rows belonging to its own Clerk identity.
 */
export async function getAuthenticatedUser(): Promise<UserRow | null> {
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return null

    let user = await findUserByClerkId(clerkUser.id)

    if (!user) {
        user = await upsertUser({
            clerkUserId: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || clerkUser.username || 'User',
            email,
            image: clerkUser.imageUrl ?? null,
        })
    }

    await touchAppSession(clerkUser.id, user.id)

    return user
}

/** Thrown by `requireUser` and mapped to a 401 by the route error handler. */
export class UnauthorizedError extends Error {
    constructor() {
        super('Unauthorized')
        this.name = 'UnauthorizedError'
    }
}

export async function requireUser(): Promise<UserRow> {
    const user = await getAuthenticatedUser()
    if (!user) throw new UnauthorizedError()
    return user
}
