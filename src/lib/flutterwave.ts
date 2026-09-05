import { decimal, type Decimal } from '@/lib/money'

/**
 * Flutterwave virtual-card client.
 *
 * Supports both credential styles the sandbox hands out:
 *   - v4: CLIENT_ID / CLIENT_SECRET exchanged for a short-lived OAuth token
 *   - v3: a long-lived FLW_SECRET_KEY used as a bearer token
 *
 * When neither is configured the client reports itself unconfigured rather than
 * throwing, so the issuing routes can fall back to a locally-issued sandbox
 * card and the rest of the ledger keeps working end to end.
 */

const V3_BASE = process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3'
const V4_BASE = process.env.FLW_V4_BASE_URL || 'https://api.flutterwave.cloud/developersandbox'
const OAUTH_URL =
    process.env.FLW_OAUTH_URL ||
    'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token'

const SECRET_KEY = process.env.FLW_SECRET_KEY
const CLIENT_ID = process.env.FLW_CLIENT_ID
const CLIENT_SECRET = process.env.FLW_CLIENT_SECRET

export type FlutterwaveMode = 'v3' | 'v4' | 'unconfigured'

export function flutterwaveMode(): FlutterwaveMode {
    if (SECRET_KEY) return 'v3'
    if (CLIENT_ID && CLIENT_SECRET) return 'v4'
    return 'unconfigured'
}

export function isFlutterwaveConfigured(): boolean {
    return flutterwaveMode() !== 'unconfigured'
}

/* --------------------------------------------------------------- v4 token */

let cachedToken: { value: string; expiresAt: number } | null = null

async function getV4Token(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
        return cachedToken.value
    }

    const response = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID!,
            client_secret: CLIENT_SECRET!,
            grant_type: 'client_credentials',
        }),
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new FlutterwaveError(`OAuth token exchange failed (${response.status})`)
    }

    const data = (await response.json()) as { access_token: string; expires_in?: number }
    cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
    }
    return cachedToken.value
}

export class FlutterwaveError extends Error {
    detail?: unknown

    constructor(message: string, detail?: unknown) {
        super(message)
        this.name = 'FlutterwaveError'
        this.detail = detail
    }
}

/* ------------------------------------------------------------ transport */

