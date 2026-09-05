'use client'

import { useUser } from '@clerk/nextjs'
import {
    MoreVertical,
    Plus,
    Search,
    SlidersHorizontal,
    WalletCards,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    X,
    Sparkles,
    RefreshCw,
    Download,
    CreditCard,
    AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { ApiRequestError, useDashboardSummary, useIssueCard, useMe } from '@/lib/client-api'
import { CardStack } from '@/components/Dashboard/Cards/CardStack'
import { CARD_ASPECT_RATIO } from '@/components/Dashboard/Cards/SwippableCard'
import type { LedgerTransaction, StatDelta, VirtualCard } from '@/types/api'

type Period = 'Day' | 'Week' | 'Month'

const ALLOCATION_COLORS = ['#7042f4', '#12b88f']

/** Renders a real period-over-period delta, or a dash when there is no prior period. */
function DeltaBadge({ delta, invert = false }: { delta: StatDelta; invert?: boolean }) {
    if (delta.changePercent === null) {
        return (
            <span className="rounded-md bg-[#f5f5f7] px-2 py-0.5 font-bold text-[#81858c] dark:bg-white/[0.06]">
                —
            </span>
        )
    }

    // For expenses a rise is bad, so the colour meaning flips.
    const good = invert ? delta.changePercent <= 0 : delta.changePercent >= 0
    const sign = delta.changePercent > 0 ? '+' : ''

    return (
        <span
            className={cn(
                'rounded-md px-2 py-0.5 font-bold',
                good
                    ? 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                    : 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]'
            )}
        >
            {sign}
            {delta.changePercent}%
        </span>
    )
}

function StatCardShell({
    icon,
    iconClass,
    label,
    menuId,
    activeMenuId,
    onToggleMenu,
    renderMenu,
    children,
    delay,
}: {
    icon: React.ReactNode
    iconClass: string
    label: string
    menuId: string
    activeMenuId: string | null
    onToggleMenu: (id: string) => void
    renderMenu: (id: string) => React.ReactNode
    children: React.ReactNode
    delay: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay }}
            whileHover={{ y: -3 }}
            className="relative flex flex-col justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full shadow-sm', iconClass)}>
                        {icon}
                    </div>
                    <span className="text-xs font-bold text-[#1c1c24] dark:text-[#e4e5eb]">{label}</span>
                </div>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => onToggleMenu(menuId)}
                        className="cursor-pointer rounded-full p-1 text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white"
                        aria-label={`${label} menu`}
                    >
                        <MoreVertical size={16} />
                    </button>
                    {activeMenuId === menuId && renderMenu(menuId)}
                </div>
            </div>
            {children}
        </motion.div>
    )
}

