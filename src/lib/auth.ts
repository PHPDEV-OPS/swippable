import { currentUser } from '@clerk/nextjs/server'
import { findUserByEmail, insertUser, recordAppSession, touchAppSession } from '@/lib/db'

export async function getAuthenticatedUser() {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress

    if (!clerkUser || !email) {
        return null
    }

    let user = await findUserByEmail(email) as any
    const isNewUser = !user

    if (!user) {
        const result = await insertUser(
            clerkUser.id,
            clerkUser.firstName || clerkUser.username || 'User',
            email,
            null,
            clerkUser.imageUrl,
            'PENDING'
        )
        user = { id: result.lastInsertRowid, email }
    }

    if (isNewUser) {
        await recordAppSession(clerkUser.id, user.id)
    } else {
        await touchAppSession(clerkUser.id, user.id)
    }

    return user
}