/**
 * Superadmin command-center contract.
 *
 * The admin surface is founder-only: there are no roles, queues or agent
 * assignments anywhere in this file. Every operator is a superadmin, so the
 * shapes below describe *overrides* rather than views - each one names the
 * actor, the target and the reason, because every override is written to the
 * audit log before it takes effect.
 *
 * As everywhere else in the app, money crosses the wire as a `Decimal` string.
 */
import type { Decimal } from '@/lib/money'
import type { Currency, KycStatus, TransactionChannel, TransactionStatus } from '@/types/api'

/* --------------------------------------------------------- kill switch */

/**
 * The four independently haltable rails. Engaging the master switch halts all
 * of them; each can also be held down on its own.
 */
export type PlatformRail = 'CARD_MINTING' | 'MPESA_DEPOSITS' | 'CRYPTO_DEPOSITS' | 'CARD_AUTHORISATIONS'

export const PLATFORM_RAILS: PlatformRail[] = [
    'CARD_MINTING',
    'MPESA_DEPOSITS',
    'CRYPTO_DEPOSITS',
    'CARD_AUTHORISATIONS',
]

export const RAIL_LABELS: Record<PlatformRail, string> = {
    CARD_MINTING: 'Card minting',
    MPESA_DEPOSITS: 'M-Pesa deposit rail',
    CRYPTO_DEPOSITS: 'Crypto deposit rail',
    CARD_AUTHORISATIONS: 'Card authorisations',
}

export interface KillSwitchState {
    /** Master switch. When true every rail is halted regardless of its flag. */
    engaged: boolean
    /** Per-rail halts, applied when the master switch is off. */
    rails: Record<PlatformRail, boolean>
    reason: string | null
    engagedBy: string | null
    engagedAt: string | null
    /** Rails actually halted right now, master switch folded in. */
    haltedRails: PlatformRail[]
}

/* -------------------------------------------------- liquidity & revenue */

export interface LiquidityPosition {
    /** Operator-declared treasury figure, synced from the provider console. */
    declared: Decimal
    currency: Currency | 'USDT'
    /** What the ledger says the platform owes against this rail. */
    liability: Decimal
    /** declared - liability. Negative means the rail is under-funded. */
    headroom: Decimal
    /** Percentage of the declared float already committed, 0-100+. */
    utilisation: number
    updatedAt: string | null
    updatedBy: string | null
}

export interface RevenueLine {
    key: 'MPESA_DEPOSIT_FEE' | 'CRYPTO_FX_SPREAD' | 'CARD_CREATION_FEE'
    label: string
    /** Settled volume the fee was applied to. */
    volume: Decimal
    /** Fee rate as a percentage, or a flat amount for card creation. */
    rate: number
    rateKind: 'PERCENT' | 'FLAT'
    /** volume x rate, in USD. */
    earned: Decimal
    count: number
}

export interface CommandCenterOverview {
    killSwitch: KillSwitchState
    liquidity: {
        mpesaFloat: LiquidityPosition
        cryptoHotWallet: LiquidityPosition
        issuerSettlementPool: LiquidityPosition
    }
    revenue: {
        lines: RevenueLine[]
        total: Decimal
        /** Same computation over the previous window, for the delta. */
        previousTotal: Decimal
        changePercent: number | null
        window: RevenueWindow
    }
    platform: {
        totalUsers: number
        activeUsers: number
        frozenUsers: number
        bannedUsers: number
        pendingKyc: number
        totalCards: number
        activeCards: number
        userLiability: Decimal
        pendingDeposits: Decimal
        stuckDeposits: number
        declines24h: number
    }
    /** Settled volume per day for the sparkline, oldest first. */
    volumeSeries: Array<{ date: string; label: string; deposits: number; spend: number }>
}

export type RevenueWindow = '24h' | '7d' | '30d' | 'all'

/* --------------------------------------------------------------- users */

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'BANNED'

export interface AdminUserSummary {
    id: number
    uuid: string
    clerkUserId: string | null
    name: string
    email: string
    imageUrl: string | null
    kycStatus: KycStatus
    accountStatus: AccountStatus
    isAdmin: boolean
    walletBalance: Decimal
    currency: Currency
    cardCount: number
    activeCardCount: number
    lifetimeDeposits: Decimal
    lifetimeSpend: Decimal
    lastSeenAt: string | null
    createdAt: string
}

