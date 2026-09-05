import { NextResponse } from 'next/server'

/**
 * Live crypto spot prices for the landing-page ticker.
 *
 * If CoinGecko is unavailable we serve the last good response (marked stale)
 * or return 503 - never invented prices, which would be indistinguishable from
 * real quotes to anyone reading the page.
 */

const ALLOWED_IDS = new Set(['bitcoin', 'ethereum', 'solana', 'usd-coin', 'tether', 'binancecoin', 'ripple', 'cardano'])
const ALLOWED_CURRENCIES = new Set(['usd', 'eur', 'gbp', 'kes'])
const STALE_TTL_MS = 15 * 60 * 1000

let lastGood: { data: unknown; fetchedAt: number } | null = null

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)

    const ids = (searchParams.get('ids') ?? 'bitcoin,ethereum,solana,usd-coin')
        .split(',')
        .map((id) => id.trim().toLowerCase())
        .filter((id) => ALLOWED_IDS.has(id))

    const currencies = (searchParams.get('vs_currencies') ?? searchParams.get('vs_currency') ?? 'usd')
        .split(',')
        .map((currency) => currency.trim().toLowerCase())
        .filter((currency) => ALLOWED_CURRENCIES.has(currency))

    if (ids.length === 0 || currencies.length === 0) {
        return NextResponse.json({ error: 'No supported ids or currencies requested' }, { status: 400 })
    }

    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${currencies.join(',')}`,
            { headers: { Accept: 'application/json' }, next: { revalidate: 60 } }
        )

        if (!response.ok) throw new Error(`CoinGecko responded ${response.status}`)

        const data = await response.json()
        lastGood = { data, fetchedAt: Date.now() }
        return NextResponse.json(data)
    } catch (error) {
        console.error('[crypto-price] live lookup failed', error)

        if (lastGood && Date.now() - lastGood.fetchedAt < STALE_TTL_MS) {
            return NextResponse.json(lastGood.data, {
                status: 200,
                headers: { 'x-price-stale': String(Math.round((Date.now() - lastGood.fetchedAt) / 1000)) },
            })
        }

        return NextResponse.json({ error: 'Live prices are unavailable' }, { status: 503 })
    }
}
