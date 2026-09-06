'use client'

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toMinor } from '@/lib/money'
import type {
    AnalyticsResponse,
    AppNotification,
    DashboardSummary,
    DepositRequest,
    FundCardRequest,
    IssueCardRequest,
    LedgerTransaction,
    MeResponse,
    VirtualCard,
    WalletResponse,
} from '@/types/api'

/**
 * Typed client for every dashboard endpoint.
 *
 * All screens read through these hooks, so a wallet movement anywhere in the
 * app invalidates every dependent view at once and the numbers on screen stay
 * consistent with the database.
 */

export class ApiRequestError extends Error {
    status: number
    code?: string

    constructor(status: number, message: string, code?: string) {
        super(message)
        this.name = 'ApiRequestError'
        this.status = status
        this.code = code
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
        const message =
            (payload as { error?: string } | null)?.error ?? `Request failed with status ${response.status}`
        throw new ApiRequestError(response.status, message, (payload as { code?: string } | null)?.code)
    }

    return payload as T
}

export const queryKeys = {
    me: ['me'] as const,
    wallet: (range: string) => ['wallet', range] as const,
    cards: ['cards'] as const,
    transactions: ['transactions'] as const,
    summary: (period: string) => ['summary', period] as const,
    analytics: (range: string) => ['analytics', range] as const,
    notifications: ['notifications'] as const,
}

/** Anything that moves money invalidates all of these. */
const MONEY_KEYS = [['me'], ['wallet'], ['cards'], ['transactions'], ['summary'], ['analytics'], ['notifications']]

function useInvalidateMoney() {
    const client = useQueryClient()
    return () => {
        MONEY_KEYS.forEach((key) => client.invalidateQueries({ queryKey: key }))
    }
}

type QueryTuning<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>

export function useMe(options?: QueryTuning<MeResponse>) {
    return useQuery({
        queryKey: queryKeys.me,
        queryFn: () => request<MeResponse>('/api/me'),
        staleTime: 15_000,
        ...options,
    })
}

export function useWallet(range: '7D' | '1M' | '1Y' = '7D') {
    return useQuery({
        queryKey: queryKeys.wallet(range),
        queryFn: () => request<WalletResponse>(`/api/wallet?range=${range}`),
        staleTime: 15_000,
        // A deposit awaiting its provider callback settles out-of-band, so the
        // balance refreshes on its own until nothing is in flight.
        refetchInterval: (query) => (toMinor(query.state.data?.pendingDeposits ?? 0) > 0n ? 8000 : false),
        refetchIntervalInBackground: false,
    })
}

/** Chooses which linked address inbound transfers are expected at. */
export function useSetPrimaryWallet() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (address: string) =>
            request<{ onChainAddress: string }>('/api/wallet', {
                method: 'PATCH',
                body: JSON.stringify({ address }),
            }),
        onSuccess: invalidate,
    })
}

/**
 * Unlinks an address. Past deposits keep their history; what stops is future
 * matching, so anything sent afterwards needs manual reconciliation.
 */
export function useUnlinkWallet() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (address: string) =>
            request<{ message: string }>(`/api/wallet?address=${encodeURIComponent(address)}`, {
                method: 'DELETE',
            }),
        onSuccess: invalidate,
    })
}

export function useCards() {
    return useQuery({
        queryKey: queryKeys.cards,
        queryFn: () => request<VirtualCard[]>('/api/cards'),
        staleTime: 15_000,
    })
}

export function useTransactions() {
    return useQuery({
        queryKey: queryKeys.transactions,
        queryFn: () => request<LedgerTransaction[]>('/api/transactions'),
        staleTime: 15_000,
        // Same reasoning as `useWallet`: a pending row is one a provider is
        // still deciding on, so the list keeps itself current until it settles.
        refetchInterval: (query) =>
            (query.state.data ?? []).some((tx) => tx.status === 'PENDING') ? 8000 : false,
        refetchIntervalInBackground: false,
    })
}

export function useDashboardSummary(period: 'Day' | 'Week' | 'Month' = 'Month') {
    return useQuery({
        queryKey: queryKeys.summary(period),
        queryFn: () => request<DashboardSummary>(`/api/dashboard/summary?period=${period}`),
        staleTime: 15_000,
    })
}

export function useAnalytics(range: AnalyticsResponse['range'] = '6m') {
    return useQuery({
        queryKey: queryKeys.analytics(range),
        queryFn: () => request<AnalyticsResponse>(`/api/analytics?range=${range}`),
        staleTime: 15_000,
    })
}

export function useNotifications() {
    return useQuery({
        queryKey: queryKeys.notifications,
        queryFn: () => request<AppNotification[]>('/api/notifications'),
        staleTime: 30_000,
    })
}

/* ------------------------------------------------------------- mutations */

export interface IssueCardResponse {
    card: VirtualCard
    provider: string
    warning?: string
}

export function useIssueCard() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (body: IssueCardRequest) =>
            request<IssueCardResponse>('/api/cards/issue', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

export function useFundCard() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (body: FundCardRequest) =>
            request<{ card: VirtualCard; warning?: string }>('/api/cards/funding', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: invalidate,
    })
}

