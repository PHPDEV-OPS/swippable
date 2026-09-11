import { currentUser } from '@clerk/nextjs/server'
import { findUserByClerkId, touchAppSession, upsertUser, type UserRow } from '@/lib/db'
import { syncClerkWeb3Wallets } from '@/lib/web3-identity'
import { ensureDepositAddress } from '@/lib/deposit-address'

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

    // A Base / Coinbase Wallet sign-in already proved ownership of the address,
    // so treat it as the wallet link and record it here. Doing it on the auth
    // path rather than behind a button means a user who signed in with their
    // wallet can receive USDC immediately, without linking anything by hand.
    //
    // Never allowed to break a sign-in: a linking failure costs the user a
    // convenience, whereas throwing here would cost them the whole session.
    try {
        await syncClerkWeb3Wallets({ userId: user.id, wallets: clerkUser.web3Wallets })
    } catch (error) {
        console.error('[auth] Clerk Web3 wallet sync failed', error)
    }

    // Give every account its own USDC receiving address. Done here rather than
    // in a sign-up hook so accounts that predate this feature are backfilled on
    // their next request, and so a user who never completes a webhook-driven
    // onboarding still ends up with somewhere to receive funds.
    //
    // Same rule as the wallet sync: this must never break a sign-in. A missing
    // deposit address costs the user one feature; throwing costs them the
    // session.
    try {
        await ensureDepositAddress(user.id)
    } catch (error) {
        console.error('[auth] deposit address provisioning failed', error)
    }

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
