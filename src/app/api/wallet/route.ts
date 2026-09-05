import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, readJson, withRouteErrors } from '@/lib/http'
import { getBalanceSeries } from '@/lib/analytics'
import {
    expireStalePendingDeposits,
    getCardAllocationTotals,
    getWalletByUserId,
    sql,
    upsertCryptoWallet,
} from '@/lib/db'
import { decimal, percentOf, subtract } from '@/lib/money'
import type { WalletAsset, WalletResponse } from '@/types/api'

export const dynamic = 'force-dynamic'

const RANGE_DAYS: Record<string, number> = { '7D': 7, '1M': 30, '1Y': 365 }

/**
 * The wallet view: the single shared balance, how much of it is reserved by
 * cards, the linked on-chain address, and the balance series behind the chart.
 * Every figure is derived from the ledger - none of it is sampled.
 */
export const GET = withRouteErrors('wallet:get', async (request: Request) => {
    const user = await requireUser()

    const url = new URL(request.url)
    const range = url.searchParams.get('range') ?? '7D'
    const days = RANGE_DAYS[range] ?? 7

    // Keeps `pendingDeposits` honest - anything past its window is failed first.
    await expireStalePendingDeposits(user.id)

    const balance = decimal(user.wallet_balance)

    const [chain, allocation, totals, series] = await Promise.all([
        getWalletByUserId(user.id),
        getCardAllocationTotals(user.id),
        getDepositTotals(user.id),
        getBalanceSeries(user.id, balance, days),
    ])

    const unallocated = subtract(balance, allocation.allocated)

    const assets: WalletAsset[] = [
        {
            symbol: 'USD',
            name: 'Wallet Balance',
            balance: unallocated,
            valueUsd: unallocated,
            network: 'Swippable Core Wallet',
            allocation: percentOf(unallocated, balance),
        },
        {
            symbol: 'CARDS',
            name: 'Allocated to Cards',
            balance: allocation.allocated,
            valueUsd: allocation.allocated,
            network: 'Swippable Issuing',
            allocation: percentOf(allocation.allocated, balance),
        },
        {
            symbol: 'USDC',
            name: 'USD Coin',
            balance: decimal(chain?.usdc_balance ?? 0),
            valueUsd: decimal(chain?.usdc_balance ?? 0),
            network: 'Base',
            allocation: 0,
        },
    ]

    const body: WalletResponse = {
        balance,
        currency: String(user.currency).toUpperCase() === 'KES' ? 'KES' : 'USD',
        allocatedToCards: allocation.allocated,
        unallocated,
        onChainAddress: chain?.base_account_address ?? null,
        usdcBalance: decimal(chain?.usdc_balance ?? 0),
        totalDeposited: totals.deposited,
        totalSpent: totals.spent,
        pendingDeposits: totals.pending,
        assets,
        series: series.map((point) => ({ date: point.date, label: point.label, value: point.value })),
    }

    return NextResponse.json(body)
})

async function getDepositTotals(userId: number) {
    const rows = await sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT' AND status = 'SUCCESS' AND channel IN ('MPESA','CRYPTO')), 0)::text AS deposited,
      COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT' AND status = 'SUCCESS' AND channel = 'CARD_TRANSACTION'), 0)::text AS spent,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0)::text AS pending
    FROM transactions
   WHERE user_id = ${userId}`

    const row = (rows as unknown as Array<Record<string, string>>)[0]
    return {
        deposited: decimal(row.deposited),
        spent: decimal(row.spent),
        pending: decimal(row.pending),
    }
}

/** Links (or re-links) the user's Base address for crypto deposits. */
export const POST = withRouteErrors('wallet:post', async (request: Request) => {
    const user = await requireUser()
    const { address } = await readJson<{ address?: string }>(request)

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
        badRequest('A valid Base (EVM) address is required', 'INVALID_ADDRESS')
    }

    const wallet = await upsertCryptoWallet(user.id, randomUUID(), address.trim())

    return NextResponse.json({
        message: 'Wallet linked',
        onChainAddress: wallet.base_account_address,
    })
})