export interface UserLimits {
    dailyFunding: Decimal
    monthlyFunding: Decimal
    dailySpending: Decimal
    monthlySpending: Decimal
}

/** What the user has already consumed against each limit. */
export interface LimitUsage {
    dailyFunding: Decimal
    monthlyFunding: Decimal
    dailySpending: Decimal
    monthlySpending: Decimal
}

export interface AdminUserDetail extends AdminUserSummary {
    limits: UserLimits
    usage: LimitUsage
    adminNotes: string | null
    kycReviewedAt: string | null
    kycReviewedBy: string | null
    onChainAddress: string | null
    cards: AdminCard[]
    recentTransactions: AdminTransaction[]
    auditTrail: AuditEntry[]
}

/** Body of PATCH /api/admin/users/[id]. Every field is an override. */
export interface UserOverrideRequest {
    /** Free-text justification. Required - it lands in the audit log. */
    reason: string
    kycStatus?: KycStatus
    accountStatus?: AccountStatus
    limits?: Partial<UserLimits>
    adminNotes?: string
    /** Direct wallet movement. Positive credits, negative debits. */
    forceCredit?: Decimal | number
}

/* -------------------------------------------------------- transactions */

export interface AdminTransaction {
    id: number
    txId: string
    userId: number
    userName: string
    userEmail: string
    cardId: string | null
    cardLast4: string | null
    amount: Decimal
    currency: Currency
    type: 'CREDIT' | 'DEBIT'
    channel: TransactionChannel
    status: TransactionStatus
    merchant: string
    category: string
    balanceAfter: Decimal | null
    metadata: Record<string, unknown>
    txHash: string | null
    createdAt: string
    /** Minutes the row has been sitting in PENDING. Null once settled. */
    stuckForMinutes: number | null
}

export interface InterventionRequest {
    txId: string
    action: 'FORCE_RECONCILE' | 'FORCE_FAIL' | 'COMPLETE_WEBHOOK'
    reason: string
    /** M-Pesa receipt captured from the Safaricom portal. */
    mpesaReceipt?: string
    /** On-chain confirmations observed at intervention time. */
    confirmations?: number
}

export interface InterventionResult {
    status: 'SETTLED' | 'FAILED' | 'NOOP'
    txId: string
    creditedAmount: Decimal | null
    balanceAfter: Decimal | null
    message: string
}

/* --------------------------------------------------------------- cards */

export interface AdminCard {
    id: number
    cardId: string
    flutterwaveCardId: string | null
    userId: number
    userName: string
    userEmail: string
    provider: string
    brand: string
    maskedPan: string
    last4: string
    holder: string
    expiry: string
    currency: Currency
    status: string
    spendingLimit: Decimal
    totalSpent: Decimal
    available: Decimal
    utilisation: number
    transactionCount: number
    declineCount: number
    createdAt: string
}

/** The full-PAN payload. Never cached, never logged, never persisted. */
export interface CardRevealResponse {
    pan: string
    cvv: string
    expiry: string
    holder: string
    last4: string
    /** Seconds the client should keep the values on screen before blanking. */
    expiresInSeconds: number
}

/* ------------------------------------------------- decline diagnostics */

/**
 * Processor decline codes, mapped to plain-English operator guidance.
 * The same codes are produced by the live authorisation path and by the
 * simulator, so a rehearsed failure looks exactly like a real one.
 */
export type DeclineCode =
    | 'CARD_NOT_ACTIVE'
    | 'CARD_LIMIT_EXCEEDED'
    | 'INSUFFICIENT_PLATFORM_FLOAT'
    | 'INSUFFICIENT_WALLET_BALANCE'
    | 'BLOCKED_MERCHANT_COUNTRY'
    | 'INVALID_CVV'
    | 'EXPIRED_CARD'
    | 'ACCOUNT_FROZEN'
    | 'RAIL_HALTED'
    | 'DUPLICATE_TRANSACTION'
    | 'UNKNOWN_CARD'

export interface DeclineRecord {
    id: number
    code: DeclineCode
    /** Verbatim processor text, when the provider sent one. */
    processorMessage: string | null
    cardId: string | null
    cardLast4: string | null
    userId: number | null
    userName: string | null
    amount: Decimal
    currency: Currency
    merchant: string
    merchantCountry: string | null
    simulated: boolean
    metadata: Record<string, unknown>
    createdAt: string
}

