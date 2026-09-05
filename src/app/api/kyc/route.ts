import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, readJson, withRouteErrors } from '@/lib/http'
import { pushNotification, updateUserKycStatus } from '@/lib/db'

export const dynamic = 'force-dynamic'

export const GET = withRouteErrors('kyc:get', async () => {
    const user = await requireUser()
    return NextResponse.json({ kyc_status: String(user.kyc_status ?? 'PENDING').toUpperCase() })
})

/**
 * Email verification is owned by Clerk, so this endpoint reflects Clerk's
 * actual verification state rather than granting it on request.
 */
export const POST = withRouteErrors('kyc:post', async (request: Request) => {
    const user = await requireUser()
    const { action } = await readJson<{ action?: string }>(request)

    if (action !== 'verify_email') {
        badRequest('Unsupported action', 'INVALID_ACTION')
    }

    const clerkUser = await currentUser()
    const primary = clerkUser?.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
    const verified = primary?.verification?.status === 'verified'

    if (!verified) {
        return NextResponse.json(
            {
                status: String(user.kyc_status ?? 'PENDING').toUpperCase(),
                message:
                    'Your email is not verified with Clerk yet. Verify it from your account menu, then check back here.',
            },
            { status: 409 }
        )
    }

    await updateUserKycStatus('VERIFIED', user.id)
    await pushNotification(user.id, 'Identity verified', 'Your email address has been verified.', 'SUCCESS')

    return NextResponse.json({ message: 'Email verified', status: 'VERIFIED' })
})
