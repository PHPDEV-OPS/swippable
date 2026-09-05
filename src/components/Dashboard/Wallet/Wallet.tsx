'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useTheme } from 'next-themes'
import {
    Copy,
    Check,
    QrCode,
    RefreshCw,
    Smartphone,
    CreditCard,
    TrendingUp,
    Coins,
    X,
    AlertCircle,
} from 'lucide-react'
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import {
    ApiRequestError,
    useCards,
    useDeposit,
    useFundCard,
    useLinkWallet,
    useSandboxTopUp,
    useTransactions,
    useWallet,
} from '@/lib/client-api'

type Timeframe = '7D' | '1M' | '1Y'

const ASSET_COLORS = ['#7042f4', '#12b88f', '#f79e1b']

function errorMessage(error: unknown, fallback: string) {
    return error instanceof ApiRequestError ? error.message : fallback
}

export function Wallet() {
    const { theme } = useTheme()
    const { address: wagmiAddress, isConnected } = useAccount()

    const [mounted, setMounted] = useState(false)
    const [copied, setCopied] = useState(false)
    const [timeframe, setTimeframe] = useState<Timeframe>('7D')

    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
    const [isTopUpCardModalOpen, setIsTopUpCardModalOpen] = useState(false)

    const [depositChannel, setDepositChannel] = useState<'MPESA' | 'CRYPTO'>('MPESA')
    const [depositAmount, setDepositAmount] = useState('1000')
    const [depositPhone, setDepositPhone] = useState('')
    const [depositTxHash, setDepositTxHash] = useState('')

    const [topUpCardId, setTopUpCardId] = useState('')
    const [topUpAmount, setTopUpAmount] = useState('100')

    const wallet = useWallet(timeframe)
    const cardsQuery = useCards()
    const transactionsQuery = useTransactions()

    const deposit = useDeposit()
    const fundCard = useFundCard()
    const linkWallet = useLinkWallet()
    const sandboxTopUp = useSandboxTopUp()

    useEffect(() => setMounted(true), [])

    const activeAddress = wagmiAddress ?? wallet.data?.onChainAddress ?? null

    // Store a newly connected address so incoming USDC can be matched to this user.
    useEffect(() => {
        if (!isConnected || !wagmiAddress) return
        if (wallet.data?.onChainAddress?.toLowerCase() === wagmiAddress.toLowerCase()) return
        linkWallet.mutate(wagmiAddress)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, wagmiAddress, wallet.data?.onChainAddress])

    const cards = cardsQuery.data ?? []

    useEffect(() => {
        if (!topUpCardId && cards.length > 0) setTopUpCardId(cards[0].cardId)
    }, [cards, topUpCardId])

    const currency = wallet.data?.currency ?? 'USD'
    const balance = wallet.data?.balance ?? '0.00'

    const seriesData = useMemo(
        () =>
            (wallet.data?.series ?? []).map((point) => ({
                date: point.label,
                value: Number(point.value),
            })),
        [wallet.data?.series]
    )

    const hasSeries = seriesData.some((point) => point.value !== 0)

    const assets = wallet.data?.assets ?? []
    const assetSlices = useMemo(
        () => assets.map((asset) => ({ ...asset, numeric: Number(asset.valueUsd) })).filter((a) => a.numeric > 0),
        [assets]
    )

    const walletTransactions = useMemo(
        () => (transactionsQuery.data ?? []).filter((tx) => tx.channel !== 'CARD_TRANSACTION').slice(0, 8),
        [transactionsQuery.data]
    )

    const handleCopyAddress = () => {
        if (!activeAddress) {
            toast.error('Connect a wallet first')
            return
        }
        navigator.clipboard.writeText(activeAddress)
        setCopied(true)
        toast.success('Address copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDeposit = async (event: React.FormEvent) => {
        event.preventDefault()

        if (!depositAmount || Number(depositAmount) <= 0) {
            toast.error('Enter an amount greater than zero')
            return
        }

        try {
            const result = await deposit.mutateAsync({
                channel: depositChannel,
                amount: depositAmount,
                currency: depositChannel === 'MPESA' ? 'KES' : 'USD',
                phone: depositChannel === 'MPESA' ? depositPhone : undefined,
                txHash: depositChannel === 'CRYPTO' ? depositTxHash : undefined,
                address: activeAddress ?? undefined,
            })
            setIsDepositModalOpen(false)
            toast.success(result.message, { duration: 6000 })
        } catch (error) {
            toast.error(errorMessage(error, 'Could not start the deposit'), { duration: 6000 })
        }
    }

    const handleTopUpCard = async (event: React.FormEvent) => {
        event.preventDefault()

        if (!topUpCardId) {
            toast.error('Issue a card first')
            return
        }
        if (!topUpAmount || Number(topUpAmount) <= 0) {
            toast.error('Enter an amount greater than zero')
            return
        }

        try {
            const result = await fundCard.mutateAsync({
                cardId: topUpCardId,
                amount: topUpAmount,
                action: 'FUND',
            })
            setIsTopUpCardModalOpen(false)
            toast.success(`${formatMoney(topUpAmount)} allocated to •••• ${result.card.last4}`)
            if (result.warning) toast(result.warning, { icon: '⚠️', duration: 6000 })
        } catch (error) {
            toast.error(errorMessage(error, 'Could not fund the card'))
        }
    }

    const isDev = process.env.NODE_ENV !== 'production'

    return (
        <div className="space-y-7 pb-16">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-3xl">
                        Wallet &amp; Liquidity Hub
                    </h1>
                    <p className="text-sm text-[#777984] dark:text-[#888a93]">
                        One shared balance funds every card you issue
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setIsReceiveModalOpen(true)}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl border border-black/[0.05] bg-white px-4 py-2.5 text-xs font-bold text-[#1c1c24] shadow-sm transition-colors hover:bg-[#f5f5f7] dark:border-white/[0.08] dark:bg-[#121214] dark:text-white dark:hover:bg-white/5"
                    >
                        <QrCode size={15} />
                        <span>Receive</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setIsDepositModalOpen(true)}
                        className="flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-95"
                    >
                        <Coins size={14} />
                        <span>Deposit Funds</span>
                    </motion.button>
                </div>
            </div>

            {wallet.isError && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#ef5362]/20 bg-[#ffebeb] px-4 py-3 text-xs font-semibold text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                    <AlertCircle size={16} />
                    <span>We could not load your wallet. Try refreshing.</span>
                </div>
            )}

            {/* Hero + assets */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col lg:col-span-5"
                >
                    <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-[28px] bg-gradient-to-br from-[#622fcf] via-[#7d48ea] to-[#12b88f] p-6 text-white shadow-[0_20px_42px_rgba(99,48,207,0.3)]">
                        <div className="pointer-events-none absolute -inset-full bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.2)_48%,rgba(255,255,255,0.05)_55%,transparent_70%)] opacity-80" />

                        <div className="relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur-md">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#19c9a2]" />
                                    <span>Swippable Core Wallet</span>
                                </div>
                                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/80">
                                    {currency}
                                </span>
                            </div>

                            <div className="mt-6">
                                <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                                    Total Wallet Balance
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl">
                                    {wallet.isLoading ? '—' : formatMoney(balance, currency)}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Pill>
                                        <TrendingUp size={13} />
                                        {formatMoney(wallet.data?.totalDeposited ?? 0, currency)} deposited
                                    </Pill>
                                    <Pill>
                                        <CreditCard size={13} />
                                        {formatMoney(wallet.data?.allocatedToCards ?? 0, currency)} on cards
                                    </Pill>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-6 border-t border-white/20 pt-5">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-medium text-white/70">On-chain address</p>
                                    <p className="truncate font-mono text-xs font-bold text-white">
                                        {activeAddress
                                            ? `${activeAddress.slice(0, 8)}…${activeAddress.slice(-6)}`
                                            : 'No wallet linked'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyAddress}
                                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/25"
                                        title="Copy wallet address"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsTopUpCardModalOpen(true)}
                                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#6330cf] shadow-md transition-all hover:bg-white/95"
                                    >
                                        <CreditCard size={14} />
                                        <span>Fund Card</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="flex flex-col justify-between gap-4 sm:gap-5 lg:col-span-7">
                    {assets.map((asset, index) => (
                        <motion.div
                            key={asset.symbol}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: index * 0.08 }}
                            whileHover={{ y: -2 }}
                            className="flex items-center justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center gap-3.5">
                                <div
                                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm"
                                    style={{ backgroundColor: ASSET_COLORS[index % ASSET_COLORS.length] }}
                                >
                                    {index === 0 ? <Coins size={20} /> : index === 1 ? <CreditCard size={20} /> : '₵'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-[#1c1c24] dark:text-white">
                                            {asset.name}
                                        </h3>
                                        <span className="rounded-md bg-[#f0eaff] px-1.5 py-0.5 text-[9px] font-extrabold text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]">
                                            {asset.symbol}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] font-medium text-[#81858c]">
                                        {asset.network}
                                        {asset.allocation > 0 && ` • ${asset.allocation}% of wallet`}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-base font-extrabold text-[#1c1c24] dark:text-white sm:text-lg">
                                    {formatMoney(asset.valueUsd, currency)}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Balance chart + allocation */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                    className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none lg:col-span-8 sm:p-7"
                >
                    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Balance Progression
                            </h2>
                            <p className="text-xs text-[#81858c]">
                                Daily closing balance, reconstructed from your ledger
                            </p>
                        </div>

                        <div className="flex items-center rounded-full bg-[#f5f5f7] p-1 dark:bg-white/[0.06]">
                            {(['7D', '1M', '1Y'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setTimeframe(option)}
                                    className={cn(
                                        'cursor-pointer rounded-full px-3.5 py-1 text-[11px] font-bold transition-all',
                                        timeframe === option
                                            ? 'bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                                            : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[250px] w-full">
                        {mounted && hasSeries ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={seriesData}>
                                    <defs>
                                        <linearGradient id="walletGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7042f4" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#7042f4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#81858c', fontSize: 11, fontWeight: 600 }}
                                        dy={6}
                                        minTickGap={20}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#81858c', fontSize: 10, fontWeight: 600 }}
                                        tickFormatter={(value) =>
                                            value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${value}`
                                        }
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: theme === 'dark' ? '#18181b' : '#ffffff',
                                            border:
                                                theme === 'dark'
                                                    ? '1px solid rgba(255,255,255,0.1)'
                                                    : '1px solid rgba(0,0,0,0.08)',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                        }}
                                        formatter={(value: any) => [formatMoney(String(value), currency), 'Balance']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#7042f4"
                                        strokeWidth={3.5}
                                        fill="url(#walletGradient)"
                                        dot={false}
                                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState
                                message={
                                    wallet.isLoading
                                        ? 'Loading balance history…'
                                        : 'Deposit funds to start building your balance history.'
                                }
                            />
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25 }}
                    className="flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none lg:col-span-4 sm:p-7"
                >
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            Liquidity Split
                        </h2>
                        <p className="text-xs text-[#81858c]">Where your balance is currently sitting</p>
                    </div>

                    <div className="my-auto h-[180px] w-full">
                        {mounted && assetSlices.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={assetSlices}
                                        dataKey="numeric"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={4}
                                    >
                                        {assetSlices.map((_, index) => (
                                            <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: any, name: any) => [
                                            formatMoney(String(value), currency),
                                            String(name),
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
                        ) : (
                            <EmptyState message={wallet.isLoading ? 'Loading…' : 'Nothing to allocate yet.'} />
                        )}
                    </div>

                    <div className="space-y-2 border-t border-black/[0.04] pt-2 dark:border-white/[0.06]">
                        {assets.map((asset, index) => (
                            <div key={asset.symbol} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: ASSET_COLORS[index % ASSET_COLORS.length] }}
                                    />
                                    <span className="font-semibold text-[#1c1c24] dark:text-white">{asset.name}</span>
                                </div>
                                <span className="font-bold text-[#81858c]">
                                    {formatMoney(asset.valueUsd, currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Activity */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none sm:p-7"
            >
                <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            Deposits &amp; Card Funding
                        </h2>
                        <p className="text-xs text-[#81858c]">
                            Money entering your wallet and moving onto your cards
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {isDev && (
                            <button
                                type="button"
                                onClick={() =>
                                    sandboxTopUp.mutate('500.00', {
                                        onSuccess: (result) =>
                                            toast.success(result.message ?? 'Sandbox credit applied'),
                                        onError: (error) =>
                                            toast.error(errorMessage(error, 'Sandbox credit failed')),
                                    })
                                }
                                disabled={sandboxTopUp.isPending}
                                className="cursor-pointer rounded-xl bg-[#f0eaff] px-3 py-1.5 text-xs font-semibold text-[#6330cf] transition-colors hover:opacity-90 disabled:opacity-60 dark:bg-[#281b45] dark:text-[#c4a8ff]"
                                title="Development only: credit the wallet without a provider callback"
                            >
                                + $500 sandbox
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                void wallet.refetch()
                                void transactionsQuery.refetch()
                                toast.success('Refreshed')
                            }}
                            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#f5f5f7] px-3 py-1.5 text-xs font-semibold text-[#777984] transition-colors hover:text-[#1c1c24] dark:bg-white/5 dark:hover:text-white"
                        >
                            <RefreshCw size={13} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-black/[0.04] text-[10px] font-bold uppercase tracking-wider text-[#9a9ca4] dark:border-white/[0.06]">
                                <th className="pb-3.5">Action</th>
                                <th className="pb-3.5">Channel</th>
                                <th className="pb-3.5">Date</th>
                                <th className="pb-3.5">Reference</th>
                                <th className="pb-3.5">Status</th>
                                <th className="pb-3.5 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                            {walletTransactions.map((tx) => (
                                <tr
                                    key={tx.id}
                                    className="transition-colors hover:bg-[#fafafc] dark:hover:bg-white/[0.02]"
                                >
                                    <td className="py-4 font-bold text-[#1c1c24] dark:text-white">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={cn(
                                                    'flex h-8 w-8 items-center justify-center rounded-xl text-xs shadow-sm',
                                                    tx.type === 'CREDIT'
                                                        ? 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32]'
                                                        : 'bg-[#f0eaff] text-[#7042f4] dark:bg-[#281b45]'
                                                )}
                                            >
                                                {tx.type === 'CREDIT' ? '↓' : '↗'}
                                            </div>
                                            <span>{tx.merchant}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 font-semibold text-[#81858c]">
                                        {tx.channel.replace('_', ' ')}
                                    </td>
                                    <td className="py-4 text-[#81858c]">
                                        {new Date(tx.createdAt).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </td>
                                    <td className="py-4 font-mono text-[11px] text-[#7042f4] dark:text-[#c4a8ff]">
                                        {shortReference(tx.txId)}
                                    </td>
                                    <td className="py-4">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold',
                                                tx.status === 'SUCCESS' &&
                                                    'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]',
                                                tx.status === 'PENDING' &&
                                                    'bg-[#fef7eb] text-[#e9a72b] dark:bg-[#38270b] dark:text-[#f7b746]',
                                                tx.status === 'FAILED' &&
                                                    'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                            )}
                                        >
                                            {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right font-extrabold text-[#1c1c24] dark:text-white">
                                        {tx.type === 'CREDIT' ? '+ ' : '− '}
                                        {formatMoney(tx.amount, tx.currency).replace('-', '')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!transactionsQuery.isLoading && walletTransactions.length === 0 && (
                        <p className="py-10 text-center text-xs text-[#81858c]">
                            No wallet movements yet.{' '}
                            <button
                                type="button"
                                onClick={() => setIsDepositModalOpen(true)}
                                className="font-bold text-[#6330cf] dark:text-[#bca4ff]"
                            >
                                Make your first deposit
                            </button>
                            .
                        </p>
                    )}
                </div>
            </motion.div>

            {/* Receive modal */}
            <AnimatePresence>
                {isReceiveModalOpen && (
                    <Modal onClose={() => setIsReceiveModalOpen(false)} className="max-w-sm text-center">
                        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
                            <h3 className="text-base font-bold">Receive USDC</h3>
                            <CloseButton onClick={() => setIsReceiveModalOpen(false)} />
                        </div>

                        <div className="my-6 flex justify-center">
                            <div className="rounded-2xl border-2 border-black/[0.06] bg-white p-4 shadow-md dark:border-white/10">
                                <div className="relative flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-black/10 bg-[radial-gradient(#19191b_2px,transparent_2px)] [background-size:12px_12px]">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6330cf] to-[#12b88f] font-bold text-white shadow-md">
                                        S
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="mb-1 text-xs font-bold text-[#81858c]">Your Base network address</p>
                        <p className="break-all rounded-xl bg-[#f5f5f7] p-2.5 font-mono text-xs font-semibold dark:bg-white/5">
                            {activeAddress ?? 'Connect a wallet to generate a deposit address'}
                        </p>

                        <p className="mt-3 text-[11px] text-[#81858c]">
                            After sending, declare the transfer under Deposit Funds so it is credited as soon as it
                            confirms.
                        </p>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={handleCopyAddress}
                                disabled={!activeAddress}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-3 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copied ? 'Copied' : 'Copy Address'}</span>
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Deposit modal */}
            <AnimatePresence>
                {isDepositModalOpen && (
                    <Modal onClose={() => setIsDepositModalOpen(false)}>
                        <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
                            <div>
                                <h3 className="text-base font-bold">Deposit Funds</h3>
                                <p className="text-xs text-[#81858c]">Top up your shared wallet balance</p>
                            </div>
                            <CloseButton onClick={() => setIsDepositModalOpen(false)} />
                        </div>

                        <form onSubmit={handleDeposit} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-2">
                                <ChannelButton
                                    active={depositChannel === 'MPESA'}
                                    onClick={() => setDepositChannel('MPESA')}
                                    icon={<Smartphone size={15} />}
                                    label="M-Pesa"
                                />
                                <ChannelButton
                                    active={depositChannel === 'CRYPTO'}
                                    onClick={() => setDepositChannel('CRYPTO')}
                                    icon={<Coins size={15} />}
                                    label="USDC on Base"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-bold text-[#81858c]">
                                    Amount ({depositChannel === 'MPESA' ? 'KES' : 'USD'})
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={depositAmount}
                                    onChange={(event) => setDepositAmount(event.target.value)}
                                    className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-base font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                    required
                                />
                                {depositChannel === 'MPESA' && (
                                    <p className="mt-1 text-[10px] text-[#81858c]">
                                        Converted to USD at the live rate when the payment confirms.
                                    </p>
                                )}
                            </div>

                            {depositChannel === 'MPESA' ? (
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">
                                        M-Pesa phone number
                                    </label>
                                    <input
                                        type="tel"
                                        value={depositPhone}
                                        onChange={(event) => setDepositPhone(event.target.value)}
                                        placeholder="07XX XXX XXX"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                    <p className="mt-1 text-[10px] text-[#81858c]">
                                        You will get an STK prompt on this phone. Your balance updates only once you
                                        approve it.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">
                                        Transaction hash
                                    </label>
                                    <input
                                        type="text"
                                        value={depositTxHash}
                                        onChange={(event) => setDepositTxHash(event.target.value)}
                                        placeholder="0x…"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 font-mono text-xs outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                    <p className="mt-1 text-[10px] text-[#81858c]">
                                        Credited once the transfer reaches the required confirmations on Base.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDepositModalOpen(false)}
                                    className="flex-1 rounded-xl border border-black/[0.08] py-2.5 text-xs font-bold text-[#81858c] hover:bg-black/5 dark:border-white/[0.08] dark:hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={deposit.isPending}
                                    className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-60"
                                >
                                    {deposit.isPending ? 'Starting…' : 'Deposit'}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Fund card modal */}
            <AnimatePresence>
                {isTopUpCardModalOpen && (
                    <Modal onClose={() => setIsTopUpCardModalOpen(false)}>
                        <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
                            <div>
                                <h3 className="text-base font-bold">Fund a Virtual Card</h3>
                                <p className="text-xs text-[#81858c]">
                                    {formatMoney(wallet.data?.unallocated ?? 0, currency)} unallocated
                                </p>
                            </div>
                            <CloseButton onClick={() => setIsTopUpCardModalOpen(false)} />
                        </div>

                        {cards.length === 0 ? (
                            <div className="space-y-4 py-8 text-center">
                                <p className="text-xs text-[#81858c]">You do not have any cards yet.</p>
                                <Link
                                    href="/dashboard/cards"
                                    className="inline-block rounded-xl bg-[#6330cf] px-5 py-2.5 text-xs font-bold text-white"
                                >
                                    Issue a card
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleTopUpCard} className="space-y-4 pt-4">
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">Card</label>
                                    <select
                                        value={topUpCardId}
                                        onChange={(event) => setTopUpCardId(event.target.value)}
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-[#18181b] dark:text-white"
                                    >
                                        {cards.map((card) => (
                                            <option key={card.cardId} value={card.cardId}>
                                                •••• {card.last4} — {formatMoney(card.availableToSpend, card.currency)}{' '}
                                                available
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold text-[#81858c]">Amount (USD)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={topUpAmount}
                                        onChange={(event) => setTopUpAmount(event.target.value)}
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-base font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="flex gap-2">
                                    {['50', '100', '250', '500'].map((amount) => (
                                        <button
                                            key={amount}
                                            type="button"
                                            onClick={() => setTopUpAmount(amount)}
                                            className="flex-1 rounded-lg bg-[#f5f5f7] py-1.5 text-xs font-bold text-[#777984] hover:text-[#1c1c24] dark:bg-white/5 dark:hover:text-white"
                                        >
                                            ${amount}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsTopUpCardModalOpen(false)}
                                        className="flex-1 rounded-xl border border-black/[0.08] py-2.5 text-xs font-bold text-[#81858c] hover:bg-black/5 dark:border-white/[0.08] dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={fundCard.isPending}
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-60"
                                    >
                                        {fundCard.isPending ? 'Funding…' : 'Fund Card'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    )
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
            {children}
        </span>
    )
}

function ChannelButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all',
                active
                    ? 'border-transparent bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                    : 'border-transparent bg-[#f5f5f7] text-[#777984] dark:bg-white/5'
            )}
        >
            {icon}
            {label}
        </button>
    )
}

function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-full p-1 text-[#81858c] hover:bg-black/5 dark:hover:bg-white/10"
        >
            <X size={18} />
        </button>
    )
}

function Modal({
    children,
    onClose,
    className,
}: {
    children: React.ReactNode
    onClose: () => void
    className?: string
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                className={cn(
                    'relative z-10 w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 text-[#1c1c24] shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] dark:text-white',
                    className
                )}
            >
                {children}
            </motion.div>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-black/[0.06] dark:border-white/[0.08]">
            <p className="px-6 text-center text-xs font-medium text-[#9a9ca4]">{message}</p>
        </div>
    )
}

/** Shortens internal ids and on-chain hashes for the reference column. */
function shortReference(txId: string): string {
    if (txId.length <= 16) return txId
    return `${txId.slice(0, 8)}…${txId.slice(-6)}`
}
