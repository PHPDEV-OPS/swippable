import { decimal, toMinor, type Decimal } from '@/lib/money'

/**
 * Stripe Issuing virtual-card client.
 *
 * Deliberately mirrors the shape of `@/lib/flutterwave` so the two are
 * interchangeable behind `@/lib/card-provider`. Like that client, it reports
 * itself unconfigured rather than throwing, so a deployment without Stripe keys
 * simply falls through to the other provider.
 *
 * Written against the REST API with `fetch` rather than the SDK, matching the
 * Flutterwave client and keeping the serverless bundle small. Stripe's API is
 * form-encoded, and every monetary value crosses it as an integer of minor
 * units - so amounts are converted through `toMinor`, never through a float.
 */

const BASE = process.env.STRIPE_API_BASE || 'https://api.stripe.com'
const SECRET_KEY = process.env.STRIPE_SECRET_KEY

export function isStripeConfigured(): boolean {
    return Boolean(SECRET_KEY)
}

export class StripeError extends Error {
    detail?: unknown
    /** Stripe's machine-readable code, e.g. `card_declined`. */
    code?: string

    constructor(message: string, detail?: unknown, code?: string) {
        super(message)
        this.name = 'StripeError'
        this.detail = detail
        this.code = code
    }
}

/* ------------------------------------------------------------- transport */

/**
 * Stripe takes `application/x-www-form-urlencoded`, including for nested
 * structures, which it expects as `parent[child][0][key]`.
 */
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

async function call<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string } = { method: 'GET' }
): Promise<T> {
    if (!isStripeConfigured()) {
        throw new StripeError('Stripe credentials are not configured')
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    }

    // Makes a retried issuance safe: Stripe returns the original card rather
    // than minting a second one.
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey

    const body = init.method === 'POST' ? encodeForm(init.body ?? {}).toString() : undefined
    const url = init.method === 'GET' && init.body ? `${BASE}${path}?${encodeForm(init.body)}` : `${BASE}${path}`

    const response = await fetch(url, { method: init.method, headers, body, cache: 'no-store' })
    const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string; code?: string; type?: string } }
        | null

    if (!response.ok) {
        const error = payload?.error
        throw new StripeError(
            error?.message ?? `Stripe request failed (${response.status})`,
            payload,
            error?.code ?? error?.type
        )
    }

    return payload as T
}

/* ---------------------------------------------------------------- shapes */

export interface StripeCard {
    id: string
    last4: string
    expiryMonth: string
    expiryYear: string
    maskedPan: string
    brand: string
    status: string
    raw: unknown
}

interface StripeCardPayload {
    id: string
    last4?: string
    exp_month?: number
    exp_year?: number
    brand?: string
    status?: string
    number?: string
    cvc?: string
    cardholder?: { name?: string }
}

function normaliseCard(payload: StripeCardPayload): StripeCard {
    const last4 = payload.last4 ?? '0000'
    return {
        id: payload.id,
        last4,
        expiryMonth: String(payload.exp_month ?? '').padStart(2, '0'),
        expiryYear: String(payload.exp_year ?? '').slice(-2),
        maskedPan: `**** **** **** ${last4}`,
        brand: (payload.brand ?? 'VISA').toUpperCase(),
        status: (payload.status ?? 'active').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
        raw: payload,
    }
}

/* ------------------------------------------------------------ cardholder */

/**
 * Stripe requires a cardholder before a card can be issued. One is reused per
 * email - looked up rather than cached, since a serverless instance rarely
 * lives long enough for an in-process cache to be worth anything.
 */
async function resolveCardholder(input: { name: string; email: string }): Promise<string> {
    const existing = await call<{ data?: Array<{ id: string }> }>('/v1/issuing/cardholders', {
        method: 'GET',
        body: { email: input.email, limit: 1 },
    })

    const found = existing.data?.[0]?.id
    if (found) return found

    const created = await call<{ id: string }>('/v1/issuing/cardholders', {
        method: 'POST',
        body: {
            name: input.name,
            email: input.email,
            status: 'active',
            type: 'individual',
            // Stripe requires a billing address. Ours is the platform's own,
            // because these are cards issued for the business, not consumers.
            billing: {
                address: {
                    line1: process.env.STRIPE_BILLING_LINE1 || '123 Kimathi Street',
                    city: process.env.STRIPE_BILLING_CITY || 'Nairobi',
                    state: process.env.STRIPE_BILLING_STATE || 'Nairobi',
                    postal_code: process.env.STRIPE_BILLING_POSTAL || '00100',
                    country: process.env.STRIPE_BILLING_COUNTRY || 'US',
                },
            },
        },
    })

    return created.id
}

