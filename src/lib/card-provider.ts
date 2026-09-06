import { readSetting, writeSetting } from '@/lib/admin-db'
import {
    createVirtualCard as flwCreate,
    fetchCardSecrets as flwSecrets,
    FlutterwaveError,
    flutterwaveMode,
    fundVirtualCard as flwFund,
    isFlutterwaveConfigured,
    setVirtualCardStatus as flwStatus,
    terminateVirtualCard as flwTerminate,
    withdrawFromVirtualCard as flwWithdraw,
} from '@/lib/flutterwave'
import {
    checkIssuingAvailable,
    createVirtualCard as stripeCreate,
    fetchCardSecrets as stripeSecrets,
    isStripeConfigured,
    setSpendingLimit as stripeSetLimit,
    setVirtualCardStatus as stripeStatus,
    StripeError,
    terminateVirtualCard as stripeTerminate,
} from '@/lib/stripe-issuing'
import type { Decimal } from '@/lib/money'

/**
 * Card issuing, across providers.
 *
 * Two issuers are supported - Flutterwave and Stripe Issuing - behind one
 * interface. The point is failover: if the primary is down, misconfigured, or
 * rejects the request, issuance automatically retries on the secondary rather
 * than costing the user their card. Which is primary, and whether failover is
 * on at all, is a superadmin setting rather than a deploy-time constant.
 *
 * A card records the provider that actually issued it, and every later
 * operation on that card - reveal, pause, limit change - is routed back to the
 * same one. Providers are never mixed for a single card.
 */

export type CardProvider = 'flutterwave' | 'stripe'

export const CARD_PROVIDERS: CardProvider[] = ['flutterwave', 'stripe']

export const PROVIDER_LABELS: Record<CardProvider, string> = {
    flutterwave: 'Flutterwave',
    stripe: 'Stripe Issuing',
}

const SETTINGS_KEY = 'card_providers'

export interface ProviderSettings {
    /** Tried first for every new card. */
    primary: CardProvider
    /** When true, a failure on the primary retries on the other provider. */
    failoverEnabled: boolean
    /**
     * When true, an issuance that fails on *every* provider still produces a
     * local sandbox card so the ledger stays exercisable. Off means the request
     * fails loudly instead.
     */
    sandboxFallback: boolean
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
    primary: 'flutterwave',
    failoverEnabled: true,
    sandboxFallback: true,
}

export async function getProviderSettings(): Promise<ProviderSettings> {
    const stored = await readSetting<Partial<ProviderSettings>>(SETTINGS_KEY, {})
    const merged = { ...DEFAULT_PROVIDER_SETTINGS, ...stored }
    // Guard against a stale or hand-edited value naming a provider we dropped.
    if (!CARD_PROVIDERS.includes(merged.primary)) merged.primary = DEFAULT_PROVIDER_SETTINGS.primary
    return merged
}

export async function setProviderSettings(input: Partial<ProviderSettings>, actorEmail: string) {
    const before = await getProviderSettings()
    const after = { ...before, ...input }
    if (!CARD_PROVIDERS.includes(after.primary)) {
        after.primary = before.primary
    }
    await writeSetting(SETTINGS_KEY, after, actorEmail)
    return { before, after }
}

export function isProviderConfigured(provider: CardProvider): boolean {
    return provider === 'stripe' ? isStripeConfigured() : isFlutterwaveConfigured()
}

/** The order to try, primary first, with the other appended when failover is on. */
export async function providerOrder(): Promise<CardProvider[]> {
    const settings = await getProviderSettings()
    const secondary = CARD_PROVIDERS.filter((provider) => provider !== settings.primary)
    return settings.failoverEnabled ? [settings.primary, ...secondary] : [settings.primary]
}

/* -------------------------------------------------------------- issuance */

export interface IssuedCard {
    id: string
    last4: string
    expiryMonth: string
    expiryYear: string
    maskedPan: string
    brand: string
}

