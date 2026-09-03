import { currentUser } from '@clerk/nextjs/server'
import { findUserByEmail, insertUser } from '@/lib/db'

export async function getAuthenticatedUser() {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress

    if (!clerkUser || !email) {
        return null
    }

    let user = findUserByEmail.get(email) as any

    if (!user) {
        const result = insertUser.run(
            clerkUser.id,
            clerkUser.firstName || clerkUser.username || 'User',
            email,
            null,
            clerkUser.imageUrl,
            'PENDING'
        )
        user = { id: result.lastInsertRowid, email }
    }

    return user
}