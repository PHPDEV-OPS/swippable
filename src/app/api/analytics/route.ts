import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withRouteErrors } from '@/lib/http'
import { getAnalyticsTotals, getCashflow, getCategoryBreakdown, getWeeklyVelocity } from '@/lib/analytics'
import type { AnalyticsResponse } from '@/types/api'

export const dynamic = 'force-dynamic'

const RANGES: AnalyticsResponse['range'][] = ['30d', '6m', 'ytd']

/** Cashflow, category split and weekly velocity, aggregated from the ledger. */
export const GET = withRouteErrors('analytics', async (request: Request) => {
    const user = await requireUser()

    const requested = new URL(request.url).searchParams.get('range') as AnalyticsResponse['range'] | null
    const range: AnalyticsResponse['range'] = requested && RANGES.includes(requested) ? requested : '6m'

    const since =
        range === '30d'
            ? new Date(Date.now() - 30 * 86_400_000).toISOString()
            : range === 'ytd'
              ? new Date(new Date().getFullYear(), 0, 1).toISOString()
              : new Date(Date.now() - 182 * 86_400_000).toISOString()

    const [cashflow, categories, velocity, totals] = await Promise.all([
        getCashflow(user.id, range),
        getCategoryBreakdown(user.id, since),
        getWeeklyVelocity(user.id),
        getAnalyticsTotals(user.id, range),
    ])

    const body: AnalyticsResponse = {
        range,
        currency: String(user.currency).toUpperCase() === 'KES' ? 'KES' : 'USD',
        cashflow,
        categories,
        velocity,
        totals,
    }

    return NextResponse.json(body)
})
