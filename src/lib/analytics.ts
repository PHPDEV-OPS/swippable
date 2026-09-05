import { sql } from '@/lib/db'
import { decimal, percentChange, percentOf, subtract, sum, type Decimal } from '@/lib/money'
import type {
    ActivityBucket,
    AllocationSlice,
    AnalyticsResponse,
    CashflowPoint,
    CategorySlice,
    StatDelta,
    VelocityPoint,
} from '@/types/api'

/**
 * Every figure the dashboard renders is aggregated here, straight out of the
 * ledger. Nothing is estimated or seeded: an account with no activity yields
 * zeroed series, and the UI renders its empty states rather than sample data.
 */

export type ActivityPeriod = 'Day' | 'Week' | 'Month'

const PERIOD_SQL: Record<ActivityPeriod, { interval: string; step: string; label: string }> = {
    // 24 hours in 3-hour slices.
    Day: { interval: '24 hours', step: '3 hours', label: 'HH12 AM' },
    // 7 days, one bar per day.
    Week: { interval: '7 days', step: '1 day', label: 'Dy' },
    // 30 days, one bar per week.
    Month: { interval: '28 days', step: '7 days', label: 'Mon DD' },
}

/**
 * Credit/debit totals bucketed across the requested window, with empty buckets
 * preserved via `generate_series` so the chart keeps a stable X axis.
 */
export async function getActivityBuckets(userId: number, period: ActivityPeriod): Promise<ActivityBucket[]> {
    const { interval, step, label } = PERIOD_SQL[period]

    const rows = await sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('hour', NOW()) - ${interval}::interval,
        date_trunc('hour', NOW()),
        ${step}::interval
      ) AS bucket
    ), windowed AS (
      SELECT b.bucket,
             COUNT(t.id) FILTER (WHERE t.type = 'CREDIT')::int AS credit_count,
             COUNT(t.id) FILTER (WHERE t.type = 'DEBIT')::int AS debit_count,
             COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'CREDIT'), 0)::text AS credit_amount,
             COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEBIT'), 0)::text AS debit_amount
        FROM buckets b
        LEFT JOIN transactions t
          ON t.user_id = ${userId}
         AND t.status = 'SUCCESS'
         AND t.channel <> 'CARD_FUNDING'
         AND t.created_at >= b.bucket
         AND t.created_at < b.bucket + ${step}::interval
       GROUP BY b.bucket
    )
    SELECT bucket, credit_count, debit_count, credit_amount, debit_amount,
           to_char(bucket, ${label}) AS label
      FROM windowed
     ORDER BY bucket`

    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        day: String(row.label).trim(),
        bucket: new Date(row.bucket).toISOString(),
        credit: Number(row.credit_count),
        debit: Number(row.debit_count),
        creditAmount: decimal(row.credit_amount),
        debitAmount: decimal(row.debit_amount),
        total: decimal(row.debit_amount),
    }))
}

/** Income and expense totals for the current period and the one before it. */
export async function getFlowDeltas(userId: number): Promise<{
    income: StatDelta
    expense: StatDelta
    net: Decimal
    transactionCount: number
}> {
    const rows = await sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT' AND created_at >= date_trunc('month', NOW())), 0)::text AS income_now,
      COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT' AND created_at >= date_trunc('month', NOW()) - interval '1 month' AND created_at < date_trunc('month', NOW())), 0)::text AS income_prev,
      COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT' AND created_at >= date_trunc('month', NOW())), 0)::text AS expense_now,
      COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT' AND created_at >= date_trunc('month', NOW()) - interval '1 month' AND created_at < date_trunc('month', NOW())), 0)::text AS expense_prev,
      COUNT(*)::int AS tx_count
    FROM transactions
   WHERE user_id = ${userId} AND status = 'SUCCESS' AND channel <> 'CARD_FUNDING'`

    const row = (rows as unknown as Array<Record<string, any>>)[0]

    const incomeNow = decimal(row.income_now)
    const incomePrev = decimal(row.income_prev)
    const expenseNow = decimal(row.expense_now)
    const expensePrev = decimal(row.expense_prev)

    return {
        income: {
            value: incomeNow,
            previous: incomePrev,
            changePercent: percentChange(incomeNow, incomePrev),
        },
        expense: {
            value: expenseNow,
            previous: expensePrev,
            changePercent: percentChange(expenseNow, expensePrev),
        },
        net: subtract(incomeNow, expenseNow),
        transactionCount: Number(row.tx_count),
    }
}

/** Spend split by category, over the whole ledger. */
const CATEGORY_COLORS = ['#7042f4', '#12b88f', '#f79e1b', '#ef5362', '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e']