/* ------------------------------------------------------------ operations */

export async function createVirtualCard(input: {
    amount: Decimal
    currency: string
    billingName: string
    email: string
    reference: string
}): Promise<StripeCard> {
    const cardholder = await resolveCardholder({ name: input.billingName, email: input.email })

    const card = await call<StripeCardPayload>('/v1/issuing/cards', {
        method: 'POST',
        body: {
            cardholder,
            currency: input.currency.toLowerCase(),
            type: 'virtual',
            status: 'active',
            // The allocation is expressed as an all-time spending limit, which
            // is Stripe's equivalent of Flutterwave's per-card balance: an
            // Issuing card draws from the shared issuing balance rather than
            // holding funds of its own.
            spending_controls: {
                spending_limits: [{ amount: Number(toMinor(input.amount)), interval: 'all_time' }],
            },
            metadata: { swippable_reference: input.reference },
        },
        idempotencyKey: input.reference,
    })

    return normaliseCard(card)
}

/**
 * Sets the card's all-time spending limit to a new total.
 *
 * Note this is a *set*, not an *add* - Stripe has no per-card funding call, so
 * the caller passes the resulting allocation rather than a delta.
 */
export async function setSpendingLimit(input: {
    cardId: string
    total: Decimal
    reference: string
}): Promise<void> {
    await call(`/v1/issuing/cards/${input.cardId}`, {
        method: 'POST',
        body: {
            spending_controls: {
                spending_limits: [{ amount: Number(toMinor(input.total)), interval: 'all_time' }],
            },
        },
        idempotencyKey: input.reference,
    })
}

export async function setVirtualCardStatus(cardId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await call(`/v1/issuing/cards/${cardId}`, {
        method: 'POST',
        body: { status: status === 'ACTIVE' ? 'active' : 'inactive' },
    })
}

/** Cancelling is irreversible on Stripe's side, as it is on Flutterwave's. */
export async function terminateVirtualCard(cardId: string): Promise<void> {
    await call(`/v1/issuing/cards/${cardId}`, { method: 'POST', body: { status: 'canceled' } })
}

export interface StripeCardSecrets {
    pan: string
    cvv: string
    expiryMonth: string
    expiryYear: string
    holder: string
}

/**
 * One-off reveal of the full card credentials.
 *
 * As with Flutterwave, nothing here is persisted - the card row holds only the
 * masked pan and last 4, so each reveal is a fresh authenticated call and the
 * sensitive values exist only for the lifetime of the response.
 */
export async function fetchCardSecrets(cardId: string): Promise<StripeCardSecrets> {
    const payload = await call<StripeCardPayload>(`/v1/issuing/cards/${cardId}`, {
        method: 'GET',
        body: { 'expand[0]': 'number', 'expand[1]': 'cvc' },
    })

    if (!payload.number) {
        throw new StripeError(
            'Stripe did not return the card number. Issuing must be activated and the key must be allowed to read card numbers.'
        )
    }

    const normalised = normaliseCard(payload)

    return {
        pan: payload.number,
        cvv: payload.cvc ?? '',
        expiryMonth: normalised.expiryMonth,
        expiryYear: normalised.expiryYear,
        holder: payload.cardholder?.name ?? '',
    }
}

/**
 * Confirms the key works *and* that Issuing is usable on this account.
 * A valid key with Issuing switched off still fails every card call, so a
 * plain "is the key set" check would let the provider look healthier than it is.
 */
export async function checkIssuingAvailable(): Promise<{ ok: boolean; detail: string }> {
    if (!isStripeConfigured()) return { ok: false, detail: 'STRIPE_SECRET_KEY is not set' }

    try {
        await call<{ data?: unknown[] }>('/v1/issuing/cards', { method: 'GET', body: { limit: 1 } })
        return { ok: true, detail: 'Issuing is active on this account' }
    } catch (error) {
        return {
            ok: false,
            detail: error instanceof StripeError ? error.message : 'Stripe was unreachable',
        }
    }
}

export { decimal }
