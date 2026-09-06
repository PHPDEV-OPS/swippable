/**
 * Shared client/server contract for every dashboard surface.
 *
 * Every monetary field is a `Decimal` (a canonical "0.00" string) rather than
 * a number, so values survive the trip from Postgres NUMERIC to the browser
 * without passing through a float.
 */
import type { Decimal } from '@/lib/money'

export type { Decimal }

export type Currency = 'USD' | 'KES'
export type TransactionType = 'CREDIT' | 'DEBIT'
export type TransactionChannel = 'MPESA' | 'CRYPTO' | 'STRIPE' | 'CARD_TRANSACTION' | 'CARD_FUNDING' | 'TRANSFER'
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED'
export type CardStatus = 'ACTIVE' | 'PAUSED'
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface MeResponse {
    id: number
    clerkUserId: string
    name: string
    email: string
    imageUrl: string | null
    kycStatus: KycStatus
    walletBalance: Decimal
    currency: Currency
    createdAt: string
}

export interface VirtualCard {
    id: number
    cardId: string
    flutterwaveCardId: string | null
    provider: string
    brand: string
    maskedPan: string
    last4: string
    holder: string
    expiry: string
    type: string
    color: string
    currency: Currency
    status: CardStatus
    /** Capital allocated to this card out of the shared wallet. */
    cardSpendingLimit: Decimal
    /** Lifetime authorised spend on this card. */
    totalSpentByCard: Decimal
    /** cardSpendingLimit - totalSpentByCard. */
    availableToSpend: Decimal
    /** Percentage of the limit consumed, 0-100. */
    utilisation: number
    transactionCount: number
    createdAt: string
}

export interface LedgerTransaction {
    id: number
    txId: string
    cardId: string | null
    cardLast4: string | null
    amount: Decimal
    currency: Currency
    type: TransactionType
    channel: TransactionChannel
    status: TransactionStatus
    merchant: string
    category: string
    balanceAfter: Decimal | null
    metadata: Record<string, unknown>
    createdAt: string
}

export interface WalletResponse {
    balance: Decimal
    currency: Currency
    /** Sum of every card's remaining allocation. */
    allocatedToCards: Decimal
    /** balance - allocatedToCards. */
    unallocated: Decimal
    onChainAddress: string | null
    usdcBalance: Decimal
    totalDeposited: Decimal
    totalSpent: Decimal
    pendingDeposits: Decimal
    assets: WalletAsset[]
    series: BalancePoint[]
}

export interface WalletAsset {
    symbol: string
    name: string
    balance: Decimal
    valueUsd: Decimal
    network: string
    allocation: number
}

export interface BalancePoint {
    date: string
    label: string
    value: Decimal
}

export interface StatDelta {
    value: Decimal
    /** null when there is no comparable prior period. */
    changePercent: number | null
    previous: Decimal
}

export interface DashboardSummary {
    walletBalance: StatDelta
    totalIncome: StatDelta
    totalExpense: StatDelta
    netFlow: Decimal
    currency: Currency
    cardCount: number
    activeCardCount: number
    transactionCount: number
    activity: ActivityBucket[]
    recentTransactions: LedgerTransaction[]
    cards: VirtualCard[]
    allocation: AllocationSlice[]
}

export interface ActivityBucket {
    /** Bucket key used on the X axis, e.g. "Mon" or "12 PM". */
    day: string
    /** ISO timestamp of the bucket start, for stable ordering. */
    bucket: string
    credit: number
    debit: number
    creditAmount: Decimal
    debitAmount: Decimal
    total: Decimal
}

export interface AllocationSlice {
    name: string
    value: Decimal
    percent: number
}

export interface AnalyticsResponse {
    range: '30d' | '6m' | 'ytd'
    currency: Currency
    cashflow: CashflowPoint[]
    categories: CategorySlice[]
    velocity: VelocityPoint[]
    totals: {
        income: Decimal
        expense: Decimal
        net: Decimal
        transactionCount: number
        averageTransaction: Decimal
        largestTransaction: Decimal
    }
}

export interface CashflowPoint {
    period: string
    bucket: string
    income: number
    expense: number
    incomeAmount: Decimal
    expenseAmount: Decimal
}

export interface CategorySlice {
    name: string
    amount: Decimal
    value: number
    color: string
}

export interface VelocityPoint {
    day: string
    bucket: string
    transactions: number
    volume: number
    volumeAmount: Decimal
}

export interface AppNotification {
    id: number
    title: string
    body: string
    kind: 'INFO' | 'SUCCESS' | 'WARNING' | 'SECURITY'
    read: boolean
    createdAt: string
}

export interface IssueCardRequest {
    holder?: string
    amount: Decimal | number
    currency?: Currency
    color?: string
    type?: string
}

export interface FundCardRequest {
    cardId: string
    /** Positive to move wallet capital onto the card, negative to pull it back. */
    amount: Decimal | number
    action?: 'FUND' | 'WITHDRAW' | 'SET_LIMIT'
}

export interface DepositRequest {
    channel: 'MPESA' | 'CRYPTO'
    amount: Decimal | number
    currency?: Currency
    phone?: string
    txHash?: string
    address?: string
}

export interface ApiError {
    error: string
    code?: string
}
