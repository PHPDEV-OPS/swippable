import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withRouteErrors } from '@/lib/http'
import {
    buildAllocation,
    getActivityBuckets,
    getFlowDeltas,
    type ActivityPeriod,
} from '@/lib/analytics'
import { getCardAllocationTotals, getCardsByUserId, getPreviousBalance, getTransactionsByUserId } from '@/lib/db'
import { decimal, percentChange } from '@/lib/money'
import { serializeCard, serializeTransaction } from '@/lib/serialize'
import type { DashboardSummary } from '@/types/api'

export const dynamic = 'force-dynamic'

const PERIODS: ActivityPeriod[] = ['Day', 'Week', 'Month']

/**
 * Everything the overview screen renders, in one round trip: the three stat
 * tiles with real period-over-period deltas, the activity chart buckets, the
 * card stack, the recent ledger rows, and the wallet allocation split.
 */
export const GET = withRouteErrors('dashboard:summary', async (request: Request) => {
    const user = await requireUser()

    const requested = new URL(request.url).searchParams.get('period') as ActivityPeriod | null
    const period: ActivityPeriod = requested && PERIODS.includes(requested) ? requested : 'Month'

    const balance = decimal(user.wallet_balance)

    const [flows, activity, cards, transactions, allocationTotals, previousBalance] = await Promise.all([
        getFlowDeltas(user.id),
        getActivityBuckets(user.id, period),
        getCardsByUserId(user.id),
        getTransactionsByUserId(user.id, 6),
        getCardAllocationTotals(user.id),
        getPreviousBalance(user.id),
    ])

    const body: DashboardSummary = {
        walletBalance: {
            value: balance,
            previous: previousBalance ?? balance,
            // null until there is a prior snapshot - the UI shows a dash, not a fake delta.
            changePercent: previousBalance === null ? null : percentChange(balance, previousBalance),
        },
        totalIncome: flows.income,
        totalExpense: flows.expense,
        netFlow: flows.net,
        currency: String(user.currency).toUpperCase() === 'KES' ? 'KES' : 'USD',
        cardCount: allocationTotals.total,
        activeCardCount: allocationTotals.active,
        transactionCount: flows.transactionCount,
        activity,
        recentTransactions: transactions.map(serializeTransaction),
        cards: cards.map(serializeCard),
        allocation: buildAllocation(balance, allocationTotals.allocated),
    }

    return NextResponse.json(body)
})
