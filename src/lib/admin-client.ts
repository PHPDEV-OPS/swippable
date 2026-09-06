'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiRequestError } from '@/lib/client-api'
import type {
    AdminCard,
    AdminSession,
    AdminTransaction,
    AdminUserDetail,
    AdminUserSummary,
    AuditEntry,
    CardRevealResponse,
    CommandCenterOverview,
    DeclineDiagnostic,
    DeclineRecord,
    InterventionRequest,
    InterventionResult,
    KillSwitchState,
    OmnibarResponse,
    PlatformRail,
    RevenueWindow,
    SimulationRequest,
    SimulationResult,
    UserOverrideRequest,
} from '@/types/admin'

/**
 * Typed client for the command center.
 *
 * Every override invalidates the whole admin cache rather than a narrow key:
 * these actions move money and change account state, and a founder reading a
 * stale liquidity figure straight after a force-credit is a worse failure than
 * a redundant refetch.
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
        const message = (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`
        throw new ApiRequestError(response.status, message, (payload as { code?: string } | null)?.code)
    }

    return payload as T
}

export const adminKeys = {
    session: ['admin', 'session'] as const,
    overview: (window: RevenueWindow) => ['admin', 'overview', window] as const,
    killSwitch: ['admin', 'killswitch'] as const,
    users: (params: string) => ['admin', 'users', params] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    transactions: (params: string) => ['admin', 'transactions', params] as const,
    cards: (params: string) => ['admin', 'cards', params] as const,
    declines: (params: string) => ['admin', 'declines', params] as const,
    audit: ['admin', 'audit'] as const,
    search: (q: string) => ['admin', 'search', q] as const,
}

function useInvalidateAdmin() {
    const client = useQueryClient()
    return () => {
        client.invalidateQueries({ queryKey: ['admin'] })
        // The user-facing dashboard reads the same ledger.
        client.invalidateQueries({ queryKey: ['me'] })
        client.invalidateQueries({ queryKey: ['wallet'] })
    }
}

/* ------------------------------------------------------------- session */

export function useAdminSession() {
    return useQuery({
        queryKey: adminKeys.session,
        queryFn: () => request<AdminSession>('/api/admin/session'),
        // A 404 here means "not a superadmin", which is a settled answer, not
        // a transient failure - retrying only delays the redirect.
        retry: false,
        staleTime: 60_000,
    })
}

/* ------------------------------------------------------------ overview */

export function useAdminOverview(window: RevenueWindow = '30d') {
    return useQuery({
        queryKey: adminKeys.overview(window),
        queryFn: () => request<CommandCenterOverview>(`/api/admin/overview?window=${window}`),
        staleTime: 10_000,
        refetchInterval: 30_000,
    })
}

