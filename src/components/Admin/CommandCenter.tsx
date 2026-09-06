'use client'

import {
    Activity,
    AlertOctagon,
    Banknote,
    Bitcoin,
    CreditCard,
    Landmark,
    Pencil,
    Smartphone,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAdminOverview, useUpdateTreasury } from '@/lib/admin-client'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { LiquidityPosition, RevenueWindow } from '@/types/admin'
import { Button, Field, Meter, OverrideDialog, Panel, PanelLoader, Pill, TimeAgo, inputClass } from './primitives'

const WINDOWS: RevenueWindow[] = ['24h', '7d', '30d', 'all']

/** Money in whichever unit the rail is actually held in. */
function money(value: string, currency: LiquidityPosition['currency']) {
    if (currency === 'KES') return formatMoney(value, 'KES')
    if (currency === 'USDT') return `${formatMoney(value).replace('$', '')} USDT`
    return formatMoney(value)
}

/**
 * A liquidity rail.
 *
 * The declared figure is what the founder says is in the provider console; the
 * liability is what the ledger says we owe against it. Showing both is the
 * point - a float number on its own tells you nothing about whether you are
 * about to start declining everybody.
 */
function LiquidityCard({
    icon,
    label,
    hint,
    position,
    accent,
    onEdit,
}: {
    icon: React.ReactNode
    label: string
    hint: string
    position: LiquidityPosition
    accent: string
    onEdit: () => void
}) {
    const stretched = position.utilisation >= 90
    const tight = position.utilisation >= 70

    return (
        <Panel bodyClassName="p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span
                        className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white', accent)}
                    >
                        {icon}
                    </span>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">{label}</p>
                        <p className="text-[11.5px] text-[#a8aab1]">{hint}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onEdit}
                    className="cursor-pointer rounded-full p-1.5 text-[#a8aab1] transition-colors hover:bg-[#f2f2f4] hover:text-[#1c1c24] dark:hover:bg-white/[0.06] dark:hover:text-white"
                    aria-label={`Update ${label}`}
                >
                    <Pencil size={14} />
                </button>
            </div>

            <p className="mt-4 text-[26px] font-extrabold leading-none tracking-tight text-[#111116] dark:text-white">
                {money(position.declared, position.currency)}
            </p>

            <div className="mt-4 space-y-2">
                <Meter
                    percent={position.utilisation}
                    tone={stretched ? 'danger' : tight ? 'warning' : 'brand'}
                />
                <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-[#81858c]">
                        {money(position.liability, position.currency)} committed
                    </span>
                    <span
                        className={cn(
                            'font-bold',
                            stretched ? 'text-[#ef5362]' : tight ? 'text-[#f5a524]' : 'text-[#12b88f]'
                        )}
                    >
                        {position.utilisation}% used
                    </span>
                </div>
            </div>

            <p className="mt-3 border-t border-black/[0.05] pt-3 text-[11.5px] text-[#a8aab1] dark:border-white/[0.07]">
                {position.updatedBy ? (
                    <>
                        Declared by {position.updatedBy} · <TimeAgo iso={position.updatedAt} />
                    </>
                ) : (
                    'Never declared — set the opening balance to make headroom meaningful.'
                )}
            </p>
        </Panel>
    )
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' | 'warning' }) {
    return (
        <div className="rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 dark:border-white/[0.07] dark:bg-[#121214]">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">{label}</p>
            <p
                className={cn(
                    'mt-1.5 text-[19px] font-extrabold tracking-tight text-[#111116] dark:text-white',
                    tone === 'danger' && 'text-[#e0293c] dark:text-[#ff7a87]',
                    tone === 'warning' && 'text-[#b06f00] dark:text-[#ffb84d]'
                )}
            >
                {value}
            </p>
            {sub && <p className="mt-0.5 text-[11.5px] text-[#a8aab1]">{sub}</p>}
        </div>
    )
}

