import 'server-only'

import { redirect } from 'next/navigation'
import { getAuthenticatedUser, requireUser } from '@/lib/auth'
import { HttpError } from '@/lib/http'
import { isKycVerified, type KycStatus } from '@/types/api'
import type { UserRow } from '@/lib/db'

/**
 * The KYC gate.
 *
 * Both entry points below read `kyc_status` from our own Neon row, never from a
 * Clerk claim or anything the client sends. The UI gate exists to give the user
 * a sensible route; the API gate is the one that actually enforces, because a
 * redirect is only a suggestion to a browser and says nothing about a direct
 * POST to the endpoint.
 */

export const KYC_VERIFICATION_PATH = '/dashboard/kyc-verification'

export function normaliseKycStatus(raw: string | null | undefined): KycStatus {
    const value = String(raw ?? '').toUpperCase()
    switch (value) {
        case 'VERIFIED':
        case 'PENDING':
        case 'FAILED':
        case 'REJECTED':
        case 'UNVERIFIED':
            return value
        default:
            // Rows created before the KYC columns existed default to 'PENDING'
            // in the schema; anything unrecognised is treated as not verified.
            return 'UNVERIFIED'
    }
}

/**
 * Server-component guard. Redirects an unverified user to the verification
 * form instead of rendering the protected page.
 *
 * Returns the user row so a caller that needs it does not have to load it
 * twice.
 */
export async function requireVerifiedKycPage(): Promise<UserRow> {
    const user = await getAuthenticatedUser()

    // Not signed in at all - the sign-in redirect is Clerk's job, and sending
    // them to the KYC form first would be a confusing dead end.
    if (!user) redirect('/sign-in')

    if (!isKycVerified(user.kyc_status)) {
        redirect(KYC_VERIFICATION_PATH)
    }

    return user
}

/**
 * API-route guard. Throws a 403 carrying a machine-readable code so the client
 * can route the user to the form rather than showing a raw error.
 */
export async function requireVerifiedKycApi(): Promise<UserRow> {
    const user = await requireUser()

    if (!isKycVerified(user.kyc_status)) {
        const status = normaliseKycStatus(user.kyc_status)
        throw new HttpError(403, messageForStatus(status), 'KYC_REQUIRED')
    }

    return user
}

function messageForStatus(status: KycStatus): string {
    switch (status) {
        case 'PENDING':
            return 'Your identity verification is still being processed. This usually takes a moment.'
        case 'FAILED':
            return 'Your identity could not be verified. Please review your details and try again.'
        case 'REJECTED':
            return 'Your identity verification was declined. Please contact support.'
        default:
            return 'Verify your identity before creating a card.'
    }
}