export function useUpdateTreasury() {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: {
            reason: string
            mpesaFloatKes?: string
            cryptoHotWalletUsd?: string
            issuerSettlementPoolUsd?: string
            fees?: Record<string, number>
        }) => request<{ status: string }>('/api/admin/overview', { method: 'PATCH', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

/* --------------------------------------------------------- kill switch */

export function useKillSwitch() {
    return useQuery({
        queryKey: adminKeys.killSwitch,
        queryFn: () => request<KillSwitchState>('/api/admin/killswitch'),
        staleTime: 5_000,
        refetchInterval: 20_000,
    })
}

export function useSetKillSwitch() {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: { engaged?: boolean; rail?: PlatformRail; halted?: boolean; reason: string }) =>
            request<KillSwitchState>('/api/admin/killswitch', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

/* --------------------------------------------------------------- users */

export function useAdminUsers(params: { q?: string; status?: string; kyc?: string }) {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.status && params.status !== 'ALL') search.set('status', params.status)
    if (params.kyc && params.kyc !== 'ALL') search.set('kyc', params.kyc)
    const qs = search.toString()

    return useQuery({
        queryKey: adminKeys.users(qs),
        queryFn: () => request<AdminUserSummary[]>(`/api/admin/users${qs ? `?${qs}` : ''}`),
        staleTime: 10_000,
    })
}

export function useAdminUser(id: string | null) {
    return useQuery({
        queryKey: adminKeys.user(id ?? 'none'),
        queryFn: () => request<AdminUserDetail>(`/api/admin/users/${id}`),
        enabled: Boolean(id),
        staleTime: 5_000,
    })
}

export function useOverrideUser(id: string) {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: UserOverrideRequest) =>
            request<{ status: string; applied: string[]; user: AdminUserSummary | null }>(`/api/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            }),
        onSuccess: invalidate,
    })
}

/* -------------------------------------------------------- transactions */

export function useAdminTransactions(params: { channel?: string; status?: string; q?: string }) {
    const search = new URLSearchParams()
    if (params.channel && params.channel !== 'ALL') search.set('channel', params.channel)
    if (params.status && params.status !== 'ALL') search.set('status', params.status)
    if (params.q) search.set('q', params.q)
    const qs = search.toString()

    return useQuery({
        queryKey: adminKeys.transactions(qs),
        queryFn: () => request<AdminTransaction[]>(`/api/admin/transactions${qs ? `?${qs}` : ''}`),
        staleTime: 5_000,
        refetchInterval: 20_000,
    })
}

export function useIntervene() {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: InterventionRequest) =>
            request<InterventionResult>('/api/admin/transactions', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

/* --------------------------------------------------------------- cards */

export function useAdminCards(params: { q?: string; status?: string; userId?: number }) {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.status && params.status !== 'ALL') search.set('status', params.status)
    if (params.userId) search.set('userId', String(params.userId))
    const qs = search.toString()

    return useQuery({
        queryKey: adminKeys.cards(qs),
        queryFn: () => request<AdminCard[]>(`/api/admin/cards${qs ? `?${qs}` : ''}`),
        staleTime: 10_000,
    })
}

export function useOverrideCard() {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: { cardId: string; status?: string; spendingLimit?: string; reason: string }) =>
            request<{ status: string; applied: string[]; card: AdminCard | null }>('/api/admin/cards', {
                method: 'PATCH',
                body: JSON.stringify(body),
            }),
        onSuccess: invalidate,
    })
}

/** Deliberately a mutation, never a query: a reveal must never be cached. */
export function useRevealCard() {
    return useMutation({
        mutationFn: ({ cardId, reason }: { cardId: string; reason: string }) =>
            request<CardRevealResponse>(`/api/admin/cards/${encodeURIComponent(cardId)}/reveal`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }),
    })
}

/* ------------------------------------------------------------ declines */

export interface DeclineFeed {
    records: Array<DeclineRecord & { diagnostic: DeclineDiagnostic }>
    breakdown: Array<{ code: string; count: number; amount: string; diagnostic: DeclineDiagnostic }>
    catalogue: Record<string, DeclineDiagnostic>
}

export function useDeclines(params: { cardId?: string; hours?: number } = {}) {
    const search = new URLSearchParams()
    if (params.cardId) search.set('cardId', params.cardId)
    if (params.hours) search.set('hours', String(params.hours))
    const qs = search.toString()

    return useQuery({
        queryKey: adminKeys.declines(qs),
        queryFn: () => request<DeclineFeed>(`/api/admin/declines${qs ? `?${qs}` : ''}`),
        staleTime: 10_000,
    })
}

/* ----------------------------------------------------------- simulator */

export function useSimulate() {
    const invalidate = useInvalidateAdmin()
    return useMutation({
        mutationFn: (body: SimulationRequest & { reason?: string }) =>
            request<SimulationResult>('/api/admin/simulator', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: (result) => {
            // A dry run changes nothing, so leave the cache alone.
            if (!result.dryRun) invalidate()
        },
    })
}

/* --------------------------------------------------------------- audit */

export function useAuditLog(limit = 120) {
    return useQuery({
        queryKey: adminKeys.audit,
        queryFn: () => request<AuditEntry[]>(`/api/admin/audit?limit=${limit}`),
        staleTime: 10_000,
    })
}

/* ------------------------------------------------------------- omnibar */

export function useOmnibar(query: string) {
    return useQuery({
        queryKey: adminKeys.search(query),
        queryFn: () => request<OmnibarResponse>(`/api/admin/search?q=${encodeURIComponent(query)}`),
        enabled: query.trim().length >= 2,
        staleTime: 5_000,
    })
}

export { ApiRequestError }
