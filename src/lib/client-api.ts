'use client'

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
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
    balance?: string
}

export function useDeposit() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (body: DepositRequest) =>
            request<DepositResponse>('/api/wallet/deposit', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: invalidate,
    })
}

export function useLinkWallet() {
    const invalidate = useInvalidateMoney()
    return useMutation({
        mutationFn: (address: string) =>
            request<{ onChainAddress: string }>('/api/wallet', {
                method: 'POST',
                body: JSON.stringify({ address }),
            }),
        onSuccess: invalidate,
    })
}

export function useMarkNotificationsRead() {
    const client = useQueryClient()
    return useMutation({
        mutationFn: () => request<{ message: string }>('/api/notifications', { method: 'POST' }),
        onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
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
