'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'
import { useAccount, useDisconnect } from 'wagmi'
import { useTheme } from 'next-themes'
import {
    Wallet as WalletIcon,
    ArrowUpRight,
    ArrowDownLeft,
    Copy,
    Check,
    QrCode,
    RefreshCw,
    Send,
    Plus,
    CreditCard,
    Sparkles,
    TrendingUp,
    ExternalLink,
    ShieldCheck,
    Coins,
    X,
    SlidersHorizontal
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
    Cell
} from 'recharts'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface WalletAsset {
    symbol: string
    name: string
    balance: string
    valueUsd: number
    change24h: string
    isPositive: boolean
    icon: string
    network: string
    allocation: number
}

const portfolioChartData = {
    '7D': [
        { date: 'Mon', value: 11200 },
        { date: 'Tue', value: 11450 },
        { date: 'Wed', value: 11300 },
        { date: 'Thu', value: 11900 },
        { date: 'Fri', value: 12100 },
        { date: 'Sat', value: 12350 },
        { date: 'Sun', value: 12450.80 },
    ],
    '1M': [
        { date: 'Week 1', value: 10500 },
        { date: 'Week 2', value: 10950 },
        { date: 'Week 3', value: 11800 },
        { date: 'Week 4', value: 12450.80 },
    ],
    '1Y': [
        { date: 'Q1', value: 4200 },
        { date: 'Q2', value: 7800 },
        { date: 'Q3', value: 10200 },
        { date: 'Q4', value: 12450.80 },
    ]
}

const initialTransactions = [
    { id: 'tx_1', type: 'Deposit', asset: 'USDC', amount: '+ 1,500.00', usd: '+$1,500.00', date: 'Today, 2:34 PM', status: 'Completed', hash: '0x8f2a...9c41' },
    { id: 'tx_2', type: 'Card Top-up', asset: 'USDC', amount: '- 200.00', usd: '-$200.00', date: 'Yesterday', status: 'Completed', hash: '0x3c1b...7e90' },
    { id: 'tx_3', type: 'Transfer', asset: 'ETH', amount: '- 0.05', usd: '-$135.50', date: 'Sep 01, 2024', status: 'Completed', hash: '0x1d4e...2a65' },
    { id: 'tx_4', type: 'Deposit', asset: 'ETH', amount: '+ 0.50', usd: '+$1,350.00', date: 'Aug 28, 2024', status: 'Completed', hash: '0x7e8b...1f09' },
    { id: 'tx_5', type: 'Card Payment', asset: 'USD', amount: '- 45.00', usd: '-$45.00', date: 'Aug 25, 2024', status: 'Completed', hash: 'Bridgecard' },
]

