import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, withRouteErrors, readJson } from '@/lib/http'
import { normaliseKycStatus } from '@/lib/kyc'
import { isKycVerified } from '@/types/api'

export const dynamic = 'force-dynamic'

/** The caller's current KYC state, plus what the UI needs to route them. */
export const GET = withRouteErrors('kyc:get', async () => {
    const user = await requireUser()
    const status = normaliseKycStatus(user.kyc_status)

    return NextResponse.json({
        kyc_status: status,
        verified: isKycVerified(status),
        verifiedAt: user.verified_at ? new Date(user.verified_at).toISOString() : null,
        // Confirms to the user which identity is on file without echoing the
        // ID number back over the wire.
        identity: isKycVerified(status)
            ? { firstName: user.first_name, lastName: user.last_name }
            : null,
    })
})

/**
 * Reports Clerk's email-verification state.
 *
 * This endpoint used to set `kyc_status` to VERIFIED once a Clerk email was
 * confirmed. That was a full bypass of the identity gate - controlling an
 * inbox proves you can receive mail, not that you are the person named on a
 * National ID - so it now reports only, and never escalates KYC. Identity
 * verification happens at POST /api/kyc/verify against the national database.
 */
export const POST = withRouteErrors('kyc:post', async (request: Request) => {
    const user = await requireUser()
    const { action } = await readJson<{ action?: string }>(request)

    if (action !== 'verify_email') {
        badRequest('Unsupported action', 'INVALID_ACTION')
    }

    const clerkUser = await currentUser()
    const primary = clerkUser?.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
    const emailVerified = primary?.verification?.status === 'verified'

    return NextResponse.json({
        emailVerified,
        status: normaliseKycStatus(user.kyc_status),
        message: emailVerified
            ? 'Your email is verified. Identity verification is a separate step.'
            : 'Your email is not verified with Clerk yet. Verify it from your account menu, then check back here.',
    })
})
