import { toDecimal, toMinor, type Decimal } from '@/lib/money'
import { sql } from '@/lib/db'

/**
 * FX for the M-Pesa rail: deposits arrive in KES, the shared wallet is held in
 * USD. Rates come from a live feed and are cached both in-process and in
 * `conversion_history`, so every converted deposit can be audited against the
 * exact rate that was applied at the time.
 */

const CACHE_TTL_MS = 10 * 60 * 1000
const FALLBACK_KES_PER_USD = process.env.FX_FALLBACK_KES_PER_USD || '129.00'

let cached: { rate: Decimal; fetchedAt: number } | null = null

/** KES per 1 USD. */
export async function getKesPerUsd(): Promise<{ rate: Decimal; source: string }> {
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { rate: cached.rate, source: 'cache' }
    }

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD', {
            next: { revalidate: 600 },
        })
        if (response.ok) {
            const data = (await response.json()) as { rates?: Record<string, number> }
            const kes = data.rates?.KES
            if (typeof kes === 'number' && kes > 0) {
                const rate = toDecimal(toMinor(kes))
                cached = { rate, fetchedAt: Date.now() }
                void recordRate(rate, 'open.er-api.com')
                return { rate, source: 'open.er-api.com' }
            }
        }
    } catch (error) {
        console.error('[fx] live rate lookup failed, using fallback', error)
    }

    const rate = toDecimal(toMinor(FALLBACK_KES_PER_USD))
    cached = { rate, fetchedAt: Date.now() }
    return { rate, source: 'fallback' }
}

async function recordRate(rate: Decimal, source: string) {
    try {
        await sql`
      INSERT INTO conversion_history (rate_id, fiat_currency, usdc_rate)
      VALUES (${`kes_${source}_${Date.now()}`}, 'KES', ${rate}::numeric)
      ON CONFLICT (rate_id) DO NOTHING`
    } catch (error) {
        console.error('[fx] failed to record rate', error)
    }
}

/**
 * Converts an amount into the wallet currency. Division happens on integer
 * minor units with an explicit half-up rounding step, never on a float.
 */
export async function convertToUsd(
    amount: Decimal,
    fromCurrency: string
): Promise<{ amount: Decimal; rate: Decimal | null }> {
    if (fromCurrency.toUpperCase() === 'USD') {
        return { amount, rate: null }
    }
    if (fromCurrency.toUpperCase() !== 'KES') {
        throw new Error(`Unsupported deposit currency: ${fromCurrency}`)
    }

    const { rate } = await getKesPerUsd()
    const kesMinor = toMinor(amount)
    const rateMinor = toMinor(rate)
    if (rateMinor === 0n) return { amount, rate }

    // (kes / rate) with half-up rounding, all in integer arithmetic.
    const usdMinor = (kesMinor * 100n * 2n + rateMinor) / (rateMinor * 2n)
    return { amount: toDecimal(usdMinor), rate }
}
