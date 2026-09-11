import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Dojah identity-verification client (Kenyan National ID database match).
 *
 * Server-only by construction: the `server-only` import above makes the build
 * fail if this module is ever pulled into a client bundle, so the secret key
 * and AppId cannot leak into the browser even by accident.
 *
 * Like the Flutterwave and M-Pesa clients, this reports itself unconfigured
 * rather than throwing at import time, so a deployment without Dojah keys still
 * boots - KYC simply stays unavailable and the card gate keeps holding.
 */

// `https://dojah.io` is the marketing site and 404s on every API path - the
// API hosts are `sandbox.dojah.io` and `api.dojah.io`. Defaulting to sandbox
// means a misconfigured deployment fails safe against test data rather than
// silently billing (or failing against) production.
const BASE = (process.env.DOJAH_BASE_URL || 'https://sandbox.dojah.io').replace(/\/+$/, '')
const APP_ID = process.env.DOJAH_APP_ID
const SECRET_KEY = process.env.DOJAH_SECRET_KEY
const WEBHOOK_SECRET = process.env.DOJAH_WEBHOOK_SECRET || SECRET_KEY

/**
 * Whether to additionally compare the PII Dojah echoes back against what the
 * user typed, instead of trusting the `is_*_match` flags alone.
 *
 * This matters because the sandbox returns a fixed persona with every
 * `is_*_match` hard-coded to `true` - it will approve any input you send it. So
 * strict mode is on by default everywhere except the sandbox host, and can be
 * forced either way with DOJAH_STRICT_MATCH.
 */
const STRICT_MATCH = process.env.DOJAH_STRICT_MATCH
    ? process.env.DOJAH_STRICT_MATCH === 'true'
    : !BASE.includes('sandbox.')

export function isDojahConfigured(): boolean {
    return Boolean(APP_ID && SECRET_KEY)
}

/** A Dojah call that failed for a reason we can classify. */
export class DojahError extends Error {
    status: number
    /** True when retrying later could plausibly succeed (upstream/rate/network). */
    retryable: boolean

    constructor(message: string, status: number, retryable = false) {
        super(message)
        this.name = 'DojahError'
        this.status = status
        this.retryable = retryable
    }
}

/** The `entity` block Dojah returns for a Kenyan National ID lookup. */
export interface DojahKeIdEntity {
    id?: string
    first_name?: string
    last_name?: string
    middle_name?: string
    gender?: string
    date_of_birth?: string
    is_first_name_match?: boolean
    is_last_name_match?: boolean
    is_middle_name_match?: boolean
    is_date_of_birth_match?: boolean
    is_gender_match?: boolean
}

export interface DojahLookupInput {
    idNumber: string
    firstName: string
    lastName: string
    dob: string
}

/**
 * Calls `GET /api/v1/ke/kyc/id`.
 *
 * The name and DOB are sent alongside the id so Dojah performs the comparison
 * against the national record itself and returns `is_*_match` booleans. We
 * never compare the returned PII locally as the sole source of truth - the
 * upstream flags are authoritative, and we only use our own comparison as a
 * fallback when a flag is absent (see `evaluateMatch`).
 */
export async function lookupKenyanId(input: DojahLookupInput): Promise<DojahKeIdEntity> {
    if (!isDojahConfigured()) {
        throw new DojahError('Identity verification is not configured', 503, true)
    }

    const query = new URLSearchParams({
        id: input.idNumber,
        first_name: input.firstName,
        last_name: input.lastName,
        dob: input.dob,
    })

    let response: Response
    try {
        response = await fetch(`${BASE}/api/v1/ke/kyc/id?${query.toString()}`, {
            method: 'GET',
            headers: {
                // Dojah takes the raw secret - no `Bearer` prefix.
                Authorization: SECRET_KEY!,
                AppId: APP_ID!,
                Accept: 'application/json',
            },
            cache: 'no-store',
        })
    } catch (error) {
        throw new DojahError(
            `Could not reach the identity provider: ${(error as Error).message}`,
            502,
            true
        )
    }

    const payload = (await response.json().catch(() => null)) as
        | { entity?: DojahKeIdEntity; error?: unknown; message?: unknown }
        | null

    if (!response.ok) {
        throw new DojahError(describeUpstreamError(response.status, payload), response.status, isRetryable(response.status))
    }

    // A 200 with no entity means the lookup ran but matched no record.
    if (!payload?.entity || typeof payload.entity !== 'object') {
        throw new DojahError('No identity record was found for that ID number', 404, false)
    }

    return payload.entity
}