export function useSetCardStatus() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: ({ cardId, status }: { cardId: string; status: 'ACTIVE' | 'PAUSED' }) =>
            request<VirtualCard>(`/api/cards/${encodeURIComponent(cardId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            }),
        onSuccess: invalidate,
    })
}

export interface RevealedCard {
    pan: string
    cvv: string
    expiry: string
    holder: string
    last4: string
}

/**
 * Fetches the full card number and CVV for a one-off reveal.
 *
 * Deliberately a mutation rather than a query: the result is never cached by
 * React Query, so the sensitive values live only in the component that asked
 * for them and vanish when it unmounts or the user hides the card again.
 */
export function useRevealCard() {
    return useMutation({
        mutationFn: (cardId: string) =>
            request<RevealedCard>(`/api/cards/${encodeURIComponent(cardId)}/secure`, { method: 'POST' }),
        gcTime: 0,
    })
}

export function useDeleteCard() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (cardId: string) =>
            request<{ message: string; released: string }>(`/api/cards/${encodeURIComponent(cardId)}`, {
                method: 'DELETE',
            }),
        onSuccess: invalidate,
    })
}

export interface DepositResponse {
    status: 'PENDING' | 'SUCCESS' | 'DUPLICATE'
    channel?: string
    message: string
    creditedAmount?: string
    checkoutRequestId?: string
    /** Ledger id to poll while the deposit settles out-of-band. */
    txId?: string
    balance?: string
}

export interface DepositStatus {
    txId: string
    status: 'PENDING' | 'SUCCESS' | 'FAILED'
    channel: string
    amount: string
    balance: string
    balanceAfter: string | null
    message: string
    receipt: string | null
}

export function useDeposit() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (body: DepositRequest) =>
            request<DepositResponse>('/api/wallet/deposit', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

/**
 * Polls a pending deposit until it settles.
 *
 * An STK push is confirmed on the user's handset and lands via a webhook
 * seconds later, so without this the balance only moved on a manual refresh -
 * the app looked broken during the exact window the user is watching. Polling
 * stops the moment the row leaves PENDING, and the settled result invalidates
 * every money query so the whole dashboard catches up at once.
 */
export function useDepositStatus(txId: string | null) {
    const invalidate = useInvalidateMoney()
    const settled = useRef(false)

    const query = useQuery({
        queryKey: ['deposit-status', txId],
        queryFn: () => request<DepositStatus>(`/api/wallet/deposit?txId=${encodeURIComponent(txId!)}`),
        enabled: Boolean(txId),
        // Stops as soon as it settles, so a finished deposit costs nothing.
        refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 3000 : false),
        refetchIntervalInBackground: false,
        staleTime: 0,
        // A 404 here is conclusive, not transient.
        retry: false,
    })

    // Refresh the rest of the app exactly once, on the transition to settled.
    useEffect(() => {
        if (!txId) {
            settled.current = false
            return
        }
        const status = query.data?.status
        if ((status === 'SUCCESS' || status === 'FAILED') && !settled.current) {
            settled.current = true
            invalidate()
        }
    }, [txId, query.data?.status, invalidate])

    return query
}

export function useLinkWallet() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (address: string) =>
            request<{ onChainAddress: string }>('/api/wallet', {
                method: 'POST',
                body: JSON.stringify({ address, source: 'wallet_connect' }),
            }),
        onSuccess: invalidate,
    })
}

/**
 * Marks everything read.
 *
 * Applied optimistically so the badge and the unread highlights clear on the
 * click rather than one network round trip later; the cache is rolled back if
 * the request fails.
 */
export function useMarkNotificationsRead() {
    const client = useQueryClient()
    return useMutation({
        mutationFn: () => request<{ message: string; updated: number }>('/api/notifications', { method: 'POST' }),
        onMutate: async () => {
            await client.cancelQueries({ queryKey: queryKeys.notifications })
            const previous = client.getQueryData<AppNotification[]>(queryKeys.notifications)
            client.setQueryData<AppNotification[]>(queryKeys.notifications, (current) =>
                (current ?? []).map((item) => ({ ...item, read: true }))
            )
            return { previous }
        },
        onError: (_error, _vars, context) => {
            if (context?.previous) client.setQueryData(queryKeys.notifications, context.previous)
        },
        onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
    })
}

/** Dismisses notifications - one by id, or the whole list. */
export function useDismissNotifications() {
    const client = useQueryClient()
    return useMutation({
        mutationFn: (target: { id: number } | { scope: 'read' | 'all' }) =>
            request<{ message: string; deleted: number }>('/api/notifications', {
                method: 'DELETE',
                body: JSON.stringify(target),
            }),
        onMutate: async (target) => {
            await client.cancelQueries({ queryKey: queryKeys.notifications })
            const previous = client.getQueryData<AppNotification[]>(queryKeys.notifications)

            client.setQueryData<AppNotification[]>(queryKeys.notifications, (current) => {
                const list = current ?? []
                if ('id' in target) return list.filter((item) => item.id !== target.id)
                if (target.scope === 'all') return []
                return list.filter((item) => !item.read)
            })

            return { previous }
        },
        onError: (_error, _vars, context) => {
            if (context?.previous) client.setQueryData(queryKeys.notifications, context.previous)
        },
        onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
    })
}

/** Development-only wallet top-up, used by the sandbox button in the wallet UI. */
export function useSandboxTopUp() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (amount: string) =>
            request<DepositResponse>('/api/wallet/deposit', {
                method: 'PUT',
                body: JSON.stringify({ amount, channel: 'MPESA' }),
            }),
        onSuccess: invalidate,
    })
}
