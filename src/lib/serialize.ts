import { decimal, percentOf, subtract } from '@/lib/money'
import type { CardRow } from '@/lib/db'
import type {
    AppNotification,
    CardStatus,
    Currency,
    LedgerTransaction,
    TransactionChannel,
    TransactionStatus,
    TransactionType,
    VirtualCard,
} from '@/types/api'

/**
 * Row -> API shaping. Kept in one place so every route returns the same field
 * names and every monetary value crosses the wire as a decimal string.
 */

const CHANNELS: TransactionChannel[] = ['MPESA', 'CRYPTO', 'CARD_TRANSACTION', 'CARD_FUNDING', 'TRANSFER']
const STATUSES: TransactionStatus[] = ['PENDING', 'SUCCESS', 'FAILED']

function asCurrency(value: unknown): Currency {
    return String(value ?? 'USD').toUpperCase() === 'KES' ? 'KES' : 'USD'
}

function asChannel(value: unknown): TransactionChannel {
    const upper = String(value ?? '').toUpperCase() as TransactionChannel
    return CHANNELS.includes(upper) ? upper : 'CARD_TRANSACTION'
}

function asStatus(value: unknown): TransactionStatus {
    const upper = String(value ?? '').toUpperCase()
    if (STATUSES.includes(upper as TransactionStatus)) return upper as TransactionStatus
    // Tolerate legacy lowercase values written before the ledger was normalised.
    if (upper === 'COMPLETED') return 'SUCCESS'
    return 'PENDING'
}

function asType(value: unknown): TransactionType {
    return String(value ?? '').toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT'
}

function asIso(value: unknown): string {
    if (!value) return new Date().toISOString()
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

/** Falls back to the channel when a row predates category tagging. */
export function categoryFor(row: { category?: unknown; channel?: unknown; merchant?: unknown }): string {
    if (row.category) return String(row.category)
    const channel = asChannel(row.channel)
    if (channel === 'MPESA') return 'M-Pesa Deposit'
    if (channel === 'CRYPTO') return 'Crypto Deposit'
    if (channel === 'CARD_FUNDING') return 'Card Funding'
    if (channel === 'TRANSFER') return 'Transfer'
    return 'Card Spending'
}

export function serializeTransaction(row: Record<string, any>): LedgerTransaction {
    return {
        id: Number(row.id),
        txId: String(row.tx_id),
        cardId: row.card_id ? String(row.card_id) : null,
        cardLast4: row.last_4 ? String(row.last_4) : null,
        amount: decimal(row.amount),
        currency: asCurrency(row.currency),
        type: asType(row.type),
        channel: asChannel(row.channel),
        status: asStatus(row.status),
        merchant: String(row.merchant ?? 'Unknown'),
        category: categoryFor(row),
        balanceAfter: row.balance_after === null || row.balance_after === undefined ? null : decimal(row.balance_after),
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        createdAt: asIso(row.created_at),
    }
}

export function serializeCard(row: CardRow & { transaction_count?: number }): VirtualCard {
    const limit = decimal(row.card_spending_limit)
    const spent = decimal(row.total_spent_by_card)
    const last4 = row.last_4 ?? row.masked_pan?.slice(-4) ?? '0000'

    return {
        id: Number(row.id),
        cardId: String(row.card_id),
        flutterwaveCardId: row.flutterwave_card_id ?? null,
        provider: row.provider ?? 'flutterwave',
        brand: row.brand ?? 'MASTERCARD',
        maskedPan: row.masked_pan ?? `**** **** **** ${last4}`,
        last4,
        holder: row.card_holder ?? row.billing_name ?? 'Cardholder',
        expiry: row.expiry_date ?? '',
        type: row.type ?? 'Virtual',
        color: row.color ?? 'from-[#6330cf] via-[#824fed] to-[#5b2bd0]',
        currency: asCurrency(row.currency),
        status: (String(row.status).toUpperCase() === 'PAUSED' ? 'PAUSED' : 'ACTIVE') as CardStatus,
        cardSpendingLimit: limit,
        totalSpentByCard: spent,
        availableToSpend: subtract(limit, spent),
        utilisation: percentOf(spent, limit),
        transactionCount: Number(row.transaction_count ?? 0),
        createdAt: asIso(row.created_at),
    }
}

export function serializeNotification(row: {
    id: number
    title: string
    body: string
    kind: string
    read_at: string | null
    created_at: string
}): AppNotification {
    const kind = String(row.kind).toUpperCase()
    return {
        id: Number(row.id),
        title: row.title,
        body: row.body,
        kind: (['INFO', 'SUCCESS', 'WARNING', 'SECURITY'].includes(kind) ? kind : 'INFO') as AppNotification['kind'],
        read: Boolean(row.read_at),
        createdAt: asIso(row.created_at),
    }
}
