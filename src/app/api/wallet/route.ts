import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, conflict, notFound, readJson, withRouteErrors } from '@/lib/http'
import { getBalanceSeries } from '@/lib/analytics'
import {
    expireStalePendingDeposits,
    getCardAllocationTotals,
    getWalletByUserId,
    linkCryptoAddress,
    listCryptoWallets,
    setPrimaryCryptoAddress,
    sql,
    unlinkCryptoAddress,
    type LinkedWalletRow,
} from '@/lib/db'
import { decimal, percentOf, subtract } from '@/lib/money'
import type { LinkedWallet, WalletAsset, WalletResponse } from '@/types/api'

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

    const [chain, wallets, allocation, totals, series] = await Promise.all([
        getWalletByUserId(user.id),
        listCryptoWallets(user.id),
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
        wallets: wallets.map(serializeWallet),
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

function serializeWallet(row: LinkedWalletRow): LinkedWallet {
    const source = String(row.source ?? 'manual')
    return {
        address: row.base_account_address,
        chain: String(row.chain ?? 'base'),
        source: (['clerk', 'wallet_connect', 'manual'].includes(source) ? source : 'manual') as LinkedWallet['source'],
        verified: Boolean(row.verified),
        isPrimary: Boolean(row.is_primary),
        label: row.label ?? null,
        usdcBalance: decimal(row.usdc_balance),
        linkedAt: new Date(row.created_at).toISOString(),
    }
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

/**
 * Links an address for crypto deposits.
 *
 * Used by the in-app wallet connect flow. A Base or Coinbase Wallet *sign-in*
 * does not need this - Clerk has already proved ownership, so the address is
 * linked automatically on the first authenticated request.
 *
 * An address linked this way is recorded as unverified: connecting a wallet in
 * the browser shows possession of a session, not of the key.
 */
export const POST = withRouteErrors('wallet:post', async (request: Request) => {
    const user = await requireUser()
    const { address, source } = await readJson<{ address?: string; source?: string }>(request)

    const value = address?.trim() ?? ''
    if (!EVM_ADDRESS.test(value)) {
        badRequest('A valid Base (EVM) address is required', 'INVALID_ADDRESS')
    }

    const result = await linkCryptoAddress({
        userId: user.id,
        walletId: randomUUID(),
        address: value,
        source: source === 'wallet_connect' ? 'wallet_connect' : 'manual',
        verified: false,
    })

    if (result.status === 'TAKEN') {
        // Deposits are matched by destination address, so a second claim on one
        // address would send somebody else's money here.
        conflict(
            'That address is already linked to another Swippable account. Use a different address, or contact support if you believe this is yours.',
            'ADDRESS_TAKEN'
        )
    }

    return NextResponse.json({
        message: result.status === 'LINKED' ? 'Wallet linked' : 'Wallet already linked',
        onChainAddress: result.wallet.base_account_address,
        wallet: serializeWallet(result.wallet),
    })
})

/** Promotes one of the user's linked addresses to be the receive address. */
export const PATCH = withRouteErrors('wallet:primary', async (request: Request) => {
    const user = await requireUser()
    const { address } = await readJson<{ address?: string }>(request)

    const value = address?.trim() ?? ''
    if (!EVM_ADDRESS.test(value)) badRequest('A valid address is required', 'INVALID_ADDRESS')

    const ok = await setPrimaryCryptoAddress(user.id, value)
    if (!ok) notFound('That address is not linked to your account')

    return NextResponse.json({ message: 'Primary address updated', onChainAddress: value })
})

/**
 * Unlinks an address.
 *
 * The ledger is untouched: past deposits keep their history. What stops is
 * future matching, so a transfer sent to an unlinked address will arrive
 * unattributed and need manual reconciliation - which the UI warns about.
 */
export const DELETE = withRouteErrors('wallet:unlink', async (request: Request) => {
    const user = await requireUser()

    const address = new URL(request.url).searchParams.get('address')?.trim() ?? ''
    if (!EVM_ADDRESS.test(address)) badRequest('A valid address is required', 'INVALID_ADDRESS')

    const removed = await unlinkCryptoAddress(user.id, address)
    if (!removed) notFound('That address is not linked to your account')

    return NextResponse.json({ message: 'Wallet unlinked' })
})
