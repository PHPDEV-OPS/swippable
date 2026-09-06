import { decimal, percentOf, subtract } from '@/lib/money'
import { categoryFor } from '@/lib/serialize'
import type { Currency, KycStatus, TransactionChannel, TransactionStatus } from '@/types/api'
import type { AccountStatus, AdminCard, AdminTransaction, AdminUserSummary } from '@/types/admin'

/** Row -> admin API shaping. Mirrors `@/lib/serialize`, widened across users. */

function asCurrency(value: unknown): Currency {
    return String(value ?? 'USD').toUpperCase() === 'KES' ? 'KES' : 'USD'
}

function asIso(value: unknown): string {
    if (!value) return new Date().toISOString()
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function asKyc(value: unknown): KycStatus {
    const upper = String(value ?? 'PENDING').toUpperCase()
    return upper === 'VERIFIED' || upper === 'REJECTED' ? (upper as KycStatus) : 'PENDING'
}

function asAccountStatus(value: unknown): AccountStatus {
    const upper = String(value ?? 'ACTIVE').toUpperCase()
    return upper === 'FROZEN' || upper === 'BANNED' ? (upper as AccountStatus) : 'ACTIVE'
}

export function serializeAdminUser(row: Record<string, any>): AdminUserSummary {
    return {
        id: Number(row.id),
        uuid: String(row.uuid),
        clerkUserId: row.clerk_user_id ?? null,
        name: String(row.name),
        email: String(row.email),
        imageUrl: row.image ?? null,
        kycStatus: asKyc(row.kyc_status),
        accountStatus: asAccountStatus(row.account_status),
        isAdmin: Boolean(row.is_admin),
        walletBalance: decimal(row.wallet_balance),
        currency: asCurrency(row.currency),
        cardCount: Number(row.card_count ?? 0),
        activeCardCount: Number(row.active_card_count ?? 0),
        lifetimeDeposits: decimal(row.lifetime_deposits),
        lifetimeSpend: decimal(row.lifetime_spend),
        lastSeenAt: row.last_seen_at ? asIso(row.last_seen_at) : null,
        createdAt: asIso(row.created_at),
    }
}

export function serializeAdminTransaction(row: Record<string, any>): AdminTransaction {
    const status = String(row.status ?? 'PENDING').toUpperCase() as TransactionStatus
    return {
        id: Number(row.id),
        txId: String(row.tx_id),
        userId: Number(row.user_id),
        userName: String(row.user_name ?? 'Unknown'),
        userEmail: String(row.user_email ?? ''),
        cardId: row.card_id ?? null,
        cardLast4: row.last_4 ?? null,
        amount: decimal(row.amount),
        currency: asCurrency(row.currency),
        type: String(row.type).toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT',
        channel: String(row.channel ?? 'CARD_TRANSACTION').toUpperCase() as TransactionChannel,
        status: (['PENDING', 'SUCCESS', 'FAILED'] as string[]).includes(status) ? status : 'PENDING',
        merchant: String(row.merchant ?? 'Unknown'),
        category: categoryFor(row),
        balanceAfter: row.balance_after === null || row.balance_after === undefined ? null : decimal(row.balance_after),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        txHash: row.tx_hash ?? null,
        createdAt: asIso(row.created_at),
        stuckForMinutes:
            row.stuck_minutes === null || row.stuck_minutes === undefined ? null : Math.round(Number(row.stuck_minutes)),
    }
}

export function serializeAdminCard(row: Record<string, any>): AdminCard {
    const limit = decimal(row.card_spending_limit)
    const spent = decimal(row.total_spent_by_card)
    const last4 = row.last_4 ?? String(row.masked_pan ?? '').slice(-4) ?? '0000'

    return {
        id: Number(row.id),
        cardId: String(row.card_id),
        flutterwaveCardId: row.flutterwave_card_id ?? null,
        userId: Number(row.user_id),
        userName: String(row.user_name ?? 'Unknown'),
        userEmail: String(row.user_email ?? ''),
        provider: String(row.provider ?? 'flutterwave'),
        brand: String(row.brand ?? 'MASTERCARD'),
        maskedPan: row.masked_pan ?? `**** **** **** ${last4}`,
        last4,
        holder: row.card_holder ?? row.billing_name ?? 'Cardholder',
        expiry: row.expiry_date ?? '',
        currency: asCurrency(row.currency),
        status: String(row.status ?? 'ACTIVE').toUpperCase(),
        spendingLimit: limit,
        totalSpent: spent,
        available: subtract(limit, spent),
        utilisation: percentOf(spent, limit),
        transactionCount: Number(row.transaction_count ?? 0),
        declineCount: Number(row.decline_count ?? 0),
        createdAt: asIso(row.created_at),
    }
}
