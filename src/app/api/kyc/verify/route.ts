import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { HttpError, readJson, withRouteErrors } from '@/lib/http'
import { countKycAttemptsSince, recordKycFailure, recordKycVerification } from '@/lib/db'
import { DojahError, evaluateMatch, isDojahConfigured, lookupKenyanId } from '@/lib/dojah'
import { isKycVerified } from '@/types/api'

export const dynamic = 'force-dynamic'
// Node, not Edge: the Dojah client uses node:crypto for webhook signatures and
// the secret must stay on a runtime we control.
export const runtime = 'nodejs'

/**
 * Kenyan National ID verification against the national database via Dojah.
 *
 * The secret key and AppId are read from the server environment and used only
 * inside this request; nothing about the provider call is reachable from the
 * browser, which sees only a status and a message.
 */

/** A Kenyan National ID is 7-8 digits; allow 6-10 to tolerate legacy formats. */
const ID_NUMBER = /^\d{6,10}$/
/** Latin letters, spaces, hyphens and apostrophes - names like "O'Brien-Muthoni". */
const NAME = /^[\p{L}][\p{L}\s'-]*$/u

const VerifyPayload = z
    .object({
        firstName: z.string().trim().min(2).max(60).regex(NAME, 'Enter your first name as it appears on your ID'),
        lastName: z.string().trim().min(2).max(60).regex(NAME, 'Enter your last name as it appears on your ID'),
        idNumber: z.string().trim().regex(ID_NUMBER, 'Enter a valid Kenyan National ID number'),
        dob: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
            .refine(isRealDate, 'Enter a real date of birth')
            .refine(isAdult, 'You must be at least 18 years old to use Swippable'),
    })
    // Reject unknown keys outright rather than silently dropping them, so a
    // client that thinks it is sending `kycStatus: "VERIFIED"` gets an error
    // instead of a false sense that it worked.
    .strict()

/** Guards against 2024-02-31 style inputs that match the regex but do not exist. */
function isRealDate(value: string): boolean {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    )
}

function isAdult(value: string): boolean {
    const dob = new Date(`${value}T00:00:00Z`)
    const eighteen = new Date(dob)
    eighteen.setUTCFullYear(eighteen.getUTCFullYear() + 18)
    return eighteen.getTime() <= Date.now()
}

/** Dojah bills per call, so a user cannot be allowed to retry without limit. */
const MAX_ATTEMPTS_PER_HOUR = 5

export const POST = withRouteErrors('kyc:verify', async (request: Request) => {
    const user = await requireUser()

    // Already verified: stop before spending a provider call. Re-running the
    // check could only ever change a good state into a worse one.
    if (isKycVerified(user.kyc_status)) {
        return NextResponse.json({ status: 'VERIFIED', message: 'Your identity is already verified.' })
    }

    if (!isDojahConfigured()) {
        throw new HttpError(503, 'Identity verification is temporarily unavailable.', 'KYC_UNAVAILABLE')
    }

    const attempts = await countKycAttemptsSince(user.id, new Date(Date.now() - 60 * 60 * 1000))
    if (attempts >= MAX_ATTEMPTS_PER_HOUR) {
        throw new HttpError(
            429,
            'Too many verification attempts. Please try again in an hour or contact support.',
            'KYC_RATE_LIMITED'
        )
    }

    const parsed = VerifyPayload.safeParse(await readJson(request))
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new HttpError(400, issue?.message ?? 'Check the details you entered.', 'INVALID_PAYLOAD')
    }

    const identity = parsed.data

    let entity
    try {
        entity = await lookupKenyanId(identity)
    } catch (error) {
        if (!(error instanceof DojahError)) throw error

        // A provider outage is not the user's failure, so the account is left
        // where it is rather than being marked FAILED - otherwise a bad hour at
        // Dojah would permanently brand real customers as failing KYC.
        if (error.retryable) {
            throw new HttpError(503, error.message, 'KYC_PROVIDER_UNAVAILABLE')
        }

        await recordKycFailure(user.id, { detail: `upstream_${error.status}` })
        return NextResponse.json({ status: 'FAILED', message: error.message }, { status: 422 })
    }

    const match = evaluateMatch(entity, identity)

    if (!match.matched) {
        await recordKycFailure(user.id, { mismatched: match.mismatched, detail: 'field_mismatch' })
        return NextResponse.json(
            {
                status: 'FAILED',
                // Deliberately vague. Naming the field that disagreed would let
                // someone holding only an ID number probe for the real name and
                // date of birth one attempt at a time.
                message:
                    'The details you entered do not match the national records for that ID number. Please check and try again.',
            },
            { status: 422 }
        )
    }

    const reference = typeof entity.id === 'string' && entity.id ? entity.id : identity.idNumber
    const write = await recordKycVerification(user.id, identity, reference)

    if (write.result === 'ID_TAKEN') {
        await recordKycFailure(user.id, { detail: 'duplicate_national_id' })
        throw new HttpError(
            409,
            'That National ID is already linked to another Swippable account.',
            'KYC_ID_ALREADY_USED'
        )
    }

    return NextResponse.json({
        status: 'VERIFIED',
        message: 'Your identity has been verified. You can now create a virtual card.',
    })
})