/** Maps an upstream status onto a message that is safe to show a user. */
function describeUpstreamError(status: number, payload: { error?: unknown; message?: unknown } | null): string {
    switch (status) {
        case 400:
            return 'The details supplied were rejected by the identity provider. Check the ID number and date of birth.'
        case 401:
            return 'Identity verification is misconfigured. Please contact support.'
        case 402:
            return 'Identity verification is temporarily unavailable. Please try again later.'
        case 404:
            return 'No identity record was found for that ID number'
        case 424:
            return 'The national identity database is unavailable right now. Please try again shortly.'
        case 429:
            return 'Too many verification attempts. Please wait a moment and try again.'
        default: {
            // Never surface the raw upstream body - it can carry PII or internals.
            const detail = typeof payload?.error === 'string' ? payload.error : null
            return detail && detail.length < 120
                ? detail
                : 'Identity verification failed. Please try again later.'
        }
    }
}

/** 402 is a wallet problem, not a user problem, so it is worth retrying too. */
function isRetryable(status: number): boolean {
    return status === 402 || status === 424 || status === 429 || status >= 500
}

export interface MatchResult {
    matched: boolean
    /** Field names that did not match, for logging - never shown to the user. */
    mismatched: string[]
}

/**
 * Decides whether an entity constitutes a pass.
 *
 * We require first name, last name and date of birth to all match. Middle name
 * and gender are deliberately ignored: we never asked the user for them, so a
 * `false` there says nothing about whether this is the right person.
 *
 * If Dojah omits a flag we fall back to comparing the value it returned, and if
 * neither is available the field counts as a mismatch. Failing closed matters
 * here - a missing flag must never read as a pass.
 *
 * Under `STRICT_MATCH` the returned value must agree too, so a provider that
 * reports a pass while echoing a different person is still caught.
 */
export function evaluateMatch(entity: DojahKeIdEntity, input: DojahLookupInput): MatchResult {
    const mismatched: string[] = []

    const check = (field: string, flag: boolean | undefined, returned: string | undefined, expected: string) => {
        const valueAgrees = returned ? normalise(returned) === normalise(expected) : null

        if (typeof flag === 'boolean') {
            if (!flag) {
                mismatched.push(field)
                return
            }
            // Flag says pass. In strict mode a returned value that disagrees
            // overrides it - we would rather reject a real customer than issue
            // a card against someone else's identity.
            if (STRICT_MATCH && valueAgrees === false) mismatched.push(field)
            return
        }

        if (valueAgrees) return
        mismatched.push(field)
    }

    check('first_name', entity.is_first_name_match, entity.first_name, input.firstName)
    check('last_name', entity.is_last_name_match, entity.last_name, input.lastName)
    check('date_of_birth', entity.is_date_of_birth_match, entity.date_of_birth, input.dob)

    return { matched: mismatched.length === 0, mismatched }
}

function normalise(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Verifies the `x-dojah-signature` header: HMAC-SHA256 of the raw body bytes,
 * keyed with the secret. Compared in constant time so a timing side channel
 * cannot be used to forge a signature byte by byte.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!WEBHOOK_SECRET || !signature) return false

    const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex')
    const received = signature.trim().toLowerCase()

    // timingSafeEqual throws on a length mismatch, which is itself a rejection.
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(received, 'utf8')
    if (a.length !== b.length) return false

    return timingSafeEqual(a, b)
}