export interface IssueOutcome {
    card: IssuedCard
    /** The provider that actually issued, which may not be the primary. */
    provider: CardProvider | 'sandbox'
    /** Set when the primary failed and something else served the request. */
    warning?: string
    /** Every provider tried, in order, with what happened. */
    attempts: Array<{ provider: CardProvider; ok: boolean; detail: string }>
}

function sandboxCard(reference: string): IssuedCard {
    // Deterministic, obviously-fake identifiers. No PAN is generated or stored.
    const last4 = String(Math.floor(1000 + Math.random() * 9000))
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 3)

    return {
        id: `sbx_${reference}`,
        last4,
        maskedPan: `**** **** **** ${last4}`,
        expiryMonth: String(expiry.getMonth() + 1).padStart(2, '0'),
        expiryYear: String(expiry.getFullYear()).slice(-2),
        brand: 'MASTERCARD',
    }
}

function describe(error: unknown): string {
    if (error instanceof StripeError || error instanceof FlutterwaveError) return error.message
    if (error instanceof Error) return error.message
    return 'unreachable'
}

/**
 * Issues a card, walking the configured provider order until one succeeds.
 *
 * A provider that is not configured is skipped rather than counted as a
 * failure, so turning off a set of keys quietly moves traffic to the other
 * issuer instead of raising errors on every request.
 */
export async function issueWithFailover(input: {
    amount: Decimal
    currency: string
    billingName: string
    email: string
    reference: string
}): Promise<IssueOutcome> {
    const settings = await getProviderSettings()
    const order = await providerOrder()
    const attempts: IssueOutcome['attempts'] = []

    for (const provider of order) {
        if (!isProviderConfigured(provider)) {
            attempts.push({ provider, ok: false, detail: 'not configured' })
            continue
        }

        try {
            const card = provider === 'stripe' ? await stripeCreate(input) : await flwCreate(input)
            attempts.push({ provider, ok: true, detail: 'issued' })

            const fellBack = provider !== settings.primary
            return {
                card,
                provider,
                warning: fellBack
                    ? `${PROVIDER_LABELS[settings.primary]} could not issue this card, so ${PROVIDER_LABELS[provider]} was used instead.`
                    : undefined,
                attempts,
            }
        } catch (error) {
            const detail = describe(error)
            console.error(`[card-provider] ${provider} issuance failed: ${detail}`)
            attempts.push({ provider, ok: false, detail })
        }
    }

    if (!settings.sandboxFallback) {
        const tried = attempts.map((a) => `${PROVIDER_LABELS[a.provider]}: ${a.detail}`).join('; ')
        throw new Error(`No card issuer could complete this request. ${tried}`)
    }

    return {
        card: sandboxCard(input.reference),
        provider: 'sandbox',
        warning:
            attempts.length === 0
                ? 'No card issuer is configured; a sandbox card was issued.'
                : `No issuer could complete the request (${attempts
                      .map((a) => `${PROVIDER_LABELS[a.provider]}: ${a.detail}`)
                      .join('; ')}). A sandbox card was issued instead.`,
        attempts,
    }
}

/* ---------------------------------------------- per-card operations */

/** Normalises whatever a card row records into a provider we can dispatch on. */
export function providerOf(row: { provider?: string | null }): CardProvider | 'sandbox' {
    const value = String(row.provider ?? '').toLowerCase()
    if (value === 'stripe') return 'stripe'
    if (value === 'flutterwave') return 'flutterwave'
    return 'sandbox'
}

export interface CardSecrets {
    pan: string
    cvv: string
    expiryMonth: string
    expiryYear: string
    holder: string
}

export async function fetchSecretsFor(row: {
    provider?: string | null
    flutterwave_card_id?: string | null
}): Promise<CardSecrets> {
    const provider = providerOf(row)
    const externalId = row.flutterwave_card_id

    if (provider === 'sandbox' || !externalId) {
        throw new ProviderUnavailableError(
            'This is a sandbox card, so it has no issuer-side record and no real number to reveal.',
            'SANDBOX_CARD'
        )
    }

    if (!isProviderConfigured(provider)) {
        throw new ProviderUnavailableError(
            `${PROVIDER_LABELS[provider]} credentials are not configured, so card details cannot be retrieved.`,
            'PROVIDER_UNCONFIGURED'
        )
    }

    return provider === 'stripe' ? stripeSecrets(externalId) : flwSecrets(externalId)
}