export function Wallet() {
    const { user } = useUser()
    const { theme } = useTheme()
    const { address: wagmiAddress, isConnected } = useAccount()
    const [mounted, setMounted] = useState(false)
    const [copied, setCopied] = useState(false)
    const [timeframe, setTimeframe] = useState<'7D' | '1M' | '1Y'>('7D')
    const [dbWalletAddress, setDbWalletAddress] = useState<string | null>(null)
    const [transactions, setTransactions] = useState(initialTransactions)

    // Modals
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
    const [isSendModalOpen, setIsSendModalOpen] = useState(false)
    const [isTopUpCardModalOpen, setIsTopUpCardModalOpen] = useState(false)

    // Send Form
    const [sendAsset, setSendAsset] = useState('USDC')
    const [sendRecipient, setSendRecipient] = useState('')
    const [sendAmount, setSendAmount] = useState('')

    // Top up Form
    const [topUpAmount, setTopUpAmount] = useState('100')

    useEffect(() => {
        setMounted(true)
        // Fetch saved wallet
        fetch('/api/wallet')
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (data && data.base_account_address) {
                    setDbWalletAddress(data.base_account_address)
                }
            })
            .catch(() => undefined)
    }, [])

    const activeAddress = wagmiAddress || dbWalletAddress || '0x71C2834c8348dEa24559eb41c0A9e83Ef473E4b9'

    const handleCopyAddress = () => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(activeAddress)
            setCopied(true)
            toast.success('Address copied to clipboard!')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const assets: WalletAsset[] = [
        {
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '8,250.00',
            valueUsd: 8250.00,
            change24h: '+0.01%',
            isPositive: true,
            icon: '🪙',
            network: 'Base Mainnet',
            allocation: 66.2
        },
        {
            symbol: 'ETH',
            name: 'Ethereum',
            balance: '1.425',
            valueUsd: 3850.80,
            change24h: '+4.25%',
            isPositive: true,
            icon: '🔷',
            network: 'Base Mainnet',
            allocation: 30.9
        },
        {
            symbol: 'CARDS',
            name: 'Virtual Cards Balance',
            balance: '350.00',
            valueUsd: 350.00,
            change24h: '+0.00%',
            isPositive: true,
            icon: '💳',
            network: 'Swippable Issuing',
            allocation: 2.9
        }
    ]

    const handleSendCrypto = (e: React.FormEvent) => {
        e.preventDefault()
        const amt = parseFloat(sendAmount) || 0
        if (!amt || !sendRecipient) return

        const newTx = {
            id: `tx_${Date.now()}`,
            type: 'Transfer',
            asset: sendAsset,
            amount: `- ${amt.toFixed(sendAsset === 'ETH' ? 4 : 2)}`,
            usd: `-$${(amt * (sendAsset === 'ETH' ? 2700 : 1)).toFixed(2)}`,
            date: 'Just now',
            status: 'Completed',
            hash: '0x' + Math.random().toString(16).substring(2, 10) + '...'
        }
        setTransactions([newTx, ...transactions])
        toast.success(`Successfully sent ${amt} ${sendAsset}!`)
        setIsSendModalOpen(false)
        setSendAmount('')
        setSendRecipient('')
    }

    const handleTopUpCard = (e: React.FormEvent) => {
        e.preventDefault()
        const amt = parseFloat(topUpAmount) || 0
        if (!amt) return

        const newTx = {
            id: `tx_${Date.now()}`,
            type: 'Card Top-up',
            asset: 'USDC',
            amount: `- ${amt.toFixed(2)}`,
            usd: `-$${amt.toFixed(2)}`,
            date: 'Just now',
            status: 'Completed',
            hash: 'Bridgecard'
        }
        setTransactions([newTx, ...transactions])
        toast.success(`Loaded $${amt.toFixed(2)} onto your Swippable Card!`)
        setIsTopUpCardModalOpen(false)
    }

    return (
        <div className="space-y-7 pb-16">
            
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight mb-1">
                        Wallet & Liquidity Hub
                    </h1>
                    <p className="text-[#777984] dark:text-[#888a93] text-sm">
                        Manage your Base on-chain assets, deposits, and virtual card funding
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setIsReceiveModalOpen(true)}
                        className="flex items-center gap-2 rounded-2xl bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] px-4 py-2.5 text-xs font-bold text-[#1c1c24] dark:text-white shadow-sm hover:bg-[#f5f5f7] dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                        <QrCode size={15} />
                        <span>Deposit / Receive</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setIsSendModalOpen(true)}
                        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white px-5 py-2.5 text-xs font-bold shadow-md hover:opacity-95 transition-all cursor-pointer"
                    >
                        <Send size={14} />
                        <span>Send Crypto</span>
                    </motion.button>
                </div>
            </div>

            {/* Top Grid: Hero Wallet Card + 3 Metrics */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                
                {/* Hero Wallet Card (5 cols) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="lg:col-span-5 flex flex-col"
                >
                    <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-[28px] bg-gradient-to-br from-[#622fcf] via-[#7d48ea] to-[#12b88f] p-6 text-white shadow-[0_20px_42px_rgba(99,48,207,0.3)]">
                        {/* Decorative gloss effect */}
                        <div className="pointer-events-none absolute -inset-full bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.2)_48%,rgba(255,255,255,0.05)_55%,transparent_70%)] opacity-80" />

                        <div className="relative z-10">
                            {/* Top row: Badge and network */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur-md">
                                    <span className="h-2 w-2 rounded-full bg-[#19c9a2] animate-pulse" />
                                    <span>Base EVM Mainnet</span>
                                </div>
                                <span className="font-mono text-xs font-bold tracking-wider text-white/80 uppercase">
                                    Swippable Vault
                                </span>
                            </div>

                            {/* Balance */}
                            <div className="mt-6">
                                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                                    Total Portfolio Value
                                </p>
                                <p className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
                                    $12,450.80 <span className="text-xs font-bold text-white/80">USD</span>
                                </p>
                                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                                    <TrendingUp size={13} />
                                    <span>+18.4% this month</span>
                                </div>
                            </div>
                        </div>

                        {/* Bottom row: Address & Actions */}
                        <div className="relative z-10 mt-6 pt-5 border-t border-white/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-medium text-white/70">Wallet Address</p>
                                    <p className="font-mono text-xs font-bold text-white">
                                        {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyAddress}
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors cursor-pointer text-white"
                                        title="Copy wallet address"
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsTopUpCardModalOpen(true)}
                                        className="flex items-center gap-1.5 rounded-xl bg-white text-[#6330cf] px-3.5 py-2 text-xs font-bold shadow-md hover:bg-white/95 transition-all cursor-pointer"
                                    >
                                        <CreditCard size={14} />
                                        <span>Top Up Card</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 3 Stat Cards (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 justify-between">
                    {assets.map((asset, idx) => (
                        <motion.div
                            key={asset.symbol}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: idx * 0.08 }}
                            whileHover={{ y: -2 }}
                            className="flex items-center justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center gap-3.5">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7] dark:bg-white/5 text-2xl shadow-sm">
                                    {asset.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-[#1c1c24] dark:text-white">
                                            {asset.name}
                                        </h3>
                                        <span className="rounded-md bg-[#f0eaff] dark:bg-[#281b45] px-1.5 py-0.5 text-[9px] font-extrabold text-[#7042f4] dark:text-[#c4a8ff]">
                                            {asset.symbol}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[#81858c] font-medium mt-0.5">
                                        {asset.network} • {asset.allocation}% of Portfolio
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-base sm:text-lg font-extrabold text-[#1c1c24] dark:text-white">
                                    ${asset.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[11px] font-bold text-[#12b88f]">
                                    {asset.balance} {asset.symbol}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Middle Section: Recharts Portfolio Growth Chart & Asset Allocation */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                
                {/* Recharts AreaChart (8 cols) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                    className="lg:col-span-8 rounded-[28px] border border-black/[0.04] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Portfolio Balance Progression
                            </h2>
                            <p className="text-xs text-[#81858c]">
                                On-chain valuation across all connected vaults
                            </p>
                        </div>

                        {/* 7D, 1M, 1Y Toggle */}
                        <div className="flex items-center rounded-full bg-[#f5f5f7] p-1 dark:bg-white/[0.06]">
                            {(['7D', '1M', '1Y'] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTimeframe(t)}
                                    className={cn(
                                        'rounded-full px-3.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
                                        timeframe === t
                                            ? 'bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                                            : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[250px] w-full">
                        {mounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={portfolioChartData[timeframe]}>
                                    <defs>
                                        <linearGradient id="walletGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#7042f4" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#7042f4" stopOpacity={0.0} />
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
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#81858c', fontSize: 10, fontWeight: 600 }}
                                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            background: theme === 'dark' ? '#18181b' : '#ffffff',
                                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                            fontWeight: 'bold',
                                            fontSize: '12px'
                                        }}
                                        formatter={(val: any) => [`$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Balance']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#7042f4"
                                        strokeWidth={3.5}
                                        fill="url(#walletGradient)"
                                        dot={{ r: 4, fill: '#7042f4', strokeWidth: 0 }}
                                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Asset Allocation Pie (4 cols) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25 }}
                    className="lg:col-span-4 flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                >
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            Asset Allocation
                        </h2>
                        <p className="text-xs text-[#81858c]">
                            Liquidity distribution
                        </p>
                    </div>

                    <div className="h-[180px] w-full my-auto">
                        {mounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={assets}
                                        dataKey="valueUsd"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={4}
                                    >
                                        <Cell fill="#7042f4" />
                                        <Cell fill="#12b88f" />
                                        <Cell fill="#f79e1b" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                        {assets.map((a, i) => (
                            <div key={a.symbol} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: i === 0 ? '#7042f4' : i === 1 ? '#12b88f' : '#f79e1b' }}
                                    />
                                    <span className="font-semibold text-[#1c1c24] dark:text-white">{a.name}</span>
                                </div>
                                <span className="font-bold text-[#81858c]">{a.allocation}%</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row: Wallet Transaction Activity */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-[28px] border border-black/[0.04] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
            >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            On-Chain Activity & Vault History
                        </h2>
                        <p className="text-xs text-[#81858c]">
                            Recent deposits, card funding, and wallet transfers
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => toast.success('Transactions refreshed')}
                        className="flex items-center gap-1.5 rounded-xl bg-[#f5f5f7] dark:bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#777984] hover:text-[#1c1c24] dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <RefreshCw size={13} />
                        <span>Refresh</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-black/[0.04] dark:border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-[#9a9ca4]">
                                <th className="pb-3.5">Action / Type</th>
                                <th className="pb-3.5">Asset</th>
                                <th className="pb-3.5">Date</th>
                                <th className="pb-3.5">Tx Identifier</th>
                                <th className="pb-3.5">Status</th>
                                <th className="pb-3.5 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-[#fafafc] dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 font-bold text-[#1c1c24] dark:text-white">
                                        <div className="flex items-center gap-2.5">
                                            <div className={cn(
                                                'flex h-8 w-8 items-center justify-center rounded-xl text-xs shadow-sm',
                                                tx.type === 'Deposit' && 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32]',
                                                tx.type === 'Transfer' && 'bg-[#f0eaff] text-[#7042f4] dark:bg-[#281b45]',
                                                tx.type === 'Card Top-up' && 'bg-[#fef7eb] text-[#f79e1b] dark:bg-[#38270b]',
                                                tx.type === 'Card Payment' && 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a]'
                                            )}>
                                                {tx.type === 'Deposit' ? '↓' : tx.type === 'Transfer' ? '↗' : '💳'}
                                            </div>
                                            <span>{tx.type}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 font-semibold text-[#81858c]">
                                        {tx.asset}
                                    </td>
                                    <td className="py-4 text-[#81858c]">
                                        {tx.date}
                                    </td>
                                    <td className="py-4 font-mono text-[11px] text-[#7042f4] dark:text-[#c4a8ff]">
                                        {tx.hash}
                                    </td>
                                    <td className="py-4">
                                        <span className="inline-flex items-center rounded-full bg-[#e7faf4] px-2.5 py-0.5 text-[9px] font-bold text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]">
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right font-extrabold text-[#1c1c24] dark:text-white">
                                        {tx.amount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* ===================== MODAL: Receive / Deposit QR ===================== */}
            <AnimatePresence>
                {isReceiveModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsReceiveModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 15 }}
                            className="relative w-full max-w-sm rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] text-[#1c1c24] dark:text-white z-10 text-center"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <h3 className="text-base font-bold">Receive / Deposit</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsReceiveModalOpen(false)}
                                    className="rounded-full p-1 text-[#81858c] hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* QR Code simulation */}
                            <div className="my-6 flex justify-center">
                                <div className="rounded-2xl border-2 border-black/[0.06] bg-white p-4 shadow-md dark:border-white/10">
                                    <div className="h-44 w-44 bg-[radial-gradient(#19191b_2px,transparent_2px)] dark:bg-[radial-gradient(#111_2px,transparent_2px)] [background-size:12px_12px] flex items-center justify-center border border-dashed border-black/10 rounded-xl relative">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6330cf] to-[#12b88f] flex items-center justify-center text-white font-bold shadow-md">
                                            S
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs font-bold text-[#81858c] mb-1">Your Base Network Address</p>
                            <p className="font-mono text-xs font-semibold bg-[#f5f5f7] dark:bg-white/5 p-2.5 rounded-xl break-all">
                                {activeAddress}
                            </p>

                            <div className="mt-5 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCopyAddress}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white py-3 text-xs font-bold shadow-md hover:opacity-95"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copied ? 'Copied' : 'Copy Address'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ===================== MODAL: Send Crypto ===================== */}
            <AnimatePresence>
                {isSendModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsSendModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 15 }}
                            className="relative w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] text-[#1c1c24] dark:text-white z-10"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <div>
                                    <h3 className="text-base font-bold">Send Crypto</h3>
                                    <p className="text-xs text-[#81858c]">Transfer assets on Base EVM</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSendModalOpen(false)}
                                    className="rounded-full p-1 text-[#81858c] hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSendCrypto} className="space-y-4 pt-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">Asset</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['USDC', 'ETH'].map((sym) => (
                                            <button
                                                key={sym}
                                                type="button"
                                                onClick={() => setSendAsset(sym)}
                                                className={cn(
                                                    'rounded-xl py-2.5 text-xs font-bold transition-all border',
                                                    sendAsset === sym
                                                        ? 'bg-[#19191b] text-white border-transparent dark:bg-white dark:text-black shadow-sm'
                                                        : 'bg-[#f5f5f7] dark:bg-white/5 border-transparent text-[#777984]'
                                                )}
                                            >
                                                {sym}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">Recipient Address</label>
                                    <input
                                        type="text"
                                        value={sendRecipient}
                                        onChange={(e) => setSendRecipient(e.target.value)}
                                        placeholder="0x... or ENS name"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-[#81858c]">Amount ({sendAsset})</label>
                                        <button
                                            type="button"
                                            onClick={() => setSendAmount(sendAsset === 'USDC' ? '8250' : '1.42')}
                                            className="text-[10px] font-bold text-[#7042f4] dark:text-[#c4a8ff]"
                                        >
                                            Max
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        step="any"
                                        value={sendAmount}
                                        onChange={(e) => setSendAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="p-3 rounded-xl bg-[#fafafc] dark:bg-white/[0.03] text-[11px] text-[#81858c] flex justify-between items-center">
                                    <span>Estimated Network Fee:</span>
                                    <span className="font-bold text-[#12b88f]">~$0.01 (Base)</span>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSendModalOpen(false)}
                                        className="flex-1 rounded-xl border border-black/[0.08] py-2.5 text-xs font-bold text-[#81858c] hover:bg-black/5 dark:border-white/[0.08] dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white py-2.5 text-xs font-bold shadow-md hover:opacity-95 flex items-center justify-center gap-1.5"
                                    >
                                        <Send size={13} />
                                        <span>Confirm Send</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ===================== MODAL: Top Up Virtual Card ===================== */}
            <AnimatePresence>
                {isTopUpCardModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsTopUpCardModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 15 }}
                            className="relative w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] text-[#1c1c24] dark:text-white z-10"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <div>
                                    <h3 className="text-base font-bold">Top Up Swippable Card</h3>
                                    <p className="text-xs text-[#81858c]">Fund virtual card from USDC balance</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsTopUpCardModalOpen(false)}
                                    className="rounded-full p-1 text-[#81858c] hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleTopUpCard} className="space-y-4 pt-4">
                                <div className="rounded-2xl bg-[#f0eaff] dark:bg-[#281b45] p-3.5 flex items-center justify-between text-xs text-[#6330cf] dark:text-[#c4a8ff]">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={18} />
                                        <div>
                                            <p className="font-bold">Virtual Mastercard (•••• 3456)</p>
                                            <p className="text-[10px] opacity-80">Instant conversion at 1 USDC = 1 USD</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-xs">Active</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">Amount ($ USD)</label>
                                    <input
                                        type="number"
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(e.target.value)}
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-base font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="flex gap-2">
                                    {['50', '100', '250', '500'].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setTopUpAmount(amt)}
                                            className="flex-1 rounded-lg bg-[#f5f5f7] dark:bg-white/5 py-1.5 text-xs font-bold text-[#777984] hover:text-[#1c1c24] dark:hover:text-white"
                                        >
                                            ${amt}
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
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white py-2.5 text-xs font-bold shadow-md hover:opacity-95"
                                    >
                                        Top Up Card
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
