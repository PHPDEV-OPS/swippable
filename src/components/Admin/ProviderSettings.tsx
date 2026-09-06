'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, RefreshCw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { ApiRequestError } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import { Button, OverrideDialog, Panel, PanelLoader, Pill } from './primitives'

type CardProvider = 'flutterwave' | 'stripe'

interface ProviderSettingsState {
    primary: CardProvider
    failoverEnabled: boolean
    sandboxFallback: boolean
}

interface ProviderHealth {
    provider: CardProvider
    label: string
    configured: boolean
    reachable: boolean
    detail: string
    isPrimary: boolean
}

interface Payload {
    settings: ProviderSettingsState
    health: ProviderHealth[]
}

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

type Pending =
    | { kind: 'PRIMARY'; provider: CardProvider }
    | { kind: 'FAILOVER'; value: boolean }
    | { kind: 'SANDBOX'; value: boolean }

/**
 * Card issuer configuration.
 *
 * Two things are worth being explicit about on this screen:
 *
 *  - "Configured" and "working" are different. A valid Stripe key with Issuing
 *    switched off passes every credential check and fails every card call, so
 *    the health probe hits the Issuing API rather than just checking for a key.
 *  - The order shown is the order actually walked at issuance time, including
 *    the sandbox tail, so what the founder reads here is what will happen.
 */
