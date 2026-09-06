import { decimal, toDecimal, toMinor, type Decimal } from '@/lib/money'

/**
 * Stripe Checkout - the acquiring side.
 *
 * Distinct from `@/lib/stripe-issuing`, and worth keeping straight: Issuing
 * *mints* cards the platform hands out, while Checkout *accepts* a card payment
 * from someone. This module is the second one, and it powers the Stripe-hosted
 * test checkout - the one where you pay with 4242 4242 4242 4242 and the money
 * lands as a wallet top-up.
 *
 * It works on a plain Stripe sandbox account with no extra activation, which is
 * why it is the reliable way to exercise card payments end to end while an
 * Issuing application is still pending.
 */

const BASE = process.env.STRIPE_API_BASE || 'https://api.stripe.com'
const SECRET_KEY = process.env.STRIPE_SECRET_KEY

export function isStripeCheckoutConfigured(): boolean {
    return Boolean(SECRET_KEY)
}

export class StripeCheckoutError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'StripeCheckoutError'
    }
}

function encodeForm(value: unknown, prefix = '', out: URLSearchParams = new URLSearchParams()): URLSearchParams {
    if (value === undefined || value === null) return out
    if (Array.isArray(value)) {
        value.forEach((item, index) => encodeForm(item, `${prefix}[${index}]`, out))
        return out
    }
    if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            encodeForm(item, prefix ? `${prefix}[${key}]` : key, out)
        }
        return out
    }
    out.append(prefix, String(value))
    return out
}

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' }): Promise<T> {
    if (!SECRET_KEY) throw new StripeCheckoutError('Stripe credentials are not configured')

    const body = init.method === 'POST' ? encodeForm(init.body ?? {}).toString() : undefined
    const url = init.method === 'GET' && init.body ? `${BASE}${path}?${encodeForm(init.body)}` : `${BASE}${path}`

    const response = await fetch(url, {
        method: init.method,
        headers: {
            Authorization: `Bearer ${SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        cache: 'no-store',
    })

    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    if (!response.ok) {
        throw new StripeCheckoutError(payload?.error?.message ?? `Stripe request failed (${response.status})`)
    }
    return payload as T
}

export interface CheckoutSession {
    id: string
    url: string | null
    /** `open`, `complete` or `expired`. */
    status: string
    /** `paid`, `unpaid` or `no_payment_required`. */
    paymentStatus: string
    amountTotal: Decimal
    currency: string
    metadata: Record<string, string>
}

interface SessionPayload {
    id: string
    url?: string | null
    status?: string
    payment_status?: string
    amount_total?: number
    currency?: string
    metadata?: Record<string, string>
}

function normalise(payload: SessionPayload): CheckoutSession {
    return {
        id: payload.id,
        url: payload.url ?? null,
        status: payload.status ?? 'open',
        paymentStatus: payload.payment_status ?? 'unpaid',
        // Stripe returns minor units; converted through the bigint path so no
        // amount here ever passes through a float.
        amountTotal: toDecimal(BigInt(payload.amount_total ?? 0)),
        currency: (payload.currency ?? 'usd').toUpperCase(),
        metadata: payload.metadata ?? {},
    }
}

/**
 * Creates a hosted Checkout session and returns the URL to send the payer to.
 *
 * `client_reference_id` and the metadata carry our user id, so the confirming
 * request can credit the right wallet without trusting anything the browser
 * hands back on return.
 */
export async function createCheckoutSession(input: {
    userId: number
    email: string
    amount: Decimal
    currency: string
    description: string
    successUrl: string
    cancelUrl: string
}): Promise<CheckoutSession> {
    const minor = toMinor(input.amount)
    if (minor <= 0n) throw new StripeCheckoutError('Amount must be greater than zero')

    const session = await call<SessionPayload>('/v1/checkout/sessions', {
        method: 'POST',
        body: {
            mode: 'payment',
            // Card only: this exists to exercise card payments specifically.
            'payment_method_types[0]': 'card',
            client_reference_id: String(input.userId),
            customer_email: input.email,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            'line_items[0][quantity]': 1,
            'line_items[0][price_data][currency]': input.currency.toLowerCase(),
            'line_items[0][price_data][unit_amount]': Number(minor),
            'line_items[0][price_data][product_data][name]': input.description,
            metadata: { swippable_user_id: String(input.userId), swippable_kind: 'wallet_topup' },
        },
    })

    return normalise(session)
}

export async function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    return normalise(await call<SessionPayload>(`/v1/checkout/sessions/${sessionId}`, { method: 'GET' }))
}

export { decimal }
