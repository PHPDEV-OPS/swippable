import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listAdminCards, listAdminTransactions, listAdminUsers } from '@/lib/admin-db'
import { withRouteErrors } from '@/lib/http'
import { formatMoney } from '@/lib/money'
import type { OmnibarKind, OmnibarResponse, OmnibarResult } from '@/types/admin'

export const dynamic = 'force-dynamic'

/**
 * Unified omnibar.
 *
 * The founder pastes whatever the incident handed them - a Clerk id, an M-Pesa
 * receipt, a 0x hash, four digits off the back of a card - and gets the right
 * record without choosing a search mode first. The shape of the string decides
 * where we look, and we fall back to a broad sweep when it is ambiguous.
 */
function detectKind(query: string): OmnibarKind {
    const value = query.trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) return 'CRYPTO'
    // Safaricom receipts are 10 alphanumerics, always uppercase, e.g. SFK4H2J9QR.
    if (/^[A-Z0-9]{10}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) return 'MPESA'
    if (/^ws_CO_\w+$/i.test(value)) return 'MPESA'
    if (/^\d{4}$/.test(value)) return 'CARD'
    if (/^user_[A-Za-z0-9]+$/.test(value)) return 'USER'
    if (value.includes('@')) return 'USER'
    if (/^(mpesa|crypto|swp|flw|devcredit|adminfix)_/i.test(value)) return 'TRANSACTION'
    if (/^\d+$/.test(value)) return 'USER'
    return 'UNKNOWN'
}

const INTERPRETATIONS: Record<OmnibarKind, string> = {
    USER: 'User identity',
    CARD: 'Card last 4 digits',
    MPESA: 'M-Pesa transaction reference',
    CRYPTO: 'Blockchain transaction hash',
    TRANSACTION: 'Ledger transaction id',
    UNKNOWN: 'Free-text sweep',
}

export const GET = withRouteErrors('admin:search', async (request: Request) => {
    await requireAdmin()

    const query = (new URL(request.url).searchParams.get('q') ?? '').trim()
    if (query.length < 2) {
        return NextResponse.json({ query, detected: 'UNKNOWN', results: [] } satisfies OmnibarResponse)
    }

    const detected = detectKind(query)
    const results: OmnibarResult[] = []

    // Users - always searched, since every other record leads back to one.
    if (detected === 'USER' || detected === 'UNKNOWN') {
        const users = await listAdminUsers({ search: query, limit: 6 })
        for (const row of users) {
            results.push({
                kind: 'USER',
                interpretedAs: INTERPRETATIONS.USER,
                title: String(row.name),
                subtitle: `${row.email} • ${formatMoney(row.wallet_balance)} balance`,
                href: `/admin/users/${row.id}`,
                badge: String(row.account_status ?? 'ACTIVE'),
            })
        }
    }

    if (detected === 'CARD' || detected === 'UNKNOWN') {
        const cards = await listAdminCards({ search: query, limit: 6 })
        for (const row of cards) {
            results.push({
                kind: 'CARD',
                interpretedAs: INTERPRETATIONS.CARD,
                title: `•••• ${row.last_4} · ${row.brand}`,
                subtitle: `${row.user_name} • ${formatMoney(row.card_spending_limit)} limit`,
                href: `/admin/cards?card=${encodeURIComponent(String(row.card_id))}`,
                badge: String(row.status),
            })
        }
    }

    if (detected !== 'USER') {
        const transactions = await listAdminTransactions({ search: query, limit: 8 })
        for (const row of transactions) {
            const kind: OmnibarKind =
                row.channel === 'MPESA' ? 'MPESA' : row.channel === 'CRYPTO' ? 'CRYPTO' : 'TRANSACTION'
            results.push({
                kind,
                interpretedAs: INTERPRETATIONS[kind],
                title: `${formatMoney(row.amount)} • ${row.merchant}`,
                subtitle: `${row.user_email} • ${row.tx_id}`,
                href: `/admin/transactions?tx=${encodeURIComponent(String(row.tx_id))}`,
                badge: String(row.status),
            })
        }
    }

    return NextResponse.json({ query, detected, results: results.slice(0, 12) } satisfies OmnibarResponse)
})