export function ProviderSettings() {
    const queryClient = useQueryClient()
    const [pending, setPending] = useState<Pending | null>(null)

    const providers = useQuery({
        queryKey: ['admin', 'providers'],
        queryFn: () => request<Payload>('/api/admin/providers'),
        staleTime: 15_000,
    })

    const update = useMutation({
        mutationFn: (body: Partial<ProviderSettingsState> & { reason: string }) =>
            request<Payload>('/api/admin/providers', { method: 'PATCH', body: JSON.stringify(body) }),
        onSuccess: (data) => {
            queryClient.setQueryData(['admin', 'providers'], data)
            queryClient.invalidateQueries({ queryKey: ['admin'] })
        },
    })

    if (providers.isLoading) return <PanelLoader label="Probing card issuers" />
    if (providers.isError || !providers.data) {
        return (
            <Panel>
                <p className="text-[13.5px] text-[#e0293c]">
                    {(providers.error as Error | null)?.message ?? 'Issuer settings could not be loaded.'}
                </p>
            </Panel>
        )
    }

    const { settings, health } = providers.data
    const secondary = (['flutterwave', 'stripe'] as CardProvider[]).find((p) => p !== settings.primary)!
    const primaryHealth = health.find((h) => h.provider === settings.primary)
    const secondaryHealth = health.find((h) => h.provider === secondary)

    const submit = (reason: string) => {
        if (!pending) return
        const body =
            pending.kind === 'PRIMARY'
                ? { primary: pending.provider, reason }
                : pending.kind === 'FAILOVER'
                  ? { failoverEnabled: pending.value, reason }
                  : { sandboxFallback: pending.value, reason }
        update.mutate(body, { onSuccess: () => setPending(null) })
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Card issuers
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        Which provider mints new cards, and what happens when it fails.
                    </p>
                </div>
                <Button variant="ghost" onClick={() => providers.refetch()} loading={providers.isFetching}>
                    <RefreshCw size={14} />
                    Re-probe
                </Button>
            </div>

            {/* Live health. */}
            <div className="grid gap-4 md:grid-cols-2">
                {health.map((entry) => (
                    <Panel key={entry.provider} bodyClassName="p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={cn(
                                        'flex h-9 w-9 items-center justify-center rounded-full text-white',
                                        entry.provider === 'stripe'
                                            ? 'bg-gradient-to-tr from-[#4f3cff] to-[#7a5cff]'
                                            : 'bg-gradient-to-tr from-[#f5a524] to-[#ff8a3d]'
                                    )}
                                >
                                    <CreditCard size={16} />
                                </span>
                                <div>
                                    <p className="text-[14px] font-extrabold text-[#111116] dark:text-white">
                                        {entry.label}
                                    </p>
                                    <p className="text-[11.5px] text-[#a8aab1]">
                                        {entry.isPrimary ? 'Primary issuer' : 'Secondary issuer'}
                                    </p>
                                </div>
                            </div>
                            <Pill tone={entry.reachable ? 'success' : entry.configured ? 'warning' : 'neutral'}>
                                {entry.reachable ? (
                                    <CheckCircle2 size={11} />
                                ) : entry.configured ? (
                                    <AlertTriangle size={11} />
                                ) : (
                                    <XCircle size={11} />
                                )}
                                {entry.reachable ? 'Working' : entry.configured ? 'Configured, failing' : 'Not set up'}
                            </Pill>
                        </div>

                        <p className="mt-3 rounded-xl bg-[#fafafb] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#5c5f68] dark:bg-white/[0.03] dark:text-[#b9bbc2]">
                            {entry.detail}
                        </p>

                        {!entry.isPrimary && (
                            <Button
                                variant="ghost"
                                className="mt-3.5 w-full"
                                onClick={() => setPending({ kind: 'PRIMARY', provider: entry.provider })}
                            >
                                Make {entry.label} primary
                            </Button>
                        )}
                    </Panel>
                ))}
            </div>

            {/* The order actually walked at issuance. */}
            <Panel title="Issuance order" subtitle="Exactly what a new card request will try, in order">
                <ol className="flex flex-wrap items-center gap-2">
                    <li className="flex items-center gap-2">
                        <span className="rounded-full bg-[#f1ebff] px-3.5 py-1.5 text-[12.5px] font-bold text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]">
                            1. {primaryHealth?.label}
                        </span>
                    </li>
                    {settings.failoverEnabled && (
                        <>
                            <ArrowRight size={14} className="text-[#a8aab1]" />
                            <li>
                                <span className="rounded-full bg-[#f2f2f4] px-3.5 py-1.5 text-[12.5px] font-bold text-[#4a4d55] dark:bg-white/[0.07] dark:text-[#b9bbc2]">
                                    2. {secondaryHealth?.label}
                                </span>
                            </li>
                        </>
                    )}
                    {settings.sandboxFallback && (
                        <>
                            <ArrowRight size={14} className="text-[#a8aab1]" />
                            <li>
                                <span className="rounded-full bg-[#fff4e5] px-3.5 py-1.5 text-[12.5px] font-bold text-[#b06f00] dark:bg-[#3a2a08] dark:text-[#ffb84d]">
                                    {settings.failoverEnabled ? '3' : '2'}. Local sandbox card
                                </span>
                            </li>
                        </>
                    )}
                </ol>

                <p className="mt-4 text-[12px] leading-relaxed text-[#81858c]">
                    A provider with no credentials is skipped rather than counted as a failure, so removing a set of
                    keys quietly moves traffic to the other issuer instead of erroring on every request. Each card
                    records the issuer that actually minted it, and every later reveal, pause or limit change is routed
                    back to that same one — providers are never mixed for a single card.
                </p>
            </Panel>

            {/* Toggles. */}
            <Panel title="Behaviour">
                <div className="space-y-3">
                    <ToggleRow
                        label="Automatic failover"
                        description={`When ${primaryHealth?.label} cannot issue a card, retry on ${secondaryHealth?.label} rather than failing the request.`}
                        value={settings.failoverEnabled}
                        onChange={(value) => setPending({ kind: 'FAILOVER', value })}
                    />
                    <ToggleRow
                        label="Sandbox fallback"
                        description="When no issuer can complete the request, still issue a local sandbox card so the ledger stays exercisable. Turn this off in production to fail loudly instead."
                        value={settings.sandboxFallback}
                        onChange={(value) => setPending({ kind: 'SANDBOX', value })}
                    />
                </div>
            </Panel>

            <OverrideDialog
                open={pending !== null}
                onClose={() => setPending(null)}
                destructive={pending?.kind === 'SANDBOX' && pending.value === false}
                title={
                    pending?.kind === 'PRIMARY'
                        ? `Make ${pending.provider === 'stripe' ? 'Stripe Issuing' : 'Flutterwave'} the primary issuer`
                        : pending?.kind === 'FAILOVER'
                          ? `${pending.value ? 'Enable' : 'Disable'} automatic failover`
                          : `${pending?.value ? 'Enable' : 'Disable'} sandbox fallback`
                }
                description={
                    pending?.kind === 'PRIMARY'
                        ? 'Every new card is minted here from the next request. Cards already issued keep their original provider and are unaffected.'
                        : pending?.kind === 'FAILOVER'
                          ? pending.value
                              ? 'A failure on the primary will silently retry on the other issuer, and the card will record which one served it.'
                              : 'A failure on the primary will no longer retry elsewhere.'
                          : pending?.value
                            ? 'Requests that no issuer can serve will produce a local sandbox card instead of failing.'
                            : 'Requests that no issuer can serve will fail outright. Users will see an error rather than getting a card.'
                }
                confirmLabel="Apply"
                loading={update.isPending}
                error={update.error ? (update.error as Error).message : null}
                reasonPlaceholder="e.g. Flutterwave sandbox is down, switching to Stripe for testing"
                onConfirm={submit}
            />
        </div>
    )
}

function ToggleRow({
    label,
    description,
    value,
    onChange,
}: {
    label: string
    description: string
    value: boolean
    onChange: (value: boolean) => void
}) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
            <button
                type="button"
                role="switch"
                aria-checked={value}
                aria-label={label}
                onClick={() => onChange(!value)}
                className={cn(
                    'mt-0.5 h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors',
                    value ? 'bg-[#7042f4]' : 'bg-[#c9cbd2] dark:bg-white/20'
                )}
            >
                <span
                    className={cn(
                        'block h-4 w-4 rounded-full bg-white transition-transform',
                        value ? 'translate-x-4' : 'translate-x-0'
                    )}
                />
            </button>
            <div>
                <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">{label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[#81858c]">{description}</p>
            </div>
        </div>
    )
}