export interface DeclineDiagnostic {
    code: DeclineCode
    /** Operator-facing title, e.g. "Blocked merchant country". */
    title: string
    /** What actually happened, in one sentence. */
    explanation: string
    /** The concrete next step an operator should take. */
    remedy: string
    /** Whether the platform, the card, or the user caused it. */
    origin: 'PLATFORM' | 'CARD' | 'USER' | 'PROCESSOR'
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
}

/* ----------------------------------------------------------- simulator */

export type SimulationScenario =
    | 'CARD_PAYMENT_APPROVED'
    | 'CARD_PAYMENT_DECLINED'
    | 'CARD_REFUND'
    | 'MPESA_STK_SUCCESS'
    | 'MPESA_STK_FAILURE'
    | 'MPESA_CALLBACK_TIMEOUT'
    | 'CRYPTO_DEPOSIT_CONFIRMED'
    | 'CRYPTO_WEBHOOK_MISSED'

export interface SimulationRequest {
    scenario: SimulationScenario
    /** Target user. Accepts the numeric id, uuid, email or Clerk id. */
    userRef: string
    cardId?: string
    amount: Decimal | number
    currency?: Currency
    merchant?: string
    merchantCountry?: string
    declineCode?: DeclineCode
    /** Writes to the real ledger when false. Defaults to true (dry run). */
    dryRun?: boolean
}

export interface SimulationResult {
    scenario: SimulationScenario
    outcome: 'APPROVED' | 'DECLINED' | 'SETTLED' | 'PENDING' | 'FAILED'
    dryRun: boolean
    txId: string | null
    message: string
    declineCode: DeclineCode | null
    diagnostic: DeclineDiagnostic | null
    balanceBefore: Decimal | null
    balanceAfter: Decimal | null
    /** The provider payload this scenario mimics, for webhook replay. */
    payloadPreview: Record<string, unknown>
    /** Ordered processor steps, so the operator can see where it stopped. */
    trace: Array<{ step: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail: string }>
}

/* ----------------------------------------------------------- audit log */

export type AuditAction =
    | 'KILL_SWITCH_ENGAGED'
    | 'KILL_SWITCH_RELEASED'
    | 'RAIL_HALTED'
    | 'RAIL_RESUMED'
    | 'KYC_OVERRIDE'
    | 'LIMITS_OVERRIDE'
    | 'ACCOUNT_STATUS_OVERRIDE'
    | 'FORCE_CREDIT'
    | 'FORCE_RECONCILE'
    | 'FORCE_FAIL'
    | 'WEBHOOK_COMPLETED'
    | 'CARD_STATUS_OVERRIDE'
    | 'CARD_LIMIT_OVERRIDE'
    | 'CARD_PAN_REVEALED'
    | 'LIQUIDITY_UPDATED'
    | 'PROVIDER_SETTINGS_UPDATED'
    | 'SIMULATION_RUN'
    | 'ADMIN_BOOTSTRAPPED'

export interface AuditEntry {
    id: number
    action: AuditAction
    actorEmail: string
    actorClerkId: string | null
    targetType: 'USER' | 'CARD' | 'TRANSACTION' | 'PLATFORM'
    targetId: string | null
    reason: string | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    ip: string | null
    createdAt: string
}

/* --------------------------------------------------------------- omnibar */

export type OmnibarKind = 'USER' | 'CARD' | 'MPESA' | 'CRYPTO' | 'TRANSACTION' | 'UNKNOWN'

export interface OmnibarResult {
    kind: OmnibarKind
    /** What the parser decided the query was, shown back to the operator. */
    interpretedAs: string
    title: string
    subtitle: string
    /** Admin route this result opens. */
    href: string
    badge: string | null
}

export interface OmnibarResponse {
    query: string
    detected: OmnibarKind
    results: OmnibarResult[]
}

/* ---------------------------------------------------------- admin session */

export interface AdminSession {
    email: string
    name: string
    clerkUserId: string
    userId: number
    imageUrl: string | null
    /** True on the very first sign-in, when the identity ids were linked. */
    bootstrapped: boolean
}