export function CommandCenter() {
    const [window, setWindow] = useState<RevenueWindow>('30d')
    const overview = useAdminOverview(window)
    const treasury = useUpdateTreasury()

    const [editing, setEditing] = useState<null | 'mpesa' | 'crypto' | 'issuer' | 'fees'>(null)
    const [draft, setDraft] = useState('')
    const [fees, setFees] = useState({ mpesa: '', crypto: '', card: '' })

    if (overview.isLoading) return <PanelLoader label="Reading live liquidity" />
    if (overview.isError || !overview.data) {
        return (
            <Panel>
                <p className="text-[13.5px] text-[#e0293c]">
                    The command center could not load: {(overview.error as Error | null)?.message ?? 'unknown error'}
                </p>
            </Panel>
        )
    }

    const { liquidity, revenue, platform, volumeSeries } = overview.data
    const revenueUp = (revenue.changePercent ?? 0) >= 0

    const openEdit = (which: 'mpesa' | 'crypto' | 'issuer') => {
        setDraft(
            which === 'mpesa'
                ? liquidity.mpesaFloat.declared
                : which === 'crypto'
                  ? liquidity.cryptoHotWallet.declared
                  : liquidity.issuerSettlementPool.declared
        )
        setEditing(which)
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Liquidity &amp; revenue
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        What the platform holds, what it owes, and what it earned.
                    </p>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#121214]">
                    {WINDOWS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setWindow(value)}
                            className={cn(
                                'cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all',
                                window === value
                                    ? 'bg-[#19191b] text-white dark:bg-white dark:text-[#0a0a0a]'
                                    : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                            )}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </div>

            {/* Three rails of live liquidity. */}
            <div className="grid gap-4 lg:grid-cols-3">
                <LiquidityCard
                    icon={<Smartphone size={16} />}
                    label="M-Pesa float"
                    hint="Safaricom paybill balance"
                    position={liquidity.mpesaFloat}
                    accent="bg-gradient-to-tr from-[#0d8f70] to-[#12b88f]"
                    onEdit={() => openEdit('mpesa')}
                />
                <LiquidityCard
                    icon={<Bitcoin size={16} />}
                    label="Crypto hot wallet"
                    hint="USDT / USDC on Base"
                    position={liquidity.cryptoHotWallet}
                    accent="bg-gradient-to-tr from-[#b06f00] to-[#f5a524]"
                    onEdit={() => openEdit('crypto')}
                />
                <LiquidityCard
                    icon={<Landmark size={16} />}
                    label="Issuer settlement pool"
                    hint="Prefunded card settlement, USD"
                    position={liquidity.issuerSettlementPool}
                    accent="bg-gradient-to-tr from-[#6330cf] to-[#925FFF]"
                    onEdit={() => openEdit('issuer')}
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                {/* Revenue. */}
                <Panel
                    title="Revenue collected"
                    subtitle={`Fee schedule applied to settled volume over ${window === 'all' ? 'all time' : `the last ${window}`}`}
                    action={
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setFees({
                                    mpesa: String(revenue.lines[0]?.rate ?? ''),
                                    crypto: String(revenue.lines[1]?.rate ?? ''),
                                    card: String(revenue.lines[2]?.rate ?? ''),
                                })
                                setEditing('fees')
                            }}
                        >
                            <Pencil size={13} />
                            Fee schedule
                        </Button>
                    }
                >
                    <div className="flex flex-wrap items-end gap-4">
                        <p className="text-[38px] font-extrabold leading-none tracking-tight text-[#111116] dark:text-white">
                            {formatMoney(revenue.total)}
                        </p>
                        {revenue.changePercent !== null && (
                            <Pill tone={revenueUp ? 'success' : 'danger'}>
                                {revenueUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {revenue.changePercent > 0 ? '+' : ''}
                                {revenue.changePercent}% vs previous {window}
                            </Pill>
                        )}
                    </div>

                    <ul className="mt-5 space-y-3">
                        {revenue.lines.map((line) => (
                            <li
                                key={line.key}
                                className="flex items-center justify-between gap-4 rounded-xl bg-[#fafafb] px-3.5 py-3 dark:bg-white/[0.03]"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                        {line.label}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] text-[#81858c]">
                                        {line.rateKind === 'PERCENT'
                                            ? `${line.rate}% of ${formatMoney(line.volume)} settled`
                                            : `${formatMoney(line.rate)} × ${line.count} card${line.count === 1 ? '' : 's'}`}
                                    </p>
                                </div>
                                <p className="shrink-0 text-[15px] font-extrabold text-[#111116] dark:text-white">
                                    {formatMoney(line.earned)}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-4 text-[11.5px] leading-relaxed text-[#a8aab1]">
                        Derived from the ledger rather than stored, so it can never drift from the transactions it is
                        computed over — and it moves the moment the fee schedule is edited.
                    </p>
                </Panel>

                {/* Settled volume. */}
                <Panel title="Settled volume" subtitle="Deposits against card spend, last 14 days">
                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={volumeSeries} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="adminDeposits" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#925FFF" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#925FFF" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="adminSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#12b88f" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#12b88f" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(129,133,140,0.16)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: '#9a9ca4' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#9a9ca4' }} axisLine={false} tickLine={false} width={48} />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 14,
                                        border: '1px solid rgba(129,133,140,0.2)',
                                        fontSize: 12,
                                    }}
                                    formatter={(value, name) => [
                                        formatMoney(Number(value ?? 0)),
                                        name === 'deposits' ? 'Deposits' : 'Card spend',
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="deposits"
                                    stroke="#925FFF"
                                    strokeWidth={2}
                                    fill="url(#adminDeposits)"
                                />
                                <Area type="monotone" dataKey="spend" stroke="#12b88f" strokeWidth={2} fill="url(#adminSpend)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
            </div>

            {/* Platform counters, with the two that need action linked through. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    label="Users"
                    value={String(platform.totalUsers)}
                    sub={`${platform.activeUsers} active · ${platform.frozenUsers} frozen · ${platform.bannedUsers} banned`}
                />
                <StatTile
                    label="Virtual cards"
                    value={String(platform.totalCards)}
                    sub={`${platform.activeCards} active`}
                />
                <StatTile
                    label="User liability"
                    value={formatMoney(platform.userLiability)}
                    sub="Total wallet balances owed"
                />
                <StatTile
                    label="Declines (24h)"
                    value={String(platform.declines24h)}
                    sub="Real processor declines"
                    tone={platform.declines24h > 0 ? 'warning' : undefined}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/admin/transactions?status=PENDING" className="block">
                    <Panel className="h-full transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)]">
                        <div className="flex items-start gap-3">
                            <span
                                className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                    platform.stuckDeposits > 0
                                        ? 'bg-[#ffebeb] text-[#e0293c] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                        : 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                )}
                            >
                                <AlertOctagon size={16} />
                            </span>
                            <div>
                                <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                    {platform.stuckDeposits} stuck deposit{platform.stuckDeposits === 1 ? '' : 's'}
                                </p>
                                <p className="mt-0.5 text-[12px] leading-relaxed text-[#81858c]">
                                    {platform.stuckDeposits > 0
                                        ? `${formatMoney(platform.pendingDeposits)} pending, some over 30 minutes old. Reconcile them before they age out.`
                                        : 'Nothing has been pending long enough to need intervention.'}
                                </p>
                            </div>
                        </div>
                    </Panel>
                </Link>

                <Link href="/admin/users?kyc=PENDING" className="block">
                    <Panel className="h-full transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)]">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]">
                                <Users size={16} />
                            </span>
                            <div>
                                <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                    {platform.pendingKyc} awaiting KYC
                                </p>
                                <p className="mt-0.5 text-[12px] leading-relaxed text-[#81858c]">
                                    Approve or reject directly from the 360 profile — no queue, no escalation.
                                </p>
                            </div>
                        </div>
                    </Panel>
                </Link>

                <Link href="/admin/simulator" className="block">
                    <Panel className="h-full transition-shadow hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)]">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff4e5] text-[#b06f00] dark:bg-[#3a2a08] dark:text-[#ffb84d]">
                                <Activity size={16} />
                            </span>
                            <div>
                                <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                    Simulation lab
                                </p>
                                <p className="mt-0.5 text-[12px] leading-relaxed text-[#81858c]">
                                    Rehearse a payment, a decline or a lost webhook against the real authorisation path.
                                </p>
                            </div>
                        </div>
                    </Panel>
                </Link>
            </div>

            {/* Treasury override. */}
            <OverrideDialog
                open={editing !== null && editing !== 'fees'}
                onClose={() => setEditing(null)}
                title="Declare treasury balance"
                description="These figures live in provider consoles we cannot read. Declaring them here is what makes headroom and float alerts meaningful."
                confirmLabel="Save balance"
                loading={treasury.isPending}
                error={treasury.error ? (treasury.error as Error).message : null}
                reasonPlaceholder="e.g. Reconciled against the Safaricom portal at 09:00"
                onConfirm={(reason) =>
                    treasury.mutate(
                        {
                            reason,
                            ...(editing === 'mpesa' ? { mpesaFloatKes: draft } : {}),
                            ...(editing === 'crypto' ? { cryptoHotWalletUsd: draft } : {}),
                            ...(editing === 'issuer' ? { issuerSettlementPoolUsd: draft } : {}),
                        },
                        { onSuccess: () => setEditing(null) }
                    )
                }
            >
                <Field
                    label={
                        editing === 'mpesa'
                            ? 'M-Pesa float (KES)'
                            : editing === 'crypto'
                              ? 'Crypto hot wallet (USD value)'
                              : 'Issuer settlement pool (USD)'
                    }
                >
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className={inputClass}
                    />
                </Field>
            </OverrideDialog>

            {/* Fee schedule override. */}
            <OverrideDialog
                open={editing === 'fees'}
                onClose={() => setEditing(null)}
                title="Edit the fee schedule"
                description="Revenue is computed from these rates against settled volume, so a change here restates every figure above immediately."
                confirmLabel="Save schedule"
                loading={treasury.isPending}
                error={treasury.error ? (treasury.error as Error).message : null}
                reasonPlaceholder="e.g. Dropping M-Pesa fee to 1.2% for the Q4 promo"
                onConfirm={(reason) =>
                    treasury.mutate(
                        {
                            reason,
                            fees: {
                                mpesaDepositPercent: Number(fees.mpesa),
                                cryptoFxSpreadPercent: Number(fees.crypto),
                                cardCreationFlatUsd: Number(fees.card),
                            },
                        },
                        { onSuccess: () => setEditing(null) }
                    )
                }
            >
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="M-Pesa %">
                        <input
                            type="number"
                            step="0.01"
                            value={fees.mpesa}
                            onChange={(event) => setFees({ ...fees, mpesa: event.target.value })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Crypto spread %">
                        <input
                            type="number"
                            step="0.01"
                            value={fees.crypto}
                            onChange={(event) => setFees({ ...fees, crypto: event.target.value })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Card fee $">
                        <input
                            type="number"
                            step="0.01"
                            value={fees.card}
                            onChange={(event) => setFees({ ...fees, card: event.target.value })}
                            className={inputClass}
                        />
                    </Field>
                </div>
            </OverrideDialog>
        </div>
    )
}

export { Banknote, CreditCard }
