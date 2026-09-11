'use client'

import {
    ArrowLeft,
    BadgeCheck,
    Ban,
    Banknote,
    CreditCard,
    Fingerprint,
    Snowflake,
    Sliders,
    UserCheck,
    Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAdminUser, useOverrideUser } from '@/lib/admin-client'
import { formatMoney, percentOf } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AccountStatus, UserLimits } from '@/types/admin'
import {
    Button,
    Field,
    Meter,
    OverrideDialog,
    Panel,
    PanelLoader,
    Pill,
    StatusPill,
    TimeAgo,
    inputClass,
    toneForStatus,
} from './primitives'

type Pending =
    | { kind: 'KYC'; status: 'VERIFIED' | 'REJECTED' | 'PENDING' | 'UNVERIFIED' }
    | { kind: 'STATUS'; status: AccountStatus }
    | { kind: 'LIMITS' }
    | { kind: 'CREDIT' }

const STATUS_ACTIONS: Array<{ status: AccountStatus; label: string; icon: React.ElementType; description: string }> = [
    {
        status: 'ACTIVE',
        label: 'Active',
        icon: UserCheck,
        description: 'Deposits, card minting and authorisations all run normally.',
    },
    {
        status: 'FROZEN',
        label: 'Frozen',
        icon: Snowflake,
        description: 'Every deposit and new card is refused, and card authorisations decline. Reversible.',
    },
    {
        status: 'BANNED',
        label: 'Banned',
        icon: Ban,
        description: 'Permanent closure. The account keeps its ledger but can never transact again.',
    },
]

/** One capped figure with its live consumption. */
function LimitRow({ label, cap, used }: { label: string; cap: string; used: string }) {
    const percent = percentOf(used, cap)
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-semibold text-[#4a4d55] dark:text-[#b9bbc2]">{label}</span>
                <span className="text-[12px] text-[#81858c]">
                    <span className="font-bold text-[#111116] dark:text-white">{formatMoney(used)}</span> of{' '}
                    {formatMoney(cap)}
                </span>
            </div>
            <Meter percent={percent} tone={percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : 'brand'} />
        </div>
    )
}

/**
 * User 360° override profile.
 *
 * Every control here is an override, not a request: KYC is a one-click bypass,
 * the limits are typed in directly, and the status buttons take effect on the
 * user's very next request. What keeps that safe is not friction in the UI but
 * the fact that all four paths refuse to fire without a reason, which is then
 * written to the audit trail shown at the bottom of this same page.
 */
