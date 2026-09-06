'use client'

import {
    CreditCard,
    Eye,
    EyeOff,
    Lock,
    Pause,
    Play,
    Search,
    ShieldCheck,
    Sliders,
    Stethoscope,
    XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAdminCards, useDeclines, useOverrideCard, useRevealCard } from '@/lib/admin-client'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AdminCard, DeclineDiagnostic } from '@/types/admin'
import {
    Button,
    EmptyState,
    Field,
    Meter,
    OverrideDialog,
    Panel,
    PanelLoader,
    Pill,
    StatusPill,
    TimeAgo,
    inputClass,
} from './primitives'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'PAUSED', 'CLOSED'] as const

/* --------------------------------------------------------- PAN reveal */

/**
 * The reveal workflow.
 *
 * Nothing sensitive is ever on screen by default and nothing is ever cached:
 * the PAN and CVV are fetched fresh from the issuer by an explicit POST, held
 * only in component state, and blanked automatically once the countdown
 * expires. The reason typed into the dialog is written to the audit log before
 * the issuer call is even made, and the cardholder is notified that support
 * looked - which is what makes this accountable rather than merely logged.
 */
function RevealPane({ card, onClose }: { card: AdminCard; onClose: () => void }) {
    const reveal = useRevealCard()
    const [asking, setAsking] = useState(true)
    const [remaining, setRemaining] = useState(0)
    const secrets = reveal.data

    useEffect(() => {
        if (!secrets) return
        setRemaining(secrets.expiresInSeconds)
        const timer = setInterval(() => {
            setRemaining((value) => {
                if (value <= 1) {
                    clearInterval(timer)
                    // Blank the values rather than merely hiding them.
                    reveal.reset()
                    return 0
                }
                return value - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [secrets, reveal])

    return (
        <>
            <OverrideDialog
                open={asking && !secrets}
                onClose={() => {
                    setAsking(false)
                    onClose()
                }}
                destructive
                title={`Reveal full card details for •••• ${card.last4}`}
                description="The number and CVV are pulled live from the issuer, shown for 30 seconds, then blanked. This is written to the audit log and the cardholder is notified that support viewed their card."
                confirmLabel="Reveal for 30 seconds"
                loading={reveal.isPending}
                error={reveal.error ? (reveal.error as Error).message : null}
                reasonPlaceholder="e.g. Cardholder on a call, re-entering details after a CVV decline"
                onConfirm={(reason) => reveal.mutate({ cardId: card.cardId, reason })}
            />

            {secrets && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#e0293c]/25 bg-white shadow-2xl dark:bg-[#131315]">
                        <header className="flex items-center justify-between gap-3 bg-[#e0293c] px-5 py-3 text-white">
                            <span className="flex items-center gap-2 text-[12.5px] font-black uppercase tracking-[0.08em]">
                                <Lock size={14} />
                                Sensitive — auto-hides in {remaining}s
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    reveal.reset()
                                    onClose()
                                }}
                                className="cursor-pointer text-white/85 transition-colors hover:text-white"
                                aria-label="Hide now"
                            >
                                <EyeOff size={16} />
                            </button>
                        </header>

                        <div className="space-y-4 p-5">
                            <div className="rounded-2xl bg-gradient-to-br from-[#6330cf] via-[#824fed] to-[#5b2bd0] p-5 text-white">
                                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                                    Card number
                                </p>
                                <p className="mt-1.5 font-mono text-[21px] font-bold tracking-[0.08em]">
                                    {secrets.pan.replace(/(.{4})/g, '$1 ').trim()}
                                </p>
                                <div className="mt-5 flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                                            Holder
                                        </p>
                                        <p className="mt-0.5 text-[13px] font-bold">{secrets.holder}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                                            Expires
                                        </p>
                                        <p className="mt-0.5 font-mono text-[13px] font-bold">{secrets.expiry}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                                            CVV
                                        </p>
                                        <p className="mt-0.5 font-mono text-[13px] font-bold">{secrets.cvv}</p>
                                    </div>
                                </div>
                            </div>

                            <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#81858c]">
                                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#12b88f]" />
                                These values were never stored by Swippable — only the masked number and last four are
                                held in the database. Nothing here is cached or logged.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/* ---------------------------------------------------- decline pane */

const ORIGIN_TONE = {
    PLATFORM: 'danger',
    CARD: 'warning',
    USER: 'neutral',
    PROCESSOR: 'brand',
} as const

function DiagnosticCard({
    diagnostic,
    meta,
}: {
    diagnostic: DeclineDiagnostic
    meta: React.ReactNode
}) {
    return (
        <div
            className={cn(
                'rounded-2xl border p-4',
                diagnostic.severity === 'CRITICAL'
                    ? 'border-[#e0293c]/25 bg-[#fff8f8] dark:border-[#e0293c]/25 dark:bg-[#e0293c]/[0.05]'
                    : 'border-black/[0.06] dark:border-white/[0.08]'
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13.5px] font-extrabold text-[#111116] dark:text-white">
                            {diagnostic.title}
                        </h3>
                        <Pill tone={ORIGIN_TONE[diagnostic.origin]}>{diagnostic.origin}</Pill>
                        {diagnostic.severity === 'CRITICAL' && <Pill tone="danger">Critical</Pill>}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[#a8aab1]">{diagnostic.code}</p>
                </div>
                {meta}
            </div>

            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#4a4d55] dark:text-[#b9bbc2]">
                {diagnostic.explanation}
            </p>
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-[#f1ebff] px-3 py-2 text-[12px] leading-relaxed text-[#4b249f] dark:bg-[#6330cf]/15 dark:text-[#c8b3ff]">
                <Stethoscope size={13} className="mt-0.5 shrink-0" />
                <span>
                    <span className="font-bold">Do this: </span>
                    {diagnostic.remedy}
                </span>
            </p>
        </div>
    )
}

/**
 * The decline diagnostic pane.
 *
 * A processor hands you "51" or "already recorded"; that is worth nothing at
 * 2am. Every code is resolved through one shared catalogue into what happened
 * and what to do next, and the live authorisation path and the simulator both
 * write through that same catalogue — so a rehearsed decline reads identically
 * to a real one.
 */
function DeclineDiagnostics({ cardId }: { cardId?: string }) {
    const declines = useDeclines({ cardId })

    if (declines.isLoading) return <PanelLoader label="Reading decline history" />

    const records = declines.data?.records ?? []
    const breakdown = declines.data?.breakdown ?? []

    return (
        <div className="space-y-4">
            {breakdown.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {breakdown.map((entry) => (
                        <div
                            key={entry.code}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafb] px-3.5 py-2.5 dark:bg-white/[0.03]"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                    {entry.diagnostic.title}
                                </span>
                                <span className="block text-[11px] text-[#81858c]">
                                    {formatMoney(entry.amount)} blocked
                                </span>
                            </span>
                            <Pill tone={entry.diagnostic.severity === 'CRITICAL' ? 'danger' : 'neutral'}>
                                {entry.count}×
                            </Pill>
                        </div>
                    ))}
                </div>
            )}

            {records.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck size={18} />}
                    title="No declines recorded"
                    body="Nothing has been refused on this rail. Run a scenario in the simulation lab to see how a decline reads here."
                />
            ) : (
                <div className="space-y-3">
                    {records.map((record) => (
                        <DiagnosticCard
                            key={record.id}
                            diagnostic={record.diagnostic}
                            meta={
                                <div className="text-right">
                                    <p className="text-[14px] font-extrabold text-[#111116] dark:text-white">
                                        {formatMoney(record.amount, record.currency)}
                                    </p>
                                    <p className="text-[11px] text-[#81858c]">
                                        {record.merchant}
                                        {record.merchantCountry ? ` · ${record.merchantCountry}` : ''}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-[#a8aab1]">
                                        {record.cardLast4 ? `•••• ${record.cardLast4} · ` : ''}
                                        <TimeAgo iso={record.createdAt} />
                                    </p>
                                    {record.simulated && <Pill tone="brand">Simulated</Pill>}
                                </div>
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ---------------------------------------------------------- card grid */

function CardTile({
    card,
    onReveal,
    onStatus,
    onLimit,
    selected,
    onSelect,
}: {
    card: AdminCard
    onReveal: () => void
    onStatus: (status: string) => void
    onLimit: () => void
    selected: boolean
    onSelect: () => void
}) {
    const active = card.status === 'ACTIVE'

    return (
        <div
            className={cn(
                'rounded-2xl border p-4 transition-all',
                selected
                    ? 'border-[#925FFF]/50 shadow-[0_6px_22px_rgba(146,95,255,0.14)]'
                    : 'border-black/[0.06] hover:border-[#925FFF]/30 dark:border-white/[0.08]'
            )}
        >
            <button type="button" onClick={onSelect} className="w-full cursor-pointer text-left">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] to-[#925FFF] text-white">
                            <CreditCard size={15} />
                        </span>
                        <div>
                            <p className="font-mono text-[13.5px] font-bold text-[#111116] dark:text-white">
                                •••• {card.last4}
                            </p>
                            <p className="text-[11.5px] text-[#81858c]">
                                {card.brand} · {card.provider}
                            </p>
                        </div>
                    </div>
                    <StatusPill status={card.status} />
                </div>

                <Link
                    href={`/admin/users/${card.userId}`}
                    className="mt-3 block truncate text-[12.5px] font-semibold text-[#4a4d55] underline decoration-dotted underline-offset-2 hover:text-[#6330cf] dark:text-[#b9bbc2] dark:hover:text-[#b79bff]"
                >
                    {card.userName} · {card.userEmail}
                </Link>

                <p className="mt-3 text-[15px] font-extrabold text-[#111116] dark:text-white">
                    {formatMoney(card.available)}{' '}
                    <span className="text-[11.5px] font-semibold text-[#81858c]">
                        available of {formatMoney(card.spendingLimit)}
                    </span>
                </p>
                <div className="mt-2">
                    <Meter percent={card.utilisation} tone={card.utilisation >= 90 ? 'danger' : 'brand'} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#81858c]">
                    <span>{card.transactionCount} transactions</span>
                    {card.declineCount > 0 && (
                        <span className="font-bold text-[#e0293c] dark:text-[#ff7a87]">
                            {card.declineCount} declined
                        </span>
                    )}
                    <span>
                        issued <TimeAgo iso={card.createdAt} />
                    </span>
                </div>
            </button>

            <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-black/[0.05] pt-3.5 dark:border-white/[0.07]">
                <Button variant="ghost" onClick={onReveal} className="px-3 py-1.5 text-[12px]">
                    <Eye size={12} />
                    Reveal
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => onStatus(active ? 'PAUSED' : 'ACTIVE')}
                    className="px-3 py-1.5 text-[12px]"
                >
                    {active ? <Pause size={12} /> : <Play size={12} />}
                    {active ? 'Pause' : 'Activate'}
                </Button>
                <Button variant="ghost" onClick={onLimit} className="px-3 py-1.5 text-[12px]">
                    <Sliders size={12} />
                    Limit
                </Button>
                {card.status !== 'CLOSED' && (
                    <Button variant="ghost" onClick={() => onStatus('CLOSED')} className="px-3 py-1.5 text-[12px]">
                        <XCircle size={12} />
                        Close
                    </Button>
                )}
            </div>
        </div>
    )
}

export function CardLifecycle() {
    const params = useSearchParams()
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
    const [selected, setSelected] = useState<string | null>(null)
    const [revealing, setRevealing] = useState<AdminCard | null>(null)
    const [statusChange, setStatusChange] = useState<{ card: AdminCard; status: string } | null>(null)
    const [limitChange, setLimitChange] = useState<AdminCard | null>(null)
    const [limitDraft, setLimitDraft] = useState('')

    useEffect(() => {
        const card = params?.get('card')
        if (card) {
            setSearch(card)
            setDebounced(card)
            setSelected(card)
        }
    }, [params])

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 250)
        return () => clearTimeout(timer)
    }, [search])

    const cards = useAdminCards({ q: debounced, status })
    const override = useOverrideCard()
    const rows = cards.data ?? []

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Card lifecycle
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        Every issued card, with decline diagnostics in plain English.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[240px]">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8aab1]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Last 4, card id or email"
                            className={cn(inputClass, 'pl-10')}
                        />
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-black/[0.06] p-1 dark:border-white/[0.08]">
                        {STATUS_FILTERS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatus(value)}
                                className={cn(
                                    'cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-all',
                                    status === value
                                        ? 'bg-[#19191b] text-white dark:bg-white dark:text-[#0a0a0a]'
                                        : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                                )}
                            >
                                {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                <Panel title="Issued cards" subtitle={`${rows.length} matching`} bodyClassName="p-4">
                    {cards.isLoading ? (
                        <PanelLoader label="Loading cards" />
                    ) : rows.length === 0 ? (
                        <EmptyState
                            icon={<CreditCard size={18} />}
                            title="No cards match"
                            body="Adjust the filter, or search by the last four digits printed on the card."
                        />
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                            {rows.map((card) => (
                                <CardTile
                                    key={card.cardId}
                                    card={card}
                                    selected={selected === card.cardId}
                                    onSelect={() => setSelected(selected === card.cardId ? null : card.cardId)}
                                    onReveal={() => setRevealing(card)}
                                    onStatus={(next) => setStatusChange({ card, status: next })}
                                    onLimit={() => {
                                        setLimitDraft(card.spendingLimit)
                                        setLimitChange(card)
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel
                    title="Decline diagnostics"
                    subtitle={
                        selected
                            ? `Filtered to the selected card — click it again to see every decline`
                            : 'Every processor decline across the platform, newest first'
                    }
                >
                    <DeclineDiagnostics cardId={selected ?? undefined} />
                </Panel>
            </div>

            {revealing && <RevealPane card={revealing} onClose={() => setRevealing(null)} />}

            <OverrideDialog
                open={statusChange !== null}
                onClose={() => setStatusChange(null)}
                destructive={statusChange?.status !== 'ACTIVE'}
                title={`Set card •••• ${statusChange?.card.last4} to ${statusChange?.status.toLowerCase()}`}
                description={
                    statusChange?.status === 'ACTIVE'
                        ? 'Authorisations on this card resume immediately.'
                        : statusChange?.status === 'PAUSED'
                          ? 'Every authorisation on this card declines with CARD_NOT_ACTIVE until it is reactivated. The allocation stays reserved.'
                          : 'Closing is final for this card. Its allocation is released back to the unallocated wallet balance.'
                }
                confirmLabel="Apply"
                loading={override.isPending}
                error={override.error ? (override.error as Error).message : null}
                onConfirm={(reason) =>
                    statusChange &&
                    override.mutate(
                        { cardId: statusChange.card.cardId, status: statusChange.status, reason },
                        { onSuccess: () => setStatusChange(null) }
                    )
                }
            />

            <OverrideDialog
                open={limitChange !== null}
                onClose={() => setLimitChange(null)}
                title={`Override the limit on •••• ${limitChange?.last4}`}
                description="Sets the allocation outright, without requiring the wallet to back it. The only refusal is a limit below what the card has already spent."
                confirmLabel="Set limit"
                loading={override.isPending}
                error={override.error ? (override.error as Error).message : null}
                reasonPlaceholder="e.g. Raising for a verified business purchase"
                onConfirm={(reason) =>
                    limitChange &&
                    override.mutate(
                        { cardId: limitChange.cardId, spendingLimit: limitDraft, reason },
                        { onSuccess: () => setLimitChange(null) }
                    )
                }
            >
                <Field
                    label="Spending limit (USD)"
                    hint={limitChange ? `Already spent: ${formatMoney(limitChange.totalSpent)}` : undefined}
                >
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={limitDraft}
                        onChange={(event) => setLimitDraft(event.target.value)}
                        className={inputClass}
                    />
                </Field>
            </OverrideDialog>
        </div>
    )
}