async function call<T>(path: string, init: { method: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
    const mode = flutterwaveMode()
    if (mode === 'unconfigured') {
        throw new FlutterwaveError('Flutterwave credentials are not configured')
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let url: string

    if (mode === 'v3') {
        url = `${V3_BASE}${path}`
        headers.Authorization = `Bearer ${SECRET_KEY}`
    } else {
        url = `${V4_BASE}${path}`
        headers.Authorization = `Bearer ${await getV4Token()}`
        headers['X-Idempotency-Key'] = init.idempotencyKey ?? crypto.randomUUID()
        headers['X-Trace-Id'] = crypto.randomUUID()
    }

    const response = await fetch(url, {
        method: init.method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
        const message =
            (payload as { message?: string; error?: { message?: string } } | null)?.message ??
            (payload as { error?: { message?: string } } | null)?.error?.message ??
            `Flutterwave request failed (${response.status})`
        throw new FlutterwaveError(message, payload)
    }

    return payload as T
}

/* ---------------------------------------------------------------- shapes */

export interface FlutterwaveCard {
    id: string
    last4: string
    expiryMonth: string
    expiryYear: string
    maskedPan: string
    brand: string
    status: string
    raw: unknown
}

interface FlwCardPayload {
    id?: string
    card_hash?: string
    last_4?: string
    masked_pan?: string
    card_pan?: string
    expiration?: string
    expiry_month?: string
    expiry_year?: string
    card_type?: string
    type?: string
    is_active?: boolean
    status?: string
}

function normaliseCard(payload: FlwCardPayload): FlutterwaveCard {
    const pan = payload.masked_pan ?? payload.card_pan ?? ''
    const last4 = payload.last_4 ?? pan.slice(-4) ?? '0000'

    let expiryMonth = payload.expiry_month ?? ''
    let expiryYear = payload.expiry_year ?? ''
    if (!expiryMonth && payload.expiration) {
        // v4 returns an ISO date for `expiration`.
        const date = new Date(payload.expiration)
        if (!Number.isNaN(date.getTime())) {
            expiryMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
            expiryYear = String(date.getUTCFullYear()).slice(-2)
        }
    }

    return {
        id: String(payload.id ?? payload.card_hash ?? ''),
        last4,
        expiryMonth: expiryMonth.padStart(2, '0'),
        expiryYear: expiryYear.slice(-2),
        maskedPan: pan || `**** **** **** ${last4}`,
        brand: (payload.card_type ?? payload.type ?? 'MASTERCARD').toUpperCase(),
        status: payload.is_active === false ? 'PAUSED' : (payload.status ?? 'ACTIVE').toUpperCase(),
        raw: payload,
    }
}

function unwrap<T>(response: { data?: T; status?: string } | T): T {
    const candidate = response as { data?: T }
    return (candidate?.data ?? response) as T
}

/* ------------------------------------------------------------ operations */

export async function createVirtualCard(input: {
    amount: Decimal
    currency: string
    billingName: string
    email: string
    reference: string
}): Promise<FlutterwaveCard> {
    const mode = flutterwaveMode()

    const body =
        mode === 'v3'
            ? {
                  currency: input.currency,
                  amount: decimal(input.amount),
                  debit_currency: input.currency,
                  billing_name: input.billingName,
                  callback_url: process.env.FLW_CARD_WEBHOOK_URL,
              }
            : {
                  currency: input.currency,
                  amount: decimal(input.amount),
                  card_type: 'MASTERCARD',
                  reference: input.reference,
                  cardholder: {
                      name: input.billingName,
                      email: input.email,
                  },
              }

    const response = await call<{ data?: FlwCardPayload }>('/virtual-cards', {
        method: 'POST',
        body,
        idempotencyKey: input.reference,
    })

    return normaliseCard(unwrap<FlwCardPayload>(response))
}

export async function fundVirtualCard(input: {
    cardId: string
    amount: Decimal
    currency: string
    reference: string
}): Promise<void> {
    await call(`/virtual-cards/${input.cardId}/fund`, {
        method: 'POST',
        body: {
            amount: decimal(input.amount),
            debit_currency: input.currency,
        },
        idempotencyKey: input.reference,
    })
}

export async function withdrawFromVirtualCard(input: {
    cardId: string
    amount: Decimal
    reference: string
}): Promise<void> {
    await call(`/virtual-cards/${input.cardId}/withdraw`, {
        method: 'POST',
        body: { amount: decimal(input.amount) },
        idempotencyKey: input.reference,
    })
}

export async function setVirtualCardStatus(cardId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    const action = status === 'ACTIVE' ? 'unblock' : 'block'
    await call(`/virtual-cards/${cardId}/status/${action}`, { method: 'PUT' })
}

export async function terminateVirtualCard(cardId: string): Promise<void> {
    await call(`/virtual-cards/${cardId}/terminate`, { method: 'PUT' })
}

export interface FlutterwaveCardSecrets {
    pan: string
    cvv: string
    expiryMonth: string
    expiryYear: string
    holder: string
}

/**
 * Fetches the full card credentials from Flutterwave for a one-off reveal.
 *
 * These values are deliberately never persisted - the card row stores only the
 * masked pan and last 4. Each reveal is a fresh authenticated call to the
 * provider, so the sensitive data exists only for the lifetime of the response.
 */
export async function fetchCardSecrets(cardId: string): Promise<FlutterwaveCardSecrets> {
    const response = await call<{ data?: Record<string, any> }>(`/virtual-cards/${cardId}`, {
        method: 'GET',
    })

    const payload = unwrap<Record<string, any>>(response)

    const pan: string = String(payload.card_pan ?? payload.pan ?? payload.card_number ?? '')
    const cvv: string = String(payload.cvv ?? payload.card_cvv ?? payload.security_code ?? '')

    if (!pan) {
        throw new FlutterwaveError('Flutterwave did not return the card number for this card')
    }

    const normalised = normaliseCard(payload as FlwCardPayload)

    return {
        pan,
        cvv,
        expiryMonth: normalised.expiryMonth,
        expiryYear: normalised.expiryYear,
        holder: String(payload.name_on_card ?? payload.cardholder?.name ?? ''),
    }
}

/**
 * Verifies the `verif-hash` header Flutterwave sends with every webhook.
 * Compared in constant time so the check cannot be probed byte by byte.
 */
export function verifyWebhookSignature(received: string | null): boolean {
    const expected = process.env.FLW_SECRET_HASH
    if (!expected) {
        console.error('[flutterwave] FLW_SECRET_HASH is not set - rejecting webhook')
        return false
    }
    if (!received || received.length !== expected.length) return false

    let mismatch = 0
    for (let i = 0; i < expected.length; i += 1) {
        mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i)
    }
    return mismatch === 0
}
