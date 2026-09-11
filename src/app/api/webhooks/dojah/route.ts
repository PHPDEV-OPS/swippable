import { NextResponse } from 'next/server'
import { withRouteErrors } from '@/lib/http'
import { verifyWebhookSignature } from '@/lib/dojah'
import {
    claimWebhookEvent,
    finishWebhookEvent,
    findUserByDojahReference,
    recordKycFailure,
    recordKycVerification,
} from '@/lib/db'
import { isKycVerified } from '@/types/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Dojah verification webhook.
 *
 * This is what makes verification automatic for the asynchronous flows - the
 * hosted widget and EasyOnboard - where the answer arrives minutes after the
 * user submits rather than in the response to our own call. The direct
 * `/api/kyc/verify` path does not need it; both converge on the same
 * transactional write, so a user ends up VERIFIED exactly once either way.
 *
 * Follows the same shape as the M-Pesa and Flutterwave webhooks: verify the
 * signature over the raw body first, claim the event id so a redelivery cannot
 * be processed twice, then act.
 */
export const POST = withRouteErrors('webhooks:dojah', async (request: Request) => {
    // Must be the raw bytes: parsing and re-serialising would change the
    // whitespace and break the HMAC.
    const rawBody = await request.text()
    const signature = request.headers.get('x-dojah-signature')

    if (!verifyWebhookSignature(rawBody, signature)) {
        // 401 rather than 400 - an unsigned or wrongly signed body is an
        // authentication failure, and we tell the sender nothing more.
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let payload: DojahWebhookPayload
    try {
        payload = JSON.parse(rawBody) as DojahWebhookPayload
    } catch {
        return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
    }

    const reference = payload.reference_id
    if (!reference) {
        // Nothing to correlate to an account. Acknowledged so Dojah stops
        // retrying a delivery that can never succeed.
        return NextResponse.json({ received: true, ignored: 'missing_reference' })
    }

    const status = payload.verification_status ?? payload.status ?? 'unknown'

    // Key on reference *and* status, not the reference alone. One verification
    // can emit several events as it progresses, and keying on the reference
    // only would let an early "pending" delivery permanently swallow the
    // "completed" one that follows it. An exact redelivery still dedupes.
    const claim = await claimWebhookEvent('dojah', `${reference}:${status}`, String(status), payload)
    if (!claim) {
        // Already processed - a duplicate delivery, which is expected.
        return NextResponse.json({ received: true, duplicate: true })
    }

    try {
        const user = await findUserByDojahReference(reference)
        if (!user) {
            await finishWebhookEvent(claim.id, 'IGNORED', 'no matching user')
            return NextResponse.json({ received: true, ignored: 'unknown_reference' })
        }

        // An account already verified - by an earlier event or by an admin -
        // is never downgraded by a late-arriving webhook.
        if (isKycVerified(user.kyc_status)) {
            await finishWebhookEvent(claim.id, 'PROCESSED')
            return NextResponse.json({ received: true, status: 'VERIFIED' })
        }

        const approved = isApproved(payload)
        const identity = extractIdentity(payload)

        // Approval is only honoured when the event actually carries the
        // identity it claims to have verified. A "passed" event with no name or
        // date of birth would otherwise write a VERIFIED row backed by nothing.
        if (approved && identity) {
            const write = await recordKycVerification(user.id, identity, reference)
            if (write.result === 'ID_TAKEN') {
                await recordKycFailure(user.id, { detail: 'duplicate_national_id', reference })
                await finishWebhookEvent(claim.id, 'PROCESSED')
                return NextResponse.json({ received: true, status: 'FAILED' })
            }
            await finishWebhookEvent(claim.id, 'PROCESSED')
            return NextResponse.json({ received: true, status: 'VERIFIED' })
        }

        // An in-progress event is not a rejection. Marking the user FAILED here
        // would flash a "verification failed" banner at someone whose check is
        // still running, and the terminal event is still to come.
        if (!approved && isInProgress(status)) {
            await finishWebhookEvent(claim.id, 'PROCESSED')
            return NextResponse.json({ received: true, status: 'PENDING' })
        }

        await recordKycFailure(user.id, {
            detail: approved ? 'approved_without_identity' : `provider_${status}`,
            reference,
        })
        await finishWebhookEvent(claim.id, 'PROCESSED')
        return NextResponse.json({ received: true, status: 'FAILED' })
    } catch (error) {
        await finishWebhookEvent(claim.id, 'FAILED', (error as Error).message)
        throw error
    }
})

interface DojahWebhookPayload {
    reference_id?: string
    verification_status?: string
    status?: string | boolean
    data?: {
        government_data?: { data?: Record<string, unknown> }
        user_data?: { data?: Record<string, unknown> }
        id?: { data?: Record<string, unknown> }
    }
}

/** Dojah spells the passing state several ways depending on the flow. */
function isApproved(payload: DojahWebhookPayload): boolean {
    const status = String(payload.verification_status ?? payload.status ?? '').toLowerCase()
    return status === 'completed' || status === 'approved' || status === 'successful' || status === 'true'
}

/** States that mean "still running", as opposed to a decided rejection. */
function isInProgress(status: string | boolean): boolean {
    const value = String(status).toLowerCase()
    return value === 'pending' || value === 'ongoing' || value === 'in_progress' || value === 'unknown'
}

/**
 * Pulls the identity out of whichever step of the widget payload carries it,
 * preferring the government record over what the user typed.
 */
function extractIdentity(payload: DojahWebhookPayload) {
    const sources = [
        payload.data?.government_data?.data,
        payload.data?.id?.data,
        payload.data?.user_data?.data,
    ].filter(Boolean) as Record<string, unknown>[]

    const pick = (...keys: string[]): string | null => {
        for (const source of sources) {
            for (const key of keys) {
                const value = source[key]
                if (typeof value === 'string' && value.trim()) return value.trim()
            }
        }
        return null
    }

    const firstName = pick('first_name', 'firstName')
    const lastName = pick('last_name', 'lastName', 'surname')
    const idNumber = pick('id_number', 'idNumber', 'id', 'national_id')
    const dob = pick('date_of_birth', 'dateOfBirth', 'dob')

    if (!firstName || !lastName || !idNumber || !dob) return null

    // Normalise to the YYYY-MM-DD the column expects; reject anything else
    // rather than letting Postgres guess at an ambiguous format.
    const isoDob = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null
    if (!isoDob) return null

    return { firstName, lastName, idNumber, dob: isoDob }
}