export function Overview() {
    const { user } = useUser()
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    const [activePeriod, setActivePeriod] = useState<Period>('Month')
    const [cardStackOffset, setCardStackOffset] = useState(0)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

    const [isAddCardOpen, setIsAddCardOpen] = useState(false)
    const [newCardHolder, setNewCardHolder] = useState('')
    const [newCardLimit, setNewCardLimit] = useState('100')

    const [searchLedger, setSearchLedger] = useState('')
    const [statusFilter, setStatusFilter] = useState<'All' | 'SUCCESS' | 'PENDING' | 'FAILED'>('All')
    const [sortAsc, setSortAsc] = useState(false)

    const me = useMe()
    const summary = useDashboardSummary(activePeriod)
    const issueCard = useIssueCard()

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (me.data?.name) setNewCardHolder(me.data.name)
        else if (user?.fullName) setNewCardHolder(user.fullName)
    }, [me.data?.name, user?.fullName])

    const cards: VirtualCard[] = summary.data?.cards ?? []
    const currentCard = cards.length > 0 ? cards[cardStackOffset % cards.length] : null

    const walletBalance = summary.data?.walletBalance.value ?? me.data?.walletBalance ?? '0.00'
    const currency = summary.data?.currency ?? 'USD'

    /* --------------------------------------------------- ledger table state */

    const ledgerRows = useMemo(() => {
        let rows = [...(summary.data?.recentTransactions ?? [])]

        if (statusFilter !== 'All') {
            rows = rows.filter((row) => row.status === statusFilter)
        }
        if (searchLedger.trim()) {
            const query = searchLedger.toLowerCase()
            rows = rows.filter(
                (row) =>
                    row.merchant.toLowerCase().includes(query) ||
                    row.category.toLowerCase().includes(query) ||
                    row.channel.toLowerCase().includes(query)
            )
        }
        rows.sort((a, b) => {
            const diff = Number(a.amount) - Number(b.amount)
            return sortAsc ? diff : -diff
        })
        return rows
    }, [summary.data?.recentTransactions, statusFilter, searchLedger, sortAsc])

    /* --------------------------------------------------------- chart shapes */

    const activityData = useMemo(
        () =>
            (summary.data?.activity ?? []).map((bucket) => ({
                day: bucket.day,
                debit: Number(bucket.debitAmount),
                credit: Number(bucket.creditAmount),
                debitLabel: formatMoney(bucket.debitAmount, currency),
                creditLabel: formatMoney(bucket.creditAmount, currency),
            })),
        [summary.data?.activity, currency]
    )

    const hasActivity = activityData.some((point) => point.debit > 0 || point.credit > 0)

    const allocationData = useMemo(
        () =>
            (summary.data?.allocation ?? []).map((slice) => ({
                name: slice.name,
                value: Number(slice.value),
                percent: slice.percent,
                label: formatMoney(slice.value, currency),
            })),
        [summary.data?.allocation, currency]
    )

    const hasAllocation = allocationData.some((slice) => slice.value > 0)

    /* -------------------------------------------------------------- actions */

    const handleCreateVirtualCard = async (event: React.FormEvent) => {
        event.preventDefault()

        const amount = newCardLimit.trim()
        if (!amount || Number(amount) <= 0) {
            toast.error('Enter a funding amount greater than zero')
            return
        }

        try {
            const result = await issueCard.mutateAsync({
                amount,
                currency: 'USD',
                holder: newCardHolder || me.data?.name,
                type: 'Virtual',
            })
            setIsAddCardOpen(false)
            setCardStackOffset(0)
            toast.success(`Card •••• ${result.card.last4} issued`)
            if (result.warning) toast(result.warning, { icon: '⚠️', duration: 6000 })
        } catch (error) {
            toast.error(error instanceof ApiRequestError ? error.message : 'Could not issue the card')
        }
    }

    const CustomActivityTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null
        const point = payload[0].payload
        return (
            <div className="rounded-xl bg-[#19191b] px-3 py-2 text-xs font-bold text-white shadow-xl dark:bg-white dark:text-black">
                <p>{point.debitLabel} spent</p>
                <p className="text-[10px] font-semibold opacity-70">{point.creditLabel} received</p>
                <span className="text-[10px] font-normal opacity-60">{point.day}</span>
            </div>
        )
    }

    const renderActionMenu = (id: string) => (
        <div
            className="absolute right-0 top-8 z-30 w-44 rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#18181b]"
            onClick={(event) => event.stopPropagation()}
        >
            <Link
                href="/dashboard/analytics"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#1c1c24] hover:bg-[#f5f5f7] dark:text-white dark:hover:bg-white/5"
            >
                <TrendingUp size={14} />
                <span>View Analytics</span>
            </Link>
            <button
                type="button"
                onClick={() => {
                    setActiveMenuId(null)
                    void summary.refetch()
                    void me.refetch()
                    toast.success('Refreshed from the ledger')
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#1c1c24] hover:bg-[#f5f5f7] dark:text-white dark:hover:bg-white/5"
            >
                <RefreshCw size={14} />
                <span>Refresh Stats</span>
            </button>
            <button
                type="button"
                onClick={() => {
                    setActiveMenuId(null)
                    exportLedgerCsv(summary.data?.recentTransactions ?? [])
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#1c1c24] hover:bg-[#f5f5f7] dark:text-white dark:hover:bg-white/5"
                key={id}
            >
                <Download size={14} />
                <span>Export CSV</span>
            </button>
        </div>
    )

    const toggleMenu = (id: string) => setActiveMenuId((current) => (current === id ? null : id))

    const loading = summary.isLoading || me.isLoading

    return (
        <div className="space-y-6 pb-12 sm:space-y-7">
            {summary.isError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#ef5362]/20 bg-[#ffebeb] px-4 py-3 text-xs font-semibold text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                    <AlertCircle size={16} />
                    <span>We could not load your dashboard data. Try refreshing.</span>
                </div>
            )}

            {/* ===================== TOP ROW ===================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* My Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col lg:col-span-4 xl:col-span-4"
                >
                    <div className="group relative flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_12px_36px_rgba(112,66,244,0.06)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    My Cards
                                </h2>
                                <p className="text-[11px] text-[#81858c]">
                                    {cards.length > 0
                                        ? `${cards.length} card${cards.length > 1 ? 's' : ''} • tap to cycle`
                                        : 'No cards issued yet'}
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => setIsAddCardOpen(true)}
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-[#111] text-white shadow-md transition-all hover:bg-black dark:bg-white dark:text-black"
                                title="Issue new virtual card"
                            >
                                <Plus size={17} strokeWidth={2.5} />
                            </motion.button>
                        </div>

                        <div className="my-auto flex w-full items-center justify-center py-4">
                            {cards.length > 0 ? (
                                <CardStack
                                    cards={cards}
                                    activeIndex={cardStackOffset}
                                    onActiveIndexChange={setCardStackOffset}
                                />
                            ) : (
                                <EmptyCardSlot onIssue={() => setIsAddCardOpen(true)} loading={loading} />
                            )}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-black/[0.04] pt-3 text-xs dark:border-white/[0.06]">
                            <span className="text-[11px] font-medium text-[#777984] dark:text-[#888a93]">
                                {currentCard ? 'Available: ' : 'Wallet: '}
                                <strong className="text-[#1c1c24] dark:text-white">
                                    {formatMoney(currentCard?.availableToSpend ?? walletBalance, currency)}
                                </strong>
                            </span>
                            <Link
                                href="/dashboard/cards"
                                className="flex items-center gap-1 font-bold text-[#6330cf] transition-colors hover:text-[#8553ec] dark:text-[#bca4ff]"
                            >
                                <span>Manage</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    </div>
                </motion.div>

                {/* Stats + activity */}
                <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-8">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
                        <StatCardShell
                            icon={<WalletCards size={17} />}
                            iconClass="bg-[#f4f0ff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]"
                            label="Wallet Balance"
                            menuId="balance"
                            activeMenuId={activeMenuId}
                            onToggleMenu={toggleMenu}
                            renderMenu={renderActionMenu}
                            delay={0.05}
                        >
                            <div className="mt-3">
                                <p className="text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-[28px]">
                                    {loading ? '—' : formatMoney(walletBalance, currency)}
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>vs. previous close</span>
                                {summary.data && <DeltaBadge delta={summary.data.walletBalance} />}
                            </div>
                        </StatCardShell>

                        <StatCardShell
                            icon={<ArrowDownLeft size={17} />}
                            iconClass="bg-[#ebfbf6] text-[#19c9a2] dark:bg-[#0b3c32] dark:text-[#28d6aa]"
                            label="Income This Month"
                            menuId="income"
                            activeMenuId={activeMenuId}
                            onToggleMenu={toggleMenu}
                            renderMenu={renderActionMenu}
                            delay={0.1}
                        >
                            <div className="mt-3">
                                <p className="text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-[28px]">
                                    {loading ? '—' : formatMoney(summary.data?.totalIncome.value ?? 0, currency)}
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>From last month</span>
                                {summary.data && <DeltaBadge delta={summary.data.totalIncome} />}
                            </div>
                        </StatCardShell>

                        <StatCardShell
                            icon={<ArrowUpRight size={17} />}
                            iconClass="bg-[#fef7eb] text-[#e9a72b] dark:bg-[#38270b] dark:text-[#f7b746]"
                            label="Spend This Month"
                            menuId="expend"
                            activeMenuId={activeMenuId}
                            onToggleMenu={toggleMenu}
                            renderMenu={renderActionMenu}
                            delay={0.15}
                        >
                            <div className="mt-3">
                                <p className="text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-[28px]">
                                    {loading ? '—' : formatMoney(summary.data?.totalExpense.value ?? 0, currency)}
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>From last month</span>
                                {summary.data && <DeltaBadge delta={summary.data.totalExpense} invert />}
                            </div>
                        </StatCardShell>
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-12">
                        {/* Activity chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.2 }}
                            className="flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none md:col-span-7"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    Activity Summary
                                </h2>
                                <div className="flex items-center rounded-full bg-[#f5f5f7] p-1 dark:bg-white/[0.06]">
                                    {(['Day', 'Week', 'Month'] as const).map((period) => (
                                        <button
                                            key={period}
                                            type="button"
                                            onClick={() => setActivePeriod(period)}
                                            className={cn(
                                                'cursor-pointer rounded-full px-3.5 py-1 text-[11px] font-bold transition-all',
                                                activePeriod === period
                                                    ? 'bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                                                    : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                                            )}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mt-4 h-[180px] w-full">
                                {mounted && hasActivity ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={activityData}
                                            margin={{ top: 25, right: 10, left: -15, bottom: 0 }}
                                            barSize={24}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                                stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 9, fill: '#9a9ca4', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(value) =>
                                                    value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value}`
                                                }
                                            />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fontSize: 10, fill: '#81858c', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={6}
                                            />
                                            <RechartsTooltip
                                                content={<CustomActivityTooltip />}
                                                cursor={{ fill: 'transparent' }}
                                            />
                                            <Bar dataKey="debit" stackId="a" fill="#7042f4" />
                                            <Bar
                                                dataKey="credit"
                                                stackId="a"
                                                fill={theme === 'dark' ? '#281b45' : '#f0eaff'}
                                                radius={[6, 6, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyChart
                                        message={
                                            loading
                                                ? 'Loading activity…'
                                                : 'No transactions in this period yet.'
                                        }
                                    />
                                )}
                            </div>
                        </motion.div>

                        {/* Recent transactions */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.25 }}
                            className="flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none md:col-span-5"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    Recent Transactions
                                </h2>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => toggleMenu('recent')}
                                        className="cursor-pointer rounded-full p-1 text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white"
                                        aria-label="Recent transactions menu"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {activeMenuId === 'recent' && renderActionMenu('recent')}
                                </div>
                            </div>

                            <div className="flex-1 space-y-3">
                                {(summary.data?.recentTransactions ?? []).slice(0, 4).map((tx) => (
                                    <TransactionRow key={tx.id} tx={tx} />
                                ))}

                                {!loading && (summary.data?.recentTransactions ?? []).length === 0 && (
                                    <p className="py-8 text-center text-xs text-[#81858c]">
                                        No transactions yet. Fund your wallet to get started.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ===================== BOTTOM ROW ===================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Card allocations */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                    className="flex flex-col gap-6 lg:col-span-4 xl:col-span-4"
                >
                    <div className="flex flex-1 flex-col rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Card Allocations
                            </h2>
                            <Link
                                href="/dashboard/cards"
                                className="text-[11px] font-bold text-[#6330cf] dark:text-[#bca4ff]"
                            >
                                Manage
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {cards.slice(0, 3).map((card) => (
                                <div
                                    key={card.cardId}
                                    className="rounded-2xl border border-black/[0.03] bg-[#fafafc] p-3.5 dark:border-white/[0.04] dark:bg-white/[0.03]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7042f4] text-white shadow-sm">
                                                <CreditCard size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                    {formatMoney(card.totalSpentByCard, card.currency)} spent
                                                </p>
                                                <p className="text-[10px] text-[#81858c]">
                                                    •••• {card.last4} · {card.status.toLowerCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-extrabold text-[#1c1c24] dark:text-white">
                                            {Math.round(card.utilisation)}%
                                        </span>
                                    </div>

                                    <div className="mt-3">
                                        <div className="mb-1 flex justify-between text-[9px] text-[#9a9ca4]">
                                            <span>Limit: {formatMoney(card.cardSpendingLimit, card.currency)}</span>
                                            <span>{formatMoney(card.availableToSpend, card.currency)} left</span>
                                        </div>
                                        <div className="relative h-2 w-full rounded-full bg-[#f0eaff] dark:bg-white/[0.08]">
                                            <div
                                                className="h-full rounded-full bg-[#7042f4]"
                                                style={{ width: `${Math.min(100, card.utilisation)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {!loading && cards.length === 0 && (
                                <div className="space-y-3 rounded-2xl border border-dashed border-black/[0.08] p-6 text-center dark:border-white/10">
                                    <p className="text-xs text-[#81858c]">
                                        No cards yet. Issue one to allocate part of your wallet to it.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddCardOpen(true)}
                                        className="rounded-xl bg-[#6330cf] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                                    >
                                        + Issue Virtual Card
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Wallet allocation donut */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.35 }}
                    className="flex flex-col lg:col-span-4 xl:col-span-3"
                >
                    <div className="flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div>
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Wallet Allocation
                            </h2>
                            <p className="text-[11px] text-[#81858c]">Reserved by cards vs. free capital</p>
                        </div>

                        <div className="relative my-auto flex h-[200px] w-full items-center justify-center">
                            {mounted && hasAllocation ? (
                                <>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={allocationData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={62}
                                                outerRadius={88}
                                                paddingAngle={3}
                                            >
                                                {allocationData.map((slice, index) => (
                                                    <Cell
                                                        key={slice.name}
                                                        fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value: any, name: any) => [
                                                    formatMoney(String(value), currency),
                                                    name,
                                                ]}
                                                contentStyle={{
                                                    background: theme === 'dark' ? '#18181b' : '#ffffff',
                                                    border:
                                                        theme === 'dark'
                                                            ? '1px solid rgba(255,255,255,0.1)'
                                                            : '1px solid rgba(0,0,0,0.08)',
                                                    borderRadius: '14px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute flex flex-col items-center">
                                        <span className="text-[10px] font-semibold text-[#81858c]">Total</span>
                                        <span className="text-lg font-black text-[#1c1c24] dark:text-white">
                                            {formatMoney(walletBalance, currency)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <EmptyChart
                                    message={loading ? 'Loading…' : 'Fund your wallet to see the split.'}
                                />
                            )}
                        </div>

                        <div className="space-y-2 border-t border-black/[0.03] pt-3 dark:border-white/[0.04]">
                            {allocationData.map((slice, index) => (
                                <div key={slice.name} className="flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: ALLOCATION_COLORS[index % 2] }}
                                        />
                                        <span className="font-semibold text-[#1c1c24] dark:text-white">
                                            {slice.name}
                                        </span>
                                    </div>
                                    <span className="font-bold text-[#81858c]">{slice.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Ledger table */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.4 }}
                    className="flex flex-col lg:col-span-4 xl:col-span-5"
                >
                    <div className="flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Latest Movements
                            </h2>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9ca4]"
                                        size={13}
                                    />
                                    <input
                                        type="text"
                                        value={searchLedger}
                                        onChange={(event) => setSearchLedger(event.target.value)}
                                        placeholder="Search..."
                                        className="h-8 w-28 rounded-full bg-[#f5f5f7] pl-8 pr-3 text-[11px] outline-none transition-all focus:w-44 focus:ring-1 focus:ring-[#7042f4] dark:bg-white/[0.06] dark:text-white sm:w-36"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setStatusFilter((current) =>
                                            current === 'All'
                                                ? 'SUCCESS'
                                                : current === 'SUCCESS'
                                                  ? 'PENDING'
                                                  : current === 'PENDING'
                                                    ? 'FAILED'
                                                    : 'All'
                                        )
                                    }
                                    className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[10px] font-bold text-[#81858c] hover:text-[#1c1c24] dark:bg-white/[0.06] dark:hover:text-white"
                                    title="Cycle status filter"
                                >
                                    <SlidersHorizontal size={12} />
                                    <span>{statusFilter === 'All' ? 'All' : statusFilter.toLowerCase()}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <div className="min-w-[370px]">
                                <div className="grid select-none grid-cols-5 gap-2 rounded-xl bg-[#f9f9fb] px-3 py-2 text-[9px] font-extrabold text-[#9a9ca4] dark:bg-white/[0.03]">
                                    <span className="col-span-2">Merchant</span>
                                    <span>Date</span>
                                    <span
                                        onClick={() => setSortAsc(!sortAsc)}
                                        className="flex cursor-pointer items-center gap-1 hover:text-[#1c1c24] dark:hover:text-white"
                                    >
                                        <span>Amount</span>
                                        <span className="text-[8px]">{sortAsc ? '▲' : '▼'}</span>
                                    </span>
                                    <span className="text-right">Status</span>
                                </div>

                                <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                                    <AnimatePresence>
                                        {ledgerRows.map((row) => (
                                            <motion.div
                                                key={row.id}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="grid grid-cols-5 items-center gap-2 px-3 py-3 text-[11px] transition-colors hover:bg-[#fafafc] dark:hover:bg-white/[0.02]"
                                            >
                                                <div className="col-span-2 min-w-0">
                                                    <p className="truncate font-bold text-[#1c1c24] dark:text-white">
                                                        {row.merchant}
                                                    </p>
                                                    <p className="truncate text-[9px] text-[#9a9ca4]">
                                                        {row.category}
                                                    </p>
                                                </div>

                                                <span className="text-[10px] text-[#81858c]">
                                                    {new Date(row.createdAt).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>

                                                <span
                                                    className={cn(
                                                        'font-extrabold',
                                                        row.type === 'CREDIT'
                                                            ? 'text-[#12b88f]'
                                                            : 'text-[#1c1c24] dark:text-white'
                                                    )}
                                                >
                                                    {row.type === 'CREDIT' ? '+' : '−'}
                                                    {formatMoney(row.amount, row.currency).replace('-', '')}
                                                </span>

                                                <div className="text-right">
                                                    <StatusPill status={row.status} />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {!loading && ledgerRows.length === 0 && (
                                        <p className="py-8 text-center text-xs text-[#81858c]">
                                            Nothing matches this filter.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 border-t border-black/[0.03] pt-3 text-right dark:border-white/[0.04]">
                            <Link
                                href="/dashboard/transactions"
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#6330cf] transition-colors hover:text-[#8553ec] dark:text-[#bca4ff]"
                            >
                                <span>View all transactions</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ===================== Issue card modal ===================== */}
            <AnimatePresence>
                {isAddCardOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsAddCardOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 15 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="relative z-10 w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 text-[#1c1c24] shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] dark:text-white"
                        >
                            <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
                                <div>
                                    <h3 className="text-base font-bold">Issue Virtual Card</h3>
                                    <p className="text-xs text-[#81858c]">
                                        Allocates from your {formatMoney(walletBalance, currency)} wallet
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAddCardOpen(false)}
                                    className="rounded-full p-1 text-[#81858c] hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateVirtualCard} className="space-y-4 pt-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">
                                        Cardholder Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newCardHolder}
                                        onChange={(event) => setNewCardHolder(event.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">
                                        Amount to allocate (USD)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={newCardLimit}
                                        onChange={(event) => setNewCardLimit(event.target.value)}
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="flex items-center gap-2 rounded-xl bg-[#f0eaff] p-3 text-xs font-medium text-[#6330cf] dark:bg-[#281b45] dark:text-[#c4a8ff]">
                                    <Sparkles size={16} className="shrink-0" />
                                    <span>
                                        This becomes the card&apos;s spending limit. It stays in your wallet until the
                                        card is used.
                                    </span>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddCardOpen(false)}
                                        className="flex-1 rounded-xl border border-black/[0.08] py-2.5 text-xs font-bold text-[#81858c] hover:bg-black/5 dark:border-white/[0.08] dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={issueCard.isPending}
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-60"
                                    >
                                        {issueCard.isPending ? 'Issuing…' : 'Issue Card'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

/** Placeholder that keeps the panel's proportions before any card exists. */
function EmptyCardSlot({ onIssue, loading }: { onIssue: () => void; loading: boolean }) {
    return (
        <div
            className="flex w-full flex-col items-center justify-center gap-3 rounded-[6.5%/10.3%] border border-dashed border-black/[0.1] bg-[#fafafc] dark:border-white/[0.12] dark:bg-white/[0.03]"
            style={{ aspectRatio: `${CARD_ASPECT_RATIO}` }}
        >
            {loading ? (
                <p className="text-xs font-medium text-[#9a9ca4]">Loading cards…</p>
            ) : (
                <>
                    <CreditCard size={26} className="text-[#b9bbc4] dark:text-white/25" />
                    <p className="px-6 text-center text-[11px] font-medium text-[#9a9ca4]">
                        No cards yet. Issue one against your wallet balance.
                    </p>
                    <button
                        type="button"
                        onClick={onIssue}
                        className="rounded-xl bg-[#6330cf] px-4 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                        + Issue Virtual Card
                    </button>
                </>
            )}
        </div>
    )
}

function TransactionRow({ tx }: { tx: LedgerTransaction }) {
    const isCredit = tx.type === 'CREDIT'

    return (
        <motion.div
            whileHover={{ x: 3 }}
            className="flex items-center justify-between rounded-xl p-1.5 transition-colors hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04]"
        >
            <Link href="/dashboard/transactions" className="flex flex-1 items-center gap-3">
                <div
                    className={cn(
                        'flex h-8 w-11 shrink-0 items-center justify-center rounded-lg text-[9px] font-black shadow-sm',
                        isCredit
                            ? 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                            : 'bg-[#f4f0ff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]'
                    )}
                >
                    {tx.channel === 'MPESA'
                        ? 'MPESA'
                        : tx.channel === 'CRYPTO'
                          ? 'USDC'
                          : tx.cardLast4
                            ? `••${tx.cardLast4.slice(-2)}`
                            : 'CARD'}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#1c1c24] dark:text-white">{tx.merchant}</p>
                    <p className="text-[10px] text-[#9a9ca4]">
                        {new Date(tx.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </p>
                </div>
            </Link>

            <span className={cn('pl-2 text-xs font-extrabold', isCredit ? 'text-[#12b88f]' : 'text-[#ef5362]')}>
                {isCredit ? '+ ' : '− '}
                {formatMoney(tx.amount, tx.currency).replace('-', '')}
            </span>
        </motion.div>
    )
}

function StatusPill({ status }: { status: LedgerTransaction['status'] }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold',
                status === 'SUCCESS' && 'bg-[#e4f8f3] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]',
                status === 'PENDING' && 'bg-[#fef7eb] text-[#e9a72b] dark:bg-[#38270b] dark:text-[#f7b746]',
                status === 'FAILED' && 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]'
            )}
        >
            {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    )
}

function EmptyChart({ message }: { message: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-black/[0.06] dark:border-white/[0.08]">
            <p className="px-6 text-center text-xs font-medium text-[#9a9ca4]">{message}</p>
        </div>
    )
}

/** Builds a CSV from the rows already on screen - no extra request needed. */
function exportLedgerCsv(rows: LedgerTransaction[]) {
    if (rows.length === 0) {
        toast.error('Nothing to export yet')
        return
    }

    const header = ['Date', 'Merchant', 'Category', 'Channel', 'Type', 'Amount', 'Currency', 'Status']
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`

    const csv = [
        header.join(','),
        ...rows.map((row) =>
            [
                new Date(row.createdAt).toISOString(),
                row.merchant,
                row.category,
                row.channel,
                row.type,
                row.amount,
                row.currency,
                row.status,
            ]
                .map((value) => escape(String(value)))
                .join(',')
        ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `swippable-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
}