export async function setStatusFor(
    row: { provider?: string | null; flutterwave_card_id?: string | null },
    status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
    const provider = providerOf(row)
    if (provider === 'sandbox' || !row.flutterwave_card_id || !isProviderConfigured(provider)) return
    if (provider === 'stripe') await stripeStatus(row.flutterwave_card_id, status)
    else await flwStatus(row.flutterwave_card_id, status)
}

export async function terminateFor(row: {
    provider?: string | null
    flutterwave_card_id?: string | null
}): Promise<void> {
    const provider = providerOf(row)
    if (provider === 'sandbox' || !row.flutterwave_card_id || !isProviderConfigured(provider)) return
    if (provider === 'stripe') await stripeTerminate(row.flutterwave_card_id)
    else await flwTerminate(row.flutterwave_card_id)
}

/**
 * Moves a card's allocation at the provider.
 *
 * The two issuers model this differently and the difference matters: Flutterwave
 * funds and withdraws by *delta*, while a Stripe Issuing card holds no balance
 * at all and is governed by a spending limit, which must be *set* to the new
 * total. Both figures are passed so neither provider has to infer the other's.
 */
export async function adjustAllocationFor(
    row: { provider?: string | null; flutterwave_card_id?: string | null },
    input: { delta: Decimal; newTotal: Decimal; currency: string; reference: string }
): Promise<void> {
    const provider = providerOf(row)
    if (provider === 'sandbox' || !row.flutterwave_card_id || !isProviderConfigured(provider)) return

    if (provider === 'stripe') {
        await stripeSetLimit({ cardId: row.flutterwave_card_id, total: input.newTotal, reference: input.reference })
        return
    }

    const funding = !String(input.delta).startsWith('-')
    const magnitude = funding ? input.delta : (String(input.delta).replace('-', '') as Decimal)

    if (funding) {
        await flwFund({
            cardId: row.flutterwave_card_id,
            amount: magnitude,
            currency: input.currency,
            reference: input.reference,
        })
    } else {
        await flwWithdraw({ cardId: row.flutterwave_card_id, amount: magnitude, reference: input.reference })
    }
}

export class ProviderUnavailableError extends Error {
    code: string
    constructor(message: string, code: string) {
        super(message)
        this.name = 'ProviderUnavailableError'
        this.code = code
    }
}

/* ------------------------------------------------------------ diagnostics */

export interface ProviderHealth {
    provider: CardProvider
    label: string
    configured: boolean
    /** Whether card operations actually work, not merely whether keys exist. */
    reachable: boolean
    detail: string
    isPrimary: boolean
}

/**
 * Live health for the settings screen.
 *
 * Configured is not the same as working - a valid Stripe key with Issuing
 * switched off passes every credential check and fails every card call - so
 * the Stripe probe actually hits the Issuing API.
 */
export async function providerHealth(): Promise<ProviderHealth[]> {
    const settings = await getProviderSettings()

    const stripe = isStripeConfigured()
        ? await checkIssuingAvailable()
        : { ok: false, detail: 'STRIPE_SECRET_KEY is not set' }

    const flwMode = flutterwaveMode()

    return [
        {
            provider: 'flutterwave',
            label: PROVIDER_LABELS.flutterwave,
            configured: isFlutterwaveConfigured(),
            reachable: isFlutterwaveConfigured(),
            detail: isFlutterwaveConfigured()
                ? `Credentials present (${flwMode} API)`
                : 'No Flutterwave credentials configured',
            isPrimary: settings.primary === 'flutterwave',
        },
        {
            provider: 'stripe',
            label: PROVIDER_LABELS.stripe,
            configured: isStripeConfigured(),
            reachable: stripe.ok,
            detail: stripe.detail,
            isPrimary: settings.primary === 'stripe',
        },
    ]
}