export async function getCategoryBreakdown(userId: number, since?: string): Promise<CategorySlice[]> {
    const rows = since
        ? await sql`
        SELECT COALESCE(category, 'Uncategorised') AS name,
               SUM(amount)::text AS amount
          FROM transactions
         WHERE user_id = ${userId} AND type = 'DEBIT' AND status = 'SUCCESS'
           AND channel <> 'CARD_FUNDING'
           AND created_at >= ${since}::timestamptz
         GROUP BY 1
         ORDER BY SUM(amount) DESC
         LIMIT 8`
        : await sql`
        SELECT COALESCE(category, 'Uncategorised') AS name,
               SUM(amount)::text AS amount
          FROM transactions
         WHERE user_id = ${userId} AND type = 'DEBIT' AND status = 'SUCCESS'
           AND channel <> 'CARD_FUNDING'
         GROUP BY 1
         ORDER BY SUM(amount) DESC
         LIMIT 8`

    const list = rows as unknown as Array<{ name: string; amount: string }>
    const total = sum(list.map((row) => row.amount))

    return list.map((row, index) => ({
        name: row.name,
        amount: decimal(row.amount),
        value: percentOf(row.amount, total),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
}

/** Transaction count and volume per day for the last 7 days. */
export async function getWeeklyVelocity(userId: number): Promise<VelocityPoint[]> {
    const rows = await sql`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', NOW()) - interval '6 days',
        date_trunc('day', NOW()),
        interval '1 day'
      ) AS day
    )
    SELECT d.day,
           to_char(d.day, 'Dy') AS label,
           COUNT(t.id)::int AS tx_count,
           COALESCE(SUM(t.amount), 0)::text AS volume
      FROM days d
      LEFT JOIN transactions t
        ON t.user_id = ${userId}
       AND t.status = 'SUCCESS'
       AND t.channel <> 'CARD_FUNDING'
       AND t.created_at >= d.day
       AND t.created_at < d.day + interval '1 day'
     GROUP BY d.day
     ORDER BY d.day`

    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        day: String(row.label).trim(),
        bucket: new Date(row.day).toISOString(),
        transactions: Number(row.tx_count),
        volume: Number(decimal(row.volume)),
        volumeAmount: decimal(row.volume),
    }))
}

const RANGE_CONFIG: Record<AnalyticsResponse['range'], { start: string; step: string; label: string }> = {
    '30d': { start: "date_trunc('day', NOW()) - interval '29 days'", step: '1 day', label: 'Mon DD' },
    '6m': { start: "date_trunc('month', NOW()) - interval '5 months'", step: '1 month', label: 'Mon' },
    ytd: { start: "date_trunc('year', NOW())", step: '1 month', label: 'Mon' },
}

/** Income vs expense over the selected range, one point per bucket. */
export async function getCashflow(userId: number, range: AnalyticsResponse['range']): Promise<CashflowPoint[]> {
    const config = RANGE_CONFIG[range]

    // The range boundaries are drawn from a fixed lookup, never from user input.
    const rows = await sql.query(
        `WITH buckets AS (
       SELECT generate_series(${config.start}, date_trunc('day', NOW()), $2::interval) AS bucket
     )
     SELECT b.bucket,
            to_char(b.bucket, $3) AS label,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'CREDIT'), 0)::text AS income,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEBIT'), 0)::text AS expense
       FROM buckets b
       LEFT JOIN transactions t
         ON t.user_id = $1
        AND t.status = 'SUCCESS'
        AND t.channel <> 'CARD_FUNDING'
        AND t.created_at >= b.bucket
        AND t.created_at < b.bucket + $2::interval
      GROUP BY b.bucket
      ORDER BY b.bucket`,
        [userId, config.step, config.label]
    )

    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        period: String(row.label).trim(),
        bucket: new Date(row.bucket).toISOString(),
        income: Number(decimal(row.income)),
        expense: Number(decimal(row.expense)),
        incomeAmount: decimal(row.income),
        expenseAmount: decimal(row.expense),
    }))
}

export async function getAnalyticsTotals(userId: number, range: AnalyticsResponse['range']) {
    const config = RANGE_CONFIG[range]

    const rows = await sql.query(
        `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::text AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'), 0)::text AS expense,
       COUNT(*)::int AS tx_count,
       COALESCE(AVG(amount), 0)::text AS avg_amount,
       COALESCE(MAX(amount), 0)::text AS max_amount
     FROM transactions
    WHERE user_id = $1 AND status = 'SUCCESS' AND channel <> 'CARD_FUNDING'
      AND created_at >= ${config.start}`,
        [userId]
    )

    const row = (rows as unknown as Array<Record<string, any>>)[0]
    const income = decimal(row.income)
    const expense = decimal(row.expense)

    return {
        income,
        expense,
        net: subtract(income, expense),
        transactionCount: Number(row.tx_count),
        averageTransaction: decimal(row.avg_amount),
        largestTransaction: decimal(row.max_amount),
    }
}

/** How the wallet balance is split between card allocations and free capital. */
export function buildAllocation(balance: Decimal, allocatedToCards: Decimal): AllocationSlice[] {
    const unallocated = subtract(balance, allocatedToCards)
    return [
        { name: 'Allocated to cards', value: allocatedToCards, percent: percentOf(allocatedToCards, balance) },
        { name: 'Available in wallet', value: unallocated, percent: percentOf(unallocated, balance) },
    ]
}

/** Daily closing balance for the wallet chart, reconstructed from the ledger. */
export async function getBalanceSeries(
    userId: number,
    currentBalance: Decimal,
    days: number
): Promise<Array<{ date: string; label: string; value: Decimal }>> {
    const rows = await sql.query(
        `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - ($2::int - 1) * interval '1 day',
         date_trunc('day', NOW()),
         interval '1 day'
       ) AS day
     )
     SELECT d.day,
            to_char(d.day, 'Mon DD') AS label,
            COALESCE((
              SELECT SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE -t.amount END)
                FROM transactions t
               WHERE t.user_id = $1 AND t.status = 'SUCCESS'
                 AND t.channel <> 'CARD_FUNDING'
                 AND t.created_at > d.day + interval '1 day'
            ), 0)::text AS movement_after
       FROM days d
      ORDER BY d.day`,
        [userId, days]
    )

    // Closing balance for a day = today's balance minus everything that moved after it.
    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        date: new Date(row.day).toISOString(),
        label: String(row.label).trim(),
        value: subtract(currentBalance, decimal(row.movement_after)),
    }))
}