export function UserOverrideProfile({ userId }: { userId: string }) {
    const user = useAdminUser(userId)
    const override = useOverrideUser(userId)

    const [pending, setPending] = useState<Pending | null>(null)
    const [limits, setLimits] = useState<Record<keyof UserLimits, string>>({
        dailyFunding: '',
        monthlyFunding: '',
        dailySpending: '',
        monthlySpending: '',
    })
    const [credit, setCredit] = useState('')

    useEffect(() => {
        if (user.data) {
            setLimits({
                dailyFunding: user.data.limits.dailyFunding,
                monthlyFunding: user.data.limits.monthlyFunding,
                dailySpending: user.data.limits.dailySpending,
                monthlySpending: user.data.limits.monthlySpending,
            })
        }
    }, [user.data])

    if (user.isLoading) return <PanelLoader label="Loading the account" />
    if (user.isError || !user.data) {
        return (
            <Panel>
                <p className="text-[13.5px] text-[#e0293c]">
                    {(user.error as Error | null)?.message ?? 'That account could not be loaded.'}
                </p>
            </Panel>
        )
    }

    const data = user.data

    const submit = (reason: string) => {
        if (!pending) return
        const body =
            pending.kind === 'KYC'
                ? { reason, kycStatus: pending.status }
                : pending.kind === 'STATUS'
                  ? { reason, accountStatus: pending.status }
                  : pending.kind === 'LIMITS'
                    ? { reason, limits }
                    : { reason, forceCredit: credit }

        override.mutate(body, { onSuccess: () => setPending(null) })
    }

    return (
        <div className="space-y-5">
            <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#81858c] transition-colors hover:text-[#1c1c24] dark:hover:text-white"
            >
                <ArrowLeft size={14} />
                All users
            </Link>

            {/* Identity. */}
            <Panel bodyClassName="p-5">
                <div className="flex flex-wrap items-start gap-5">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                        {data.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote Clerk avatar
                            <img src={data.imageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                        ) : (
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] to-[#925FFF] text-[17px] font-black text-white">
                                {data.name.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-[21px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                                    {data.name}
                                </h1>
                                <Pill tone={toneForStatus(data.accountStatus)}>{data.accountStatus}</Pill>
                                <Pill tone={toneForStatus(data.kycStatus)}>KYC {data.kycStatus}</Pill>
                                {data.isAdmin && <Pill tone="brand">Superadmin</Pill>}
                            </div>
                            <p className="mt-1 truncate text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                                {data.email}
                            </p>
                            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11.5px] text-[#a8aab1]">
                                <span>#{data.id}</span>
                                <span className="truncate">uuid {data.uuid}</span>
                                {data.clerkUserId && <span className="truncate">clerk {data.clerkUserId}</span>}
                                {data.onChainAddress && <span className="truncate">base {data.onChainAddress}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-[#fafafb] px-4 py-3 dark:bg-white/[0.03]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">Wallet</p>
                            <p className="mt-1 text-[17px] font-extrabold text-[#111116] dark:text-white">
                                {formatMoney(data.walletBalance, data.currency)}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[#fafafb] px-4 py-3 dark:bg-white/[0.03]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">Deposited</p>
                            <p className="mt-1 text-[17px] font-extrabold text-[#111116] dark:text-white">
                                {formatMoney(data.lifetimeDeposits)}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[#fafafb] px-4 py-3 dark:bg-white/[0.03]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">Cards</p>
                            <p className="mt-1 text-[17px] font-extrabold text-[#111116] dark:text-white">
                                {data.activeCardCount}/{data.cardCount}
                            </p>
                        </div>
                    </div>
                </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
                {/* KYC bypass. */}
                <Panel
                    title="Identity verification"
                    subtitle={
                        data.kycReviewedBy
                            ? `Last set by ${data.kycReviewedBy}`
                            : 'Never manually reviewed'
                    }
                >
                    <div className="flex items-start gap-3 rounded-2xl bg-[#fafafb] p-4 dark:bg-white/[0.03]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]">
                            <Fingerprint size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                Currently {data.kycStatus.toLowerCase()}
                            </p>
                            <p className="mt-1 text-[12px] leading-relaxed text-[#81858c]">
                                Approving here bypasses the provider check entirely. The reason you give is the only
                                record of why, so make it specific.
                            </p>
                            {data.kycReviewedAt && (
                                <p className="mt-1.5 text-[11.5px] text-[#a8aab1]">
                                    Reviewed <TimeAgo iso={data.kycReviewedAt} />
                                </p>
                            )}
                        </div>
                    </div>

                    {/*
                      What the provider actually confirmed. Without this an
                      admin approving or rejecting is working blind - the whole
                      point of a manual review is seeing the evidence first.
                    */}
                    {data.kycIdentity && (
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-[#fafafb] p-4 dark:bg-white/[0.03]">
                            <IdentityField label="Legal name"
                                value={[data.kycIdentity.firstName, data.kycIdentity.lastName].filter(Boolean).join(' ') || null} />
                            <IdentityField label="Date of birth" value={data.kycIdentity.dateOfBirth} />
                            <IdentityField label="National ID" value={data.kycIdentity.nationalIdMasked} />
                            <IdentityField label="Provider ref" value={data.kycIdentity.dojahReference} />
                        </dl>
                    )}

                    {data.kycAttempts.length > 0 && (
                        <div className="mt-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                Verification attempts
                            </p>
                            <ul className="mt-2 space-y-1.5">
                                {data.kycAttempts.slice(0, 6).map((attempt) => (
                                    <li
                                        key={attempt.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafb] px-3 py-2 dark:bg-white/[0.03]"
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <Pill tone={attempt.outcome === 'VERIFIED' ? 'success' : 'danger'}>
                                                {attempt.outcome}
                                            </Pill>
                                            {attempt.mismatchedFields.length > 0 && (
                                                <span className="truncate text-[11.5px] text-[#81858c]">
                                                    mismatch: {attempt.mismatchedFields.join(', ')}
                                                </span>
                                            )}
                                            {attempt.mismatchedFields.length === 0 && attempt.detail && (
                                                <span className="truncate text-[11.5px] text-[#81858c]">
                                                    {attempt.detail}
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0 text-[11.5px] text-[#a8aab1]">
                                            <TimeAgo iso={attempt.createdAt} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                            variant="primary"
                            disabled={data.kycStatus === 'VERIFIED'}
                            onClick={() => setPending({ kind: 'KYC', status: 'VERIFIED' })}
                        >
                            <BadgeCheck size={14} />
                            Manually approve KYC
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={data.kycStatus === 'REJECTED'}
                            onClick={() => setPending({ kind: 'KYC', status: 'REJECTED' })}
                        >
                            Reject
                        </Button>
                        {/*
                          Resets to UNVERIFIED, not PENDING: PENDING now means
                          "submitted, awaiting an answer", so parking an account
                          there would show the user a check that is not running.
                        */}
                        <Button
                            variant="ghost"
                            disabled={data.kycStatus === 'UNVERIFIED'}
                            onClick={() => setPending({ kind: 'KYC', status: 'UNVERIFIED' })}
                        >
                            Require re-verification
                        </Button>
                    </div>
                </Panel>

                {/* Account status. */}
                <Panel title="Account status" subtitle="Takes effect on the user's next request">
                    <div className="space-y-2">
                        {STATUS_ACTIONS.map((action) => {
                            const Icon = action.icon
                            const current = data.accountStatus === action.status
                            return (
                                <button
                                    key={action.status}
                                    type="button"
                                    disabled={current || (data.isAdmin && action.status !== 'ACTIVE')}
                                    onClick={() => setPending({ kind: 'STATUS', status: action.status })}
                                    className={cn(
                                        'flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all',
                                        current
                                            ? 'border-[#925FFF]/40 bg-[#f1ebff] dark:bg-[#6330cf]/15'
                                            : 'border-black/[0.06] hover:border-[#925FFF]/40 hover:bg-[#fafafb] dark:border-white/[0.08] dark:hover:bg-white/[0.04]',
                                        'disabled:cursor-not-allowed disabled:opacity-60'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                            action.status === 'ACTIVE'
                                                ? 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                                : action.status === 'FROZEN'
                                                  ? 'bg-[#fff4e5] text-[#b06f00] dark:bg-[#3a2a08] dark:text-[#ffb84d]'
                                                  : 'bg-[#ffebeb] text-[#e0293c] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                        )}
                                    >
                                        <Icon size={15} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                {action.label}
                                            </span>
                                            {current && <Pill tone="brand">Current</Pill>}
                                        </span>
                                        <span className="mt-0.5 block text-[12px] leading-relaxed text-[#81858c]">
                                            {action.description}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    {data.isAdmin && (
                        <p className="mt-3 text-[11.5px] text-[#a8aab1]">
                            A superadmin account cannot be frozen or banned — the server refuses it too.
                        </p>
                    )}
                </Panel>
            </div>

            {/* Limits. */}
            <Panel
                title="Funding & spending caps"
                subtitle="Type any figure directly. Blank fields keep their current value."
                action={
                    <Button variant="primary" onClick={() => setPending({ kind: 'LIMITS' })}>
                        <Sliders size={14} />
                        Apply limits
                    </Button>
                }
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4 rounded-2xl bg-[#fafafb] p-4 dark:bg-white/[0.03]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                            Live consumption
                        </p>
                        <LimitRow label="Funding today" cap={data.limits.dailyFunding} used={data.usage.dailyFunding} />
                        <LimitRow
                            label="Funding this month"
                            cap={data.limits.monthlyFunding}
                            used={data.usage.monthlyFunding}
                        />
                        <LimitRow
                            label="Spending today"
                            cap={data.limits.dailySpending}
                            used={data.usage.dailySpending}
                        />
                        <LimitRow
                            label="Spending this month"
                            cap={data.limits.monthlySpending}
                            used={data.usage.monthlySpending}
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Daily funding cap">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={limits.dailyFunding}
                                onChange={(event) => setLimits({ ...limits, dailyFunding: event.target.value })}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Monthly funding cap">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={limits.monthlyFunding}
                                onChange={(event) => setLimits({ ...limits, monthlyFunding: event.target.value })}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Daily spending cap">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={limits.dailySpending}
                                onChange={(event) => setLimits({ ...limits, dailySpending: event.target.value })}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Monthly spending cap">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={limits.monthlySpending}
                                onChange={(event) => setLimits({ ...limits, monthlySpending: event.target.value })}
                                className={inputClass}
                            />
                        </Field>
                    </div>
                </div>
            </Panel>

            {/* Direct wallet movement. */}
            <Panel
                title="Direct wallet adjustment"
                subtitle="Bypasses every provider rail. Use when a deposit was taken but never landed."
            >
                <div className="flex flex-wrap items-end gap-3">
                    <Field label="Amount (negative to debit)" className="min-w-[200px] flex-1">
                        <input
                            type="number"
                            step="0.01"
                            value={credit}
                            onChange={(event) => setCredit(event.target.value)}
                            placeholder="e.g. 25.00 or -10.00"
                            className={inputClass}
                        />
                    </Field>
                    <Button
                        variant="danger"
                        disabled={!credit || Number(credit) === 0}
                        onClick={() => setPending({ kind: 'CREDIT' })}
                    >
                        <Banknote size={14} />
                        Force adjustment
                    </Button>
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-[#a8aab1]">
                    Writes a matching ledger row and notifies the user. The server refuses any adjustment that would
                    take the balance below zero.
                </p>
            </Panel>

            {/* Cards. */}
            <Panel title="Virtual cards" subtitle={`${data.cards.length} issued to this account`} bodyClassName="p-0">
                {data.cards.length === 0 ? (
                    <p className="px-5 py-8 text-center text-[13px] text-[#81858c]">No cards issued yet.</p>
                ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                        {data.cards.map((card) => (
                            <Link
                                key={card.cardId}
                                href={`/admin/cards?card=${encodeURIComponent(card.cardId)}`}
                                className="rounded-2xl border border-black/[0.06] p-4 transition-all hover:border-[#925FFF]/40 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:border-white/[0.08]"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                        <CreditCard size={14} className="text-[#925FFF]" />
                                        •••• {card.last4}
                                    </span>
                                    <StatusPill status={card.status} />
                                </div>
                                <p className="mt-3 text-[15px] font-extrabold text-[#111116] dark:text-white">
                                    {formatMoney(card.available)}{' '}
                                    <span className="text-[11.5px] font-semibold text-[#81858c]">
                                        of {formatMoney(card.spendingLimit)}
                                    </span>
                                </p>
                                <div className="mt-2.5">
                                    <Meter percent={card.utilisation} />
                                </div>
                                {card.declineCount > 0 && (
                                    <p className="mt-2.5 text-[11.5px] font-semibold text-[#e0293c] dark:text-[#ff7a87]">
                                        {card.declineCount} decline{card.declineCount === 1 ? '' : 's'} recorded
                                    </p>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </Panel>

            {/* Ledger + trail. */}
            <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="Recent ledger" bodyClassName="p-0">
                    {data.recentTransactions.length === 0 ? (
                        <p className="px-5 py-8 text-center text-[13px] text-[#81858c]">No transactions yet.</p>
                    ) : (
                        <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                            {data.recentTransactions.slice(0, 12).map((tx) => (
                                <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                                    <span
                                        className={cn(
                                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                                            tx.type === 'CREDIT'
                                                ? 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                                : 'bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]'
                                        )}
                                    >
                                        <Wallet size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px] font-semibold text-[#1c1c24] dark:text-[#e4e5eb]">
                                            {tx.merchant}
                                        </span>
                                        <span className="block truncate text-[11.5px] text-[#81858c]">
                                            {tx.channel} · <TimeAgo iso={tx.createdAt} />
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span
                                            className={cn(
                                                'block text-[13px] font-bold',
                                                tx.type === 'CREDIT'
                                                    ? 'text-[#0d8f70] dark:text-[#28d6aa]'
                                                    : 'text-[#111116] dark:text-white'
                                            )}
                                        >
                                            {tx.type === 'CREDIT' ? '+' : '−'}
                                            {formatMoney(tx.amount, tx.currency)}
                                        </span>
                                        <StatusPill status={tx.status} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Override history" subtitle="Everything support has done to this account">
                    {data.auditTrail.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-[#81858c]">
                            No overrides have been applied to this account.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {data.auditTrail.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="rounded-xl border border-black/[0.05] p-3.5 dark:border-white/[0.07]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <Pill tone="brand">{entry.action.replace(/_/g, ' ')}</Pill>
                                        <span className="text-[11.5px] text-[#a8aab1]">
                                            <TimeAgo iso={entry.createdAt} />
                                        </span>
                                    </div>
                                    {entry.reason && (
                                        <p className="mt-2 text-[12.5px] leading-relaxed text-[#4a4d55] dark:text-[#b9bbc2]">
                                            “{entry.reason}”
                                        </p>
                                    )}
                                    <p className="mt-1.5 text-[11.5px] text-[#a8aab1]">by {entry.actorEmail}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <OverrideDialog
                open={pending !== null}
                onClose={() => setPending(null)}
                destructive={
                    (pending?.kind === 'STATUS' && pending.status !== 'ACTIVE') ||
                    pending?.kind === 'CREDIT' ||
                    (pending?.kind === 'KYC' && pending.status === 'REJECTED')
                }
                title={
                    pending?.kind === 'KYC'
                        ? `Set KYC to ${pending.status.toLowerCase()}`
                        : pending?.kind === 'STATUS'
                          ? `Set account to ${pending.status.toLowerCase()}`
                          : pending?.kind === 'LIMITS'
                            ? 'Override funding and spending caps'
                            : 'Move this wallet balance directly'
                }
                description={
                    pending?.kind === 'KYC'
                        ? pending.status === 'VERIFIED'
                            ? 'This bypasses the provider identity check outright and unlocks full limits immediately.'
                            : 'The user is notified that their identity review status changed.'
                        : pending?.kind === 'STATUS'
                          ? pending.status === 'BANNED'
                              ? 'A permanent closure. The account keeps its ledger but can never transact again.'
                              : pending.status === 'FROZEN'
                                ? 'Deposits, card minting and card authorisations all stop for this user until you unfreeze.'
                                : 'Deposits and card payments resume immediately.'
                          : pending?.kind === 'LIMITS'
                            ? `Daily funding ${formatMoney(limits.dailyFunding)}, monthly ${formatMoney(limits.monthlyFunding)}, daily spend ${formatMoney(limits.dailySpending)}, monthly spend ${formatMoney(limits.monthlySpending)}.`
                            : `${Number(credit) >= 0 ? 'Credits' : 'Debits'} ${formatMoney(credit)} outside the provider rails, with a matching ledger row.`
                }
                confirmLabel={
                    pending?.kind === 'CREDIT'
                        ? `Apply ${formatMoney(credit)}`
                        : pending?.kind === 'LIMITS'
                          ? 'Apply limits'
                          : 'Apply override'
                }
                loading={override.isPending}
                error={override.error ? (override.error as Error).message : null}
                onConfirm={submit}
            />
        </div>
    )
}

/**
 * One field of the verified identity. Renders an em dash rather than nothing
 * when a value is absent, so a reviewer can tell "not captured" apart from a
 * field that failed to render.
 */
function IdentityField({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">{label}</dt>
            <dd className="mt-0.5 truncate text-[13px] font-semibold text-[#1c1c24] dark:text-[#e4e5eb]">
                {value ?? '—'}
            </dd>
        </div>
    )
}
