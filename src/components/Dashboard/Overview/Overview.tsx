'use client'

import { useUser } from '@clerk/nextjs'
import {
    MoreVertical,
    Plus,
    Search,
    SlidersHorizontal,
    WalletCards,
    TrendingUp,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle2,
    Clock,
    XCircle,
    X,
    Sparkles,
    Send,
    RefreshCw,
    Download,
    Eye
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
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
    Cell
} from 'recharts'
import { cn } from '@/lib/utils'

interface CardItem {
    id?: number
    number?: string
    holder?: string
    expiry?: string
    type?: string
    color?: string
    balance?: number
    spendingLimit?: number
}

interface TransactionItem {
    id: number
    brand: 'VISA' | 'Mastercard' | 'PayPal'
    title: string
    date: string
    amount: string
    isIncome: boolean
}

// Recharts data for Day, Month, Week
const chartDataByPeriod = {
    Month: [
        { day: 'Mon', base: 40, extra: 20, total: '$420' },
        { day: 'Thu', base: 38, extra: 17, total: '$385' },
        { day: 'Sun', base: 58, extra: 27, total: '$580.00', highlight: true },
        { day: 'Wed', base: 30, extra: 15, total: '$310' },
        { day: 'Thu', base: 22, extra: 13, total: '$245' },
        { day: 'Fri', base: 48, extra: 22, total: '$490' },
        { day: 'Sat', base: 18, extra: 12, total: '$190' },
    ],
    Week: [
        { day: 'Mon', base: 25, extra: 15, total: '$270' },
        { day: 'Tue', base: 45, extra: 20, total: '$450' },
        { day: 'Wed', base: 50, extra: 25, total: '$520', highlight: true },
        { day: 'Thu', base: 30, extra: 15, total: '$310' },
        { day: 'Fri', base: 60, extra: 30, total: '$610' },
        { day: 'Sat', base: 35, extra: 15, total: '$360' },
        { day: 'Sun', base: 20, extra: 10, total: '$210' },
    ],
    Day: [
        { day: '6 AM', base: 10, extra: 10, total: '$85' },
        { day: '9 AM', base: 30, extra: 15, total: '$240' },
        { day: '12 PM', base: 65, extra: 25, total: '$680', highlight: true },
        { day: '3 PM', base: 45, extra: 20, total: '$420' },
        { day: '6 PM', base: 55, extra: 25, total: '$560' },
        { day: '9 PM', base: 35, extra: 15, total: '$350' },
        { day: '12 AM', base: 15, extra: 10, total: '$110' },
    ]
}

// Recharts Concentric Donut Data for Annual Profits
const annualProfitsRings = [
    { name: 'Total Annual Yield', value: 15000, label: '$15K', color: '#eeeafa', darkColor: '#241a3b', rInner: 76, rOuter: 94 },
    { name: 'Retained Net Growth', value: 9400, label: '$9.4K', color: '#d8c8f6', darkColor: '#49327a', rInner: 56, rOuter: 74 },
    { name: 'Operating Margin', value: 7500, label: '$7.5K', color: '#b78cf1', darkColor: '#7043bd', rInner: 36, rOuter: 54 },
    { name: 'Staked Liquidity Base', value: 5000, label: '$5K', color: '#7042f4', darkColor: '#8553ec', rInner: 0, rOuter: 34 },
]

const initialRecentTransactions: TransactionItem[] = [
    { id: 1, brand: 'VISA', title: 'External Payment', date: '02-12-24', amount: '+ $250.00', isIncome: true },
    { id: 2, brand: 'Mastercard', title: 'Internal Payment', date: '02-12-24', amount: '- $150.00', isIncome: false },
    { id: 3, brand: 'PayPal', title: 'External Payment', date: '02-12-24', amount: '+ $425.00', isIncome: true },
    { id: 4, brand: 'VISA', title: 'Internal Payment', date: '02-12-24', amount: '- $215.00', isIncome: false },
]

const quickContacts = [
    { name: 'Kaya', role: 'Designer', avatar: '👩🏻‍💻', color: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' },
    { name: 'Taylor', role: 'Developer', avatar: '👨🏼‍💻', color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300' },
    { name: 'Johan', role: 'Manager', avatar: '👨🏻', color: 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300' },
    { name: 'Jack', role: 'Marketing', avatar: '🧔🏽', color: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' },
    { name: 'Tony', role: 'Founder', avatar: '👱🏻‍♂️', color: 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300' },
]

const initialMoneySent = [
    { id: 1, name: 'Wade Warren', date: '02-10-24', amountNum: 420, amount: '$420.00', status: 'Completed', relation: 'Employee', avatar: '👨🏽' },
    { id: 2, name: 'Robert Fox', date: '02-12-24', amountNum: 250, amount: '$250.00', status: 'Pending', relation: 'Director', avatar: '👨🏼' },
    { id: 3, name: 'Jacob Jones', date: '02-13-24', amountNum: 155, amount: '$155.00', status: 'Cancelled', relation: 'family', avatar: '👩🏻' },
]

export function Overview() {
    const { user } = useUser()
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // State
    const [cards, setCards] = useState<CardItem[]>([])
    const [cardStackOffset, setCardStackOffset] = useState(0)
    const [activePeriod, setActivePeriod] = useState<'Day' | 'Month' | 'Week'>('Month')
    const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>(initialRecentTransactions)
    const [moneySentList, setMoneySentList] = useState(initialMoneySent)

    // Savings State
    const [healthcareProgress, setHealthcareProgress] = useState(45)
    const [educationProgress, setEducationProgress] = useState(70)

    // Modals & Popovers
    const [isAddCardOpen, setIsAddCardOpen] = useState(false)
    const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false)
    const [selectedRecipient, setSelectedRecipient] = useState<string>('')
    const [sendAmount, setSendAmount] = useState<string>('150.00')
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

    // Filter & Sort
    const [searchMoneySent, setSearchMoneySent] = useState('')
    const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Pending' | 'Cancelled'>('All')
    const [sortAsc, setSortAsc] = useState(false)

    // Card Form
    const [newCardHolder, setNewCardHolder] = useState(user?.fullName || 'SK Sumon Hossen')
    const [newCardLimit, setNewCardLimit] = useState('5000')

    useEffect(() => {
        setMounted(true)
        // Fetch real cards from API
        fetch('/api/cards')
            .then((res) => res.ok ? res.json() : [])
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setCards(data)
                }
            })
            .catch(() => undefined)
    }, [])

    useEffect(() => {
        if (user?.fullName) {
            setNewCardHolder(user.fullName)
        }
    }, [user])

    // Current card display
    const currentCard = useMemo(() => {
        if (cards.length > 0) {
            return cards[cardStackOffset % cards.length]
        }
        return {
            number: '1234 5678 9012 3456',
            holder: user?.fullName || 'SK Sumon Hossen',
            expiry: '12/28',
            balance: 9810,
            spendingLimit: 5000
        }
    }, [cards, cardStackOffset, user])

    // Handle Create Virtual Card
    const handleCreateVirtualCard = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'Virtual',
                    holder: newCardHolder || user?.fullName || 'SK Sumon Hossen',
                    spendingLimit: parseFloat(newCardLimit) || 5000,
                    balance: 100,
                    currency: 'USD',
                })
            })
            if (res.ok) {
                const newCard = await res.json()
                setCards((prev) => [newCard, ...prev])
                setIsAddCardOpen(false)
            }
        } catch {
            setIsAddCardOpen(false)
        }
    }

    // Handle Send Money
    const handleSendMoneySubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const amt = parseFloat(sendAmount) || 50
        const newTx: TransactionItem = {
            id: Date.now(),
            brand: 'VISA',
            title: `Transfer to ${selectedRecipient || 'Contact'}`,
            date: 'Today',
            amount: `- $${amt.toFixed(2)}`,
            isIncome: false
        }
        setRecentTransactions((prev) => [newTx, ...prev.slice(0, 3)])
        setMoneySentList((prev) => [
            {
                id: Date.now(),
                name: selectedRecipient || 'Contact',
                date: 'Today',
                amountNum: amt,
                amount: `$${amt.toFixed(2)}`,
                status: 'Completed',
                relation: 'Transfer',
                avatar: '💸'
            },
            ...prev
        ])
        setIsSendMoneyOpen(false)
    }

    // Filtered Money Sent
    const filteredMoneySent = useMemo(() => {
        let list = [...moneySentList]
        if (statusFilter !== 'All') {
            list = list.filter((item) => item.status === statusFilter)
        }
        if (searchMoneySent.trim()) {
            const q = searchMoneySent.toLowerCase()
            list = list.filter(
                (item) => item.name.toLowerCase().includes(q) || item.relation.toLowerCase().includes(q) || item.status.toLowerCase().includes(q)
            )
        }
        list.sort((a, b) => sortAsc ? a.amountNum - b.amountNum : b.amountNum - a.amountNum)
        return list
    }, [moneySentList, searchMoneySent, statusFilter, sortAsc])

    // Recharts Custom Tooltip for Activity Summary Bar Chart
    const CustomActivityTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            return (
                <div className="rounded-xl bg-[#19191b] px-3 py-1.5 text-xs font-bold text-white shadow-xl dark:bg-white dark:text-black">
                    <p>{data.total}</p>
                    <span className="text-[10px] font-normal text-white/70 dark:text-black/70">{data.day} Expense</span>
                </div>
            )
        }
        return null
    }

    // Generic 3-Dot Dropdown
    const renderActionMenu = (id: string) => {
        if (activeMenuId !== id) return null
        return (
            <div
                className="absolute right-0 top-8 z-30 w-44 rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#18181b]"
                onClick={(e) => e.stopPropagation()}
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
                    onClick={() => setActiveMenuId(null)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#1c1c24] hover:bg-[#f5f5f7] dark:text-white dark:hover:bg-white/5"
                >
                    <RefreshCw size={14} />
                    <span>Refresh Stats</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveMenuId(null)}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#1c1c24] hover:bg-[#f5f5f7] dark:text-white dark:hover:bg-white/5"
                >
                    <Download size={14} />
                    <span>Export CSV</span>
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6 sm:space-y-7 pb-12">

            {/* ===================== TOP ROW (12-COLUMN GRID) ===================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                {/* Left Column: "My Cards" Widget (4 cols) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="lg:col-span-4 xl:col-span-4 flex flex-col"
                >
                    <section className="group relative flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_12px_36px_rgba(112,66,244,0.06)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        
                        {/* Title & Plus Button */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    My Cards
                                </h2>
                                <p className="text-[11px] text-[#81858c]">
                                    Click card to cycle or fan out
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                type="button"
                                onClick={() => setIsAddCardOpen(true)}
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111] text-white transition-all shadow-md hover:bg-black dark:bg-white dark:text-black cursor-pointer"
                                title="Issue New Virtual Card"
                            >
                                <Plus size={17} strokeWidth={2.5} />
                            </motion.button>
                        </div>

                        {/* 3D Stacked Credit Cards with Framer Motion Fan-Out */}
                        <div
                            onClick={() => setCardStackOffset((prev) => prev + 1)}
                            className="relative my-auto flex h-[230px] sm:h-[245px] w-full cursor-pointer items-center justify-center select-none"
                        >
                            {/* Card Layer 3 (Backmost layer) */}
                            <motion.div
                                animate={{
                                    y: [0, -3, 0],
                                    scale: 0.86,
                                    top: 4
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute h-[152px] w-[86%] rounded-[20px] bg-[#dfd4fc] shadow-sm dark:bg-[#261846]"
                            />

                            {/* Card Layer 2 (Middle layer) */}
                            <motion.div
                                animate={{
                                    y: [0, -2, 0],
                                    scale: 0.93,
                                    top: 18
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                                className="absolute h-[160px] w-[93%] rounded-[21px] bg-gradient-to-r from-[#baa0f7] to-[#a882f5] shadow-md dark:from-[#3c256a] dark:to-[#4e3189]"
                            >
                                <div className="p-4 flex justify-between items-start opacity-30">
                                    <div className="flex -space-x-2">
                                        <div className="h-4 w-4 rounded-full bg-red-400" />
                                        <div className="h-4 w-4 rounded-full bg-amber-400" />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Card Layer 1 (Frontmost interactive Swippable Card) */}
                            <motion.div
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                layout
                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                className="relative top-9 h-[172px] w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#622fcf] via-[#824fed] to-[#5a2ad0] p-4 sm:p-5 text-white shadow-[0_20px_42px_rgba(99,48,207,0.38)]"
                            >
                                {/* Diagonal gloss reflection streak */}
                                <div className="pointer-events-none absolute -inset-full bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.22)_48%,rgba(255,255,255,0.05)_55%,transparent_70%)] opacity-85" />

                                <div className="relative z-10 flex h-full flex-col justify-between">
                                    {/* Card Top: Mastercard + EMV Metallic Chip */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-2">
                                                <div className="h-5 w-5 rounded-full bg-[#eb001b]" />
                                                <div className="h-5 w-5 rounded-full bg-[#f79e1b] opacity-95 mix-blend-screen" />
                                            </div>
                                            <span className="text-[11px] font-bold tracking-tight text-white">
                                                Mastercard
                                            </span>
                                        </div>

                                        {/* Realistic EMV Metallic Gold Chip */}
                                        <div className="flex h-6 w-8 items-center justify-center rounded-[5px] border border-amber-300/50 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 p-0.5 shadow-inner">
                                            <div className="grid h-full w-full grid-cols-2 gap-0.5 rounded-[3px] border border-amber-500/40">
                                                <div className="border-r border-b border-amber-600/30" />
                                                <div className="border-b border-amber-600/30" />
                                                <div className="border-r border-amber-600/30" />
                                                <div />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Number */}
                                    <div className="mt-1">
                                        <p className="text-[8px] font-semibold uppercase tracking-wider text-white/70">
                                            Card Number
                                        </p>
                                        <p className="font-mono text-sm sm:text-[15px] font-bold tracking-[0.19em] text-white drop-shadow-sm">
                                            {currentCard.number || '1234 5678 9012 3456'}
                                        </p>
                                    </div>

                                    {/* Card Bottom: Holder Name & VISA mark */}
                                    <div className="flex items-end justify-between pt-1">
                                        <div>
                                            <p className="max-w-[180px] truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white">
                                                {currentCard.holder || user?.fullName || 'SK Sumon Hossen'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm sm:text-base font-black italic tracking-wider text-white">
                                                VISA
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Card quick actions footer */}
                        <div className="mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs">
                            <span className="text-[11px] font-medium text-[#777984] dark:text-[#888a93]">
                                Balance: <strong className="text-[#1c1c24] dark:text-white">${currentCard.balance?.toLocaleString() || '9,810.00'}</strong>
                            </span>
                            <Link
                                href="/dashboard/cards"
                                className="font-bold text-[#6330cf] hover:text-[#8553ec] dark:text-[#bca4ff] transition-colors flex items-center gap-1"
                            >
                                <span>Manage</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    </section>
                </motion.div>

                {/* Right Column: 3 Stat Cards & Activity Summary + Recent Transactions (8 cols) */}
                <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-6">

                    {/* 3 Stat Cards Row */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">

                        {/* 1: Total Balance */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.05 }}
                            whileHover={{ y: -3 }}
                            className="relative flex flex-col justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f0ff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff] shadow-sm">
                                        <WalletCards size={17} />
                                    </div>
                                    <span className="text-xs font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                        Total Balance
                                    </span>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === 'balance' ? null : 'balance')}
                                        className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                        aria-label="Menu"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {renderActionMenu('balance')}
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#1c1c24] dark:text-white">
                                    $9,810.00
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>From lasts month</span>
                                <span className="rounded-md bg-[#e7faf4] px-2 py-0.5 font-bold text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]">
                                    +50%
                                </span>
                            </div>
                        </motion.div>

                        {/* 2: Total Income */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.1 }}
                            whileHover={{ y: -3 }}
                            className="relative flex flex-col justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ebfbf6] text-[#19c9a2] dark:bg-[#0b3c32] dark:text-[#28d6aa] shadow-sm">
                                        <ArrowDownLeft size={17} />
                                    </div>
                                    <span className="text-xs font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                        Total Income
                                    </span>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === 'income' ? null : 'income')}
                                        className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                        aria-label="Menu"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {renderActionMenu('income')}
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#1c1c24] dark:text-white">
                                    $3,221.03
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>From lasts month</span>
                                <span className="rounded-md bg-[#ffebeb] px-2 py-0.5 font-bold text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                                    -10%
                                </span>
                            </div>
                        </motion.div>

                        {/* 3: Total Expend */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.15 }}
                            whileHover={{ y: -3 }}
                            className="relative flex flex-col justify-between rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fef7eb] text-[#e9a72b] dark:bg-[#38270b] dark:text-[#f7b746] shadow-sm">
                                        <ArrowUpRight size={17} />
                                    </div>
                                    <span className="text-xs font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                        Total Expend
                                    </span>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === 'expend' ? null : 'expend')}
                                        className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                        aria-label="Menu"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {renderActionMenu('expend')}
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#1c1c24] dark:text-white">
                                    $1,256.00
                                </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#81858c]">
                                <span>From lasts month</span>
                                <span className="rounded-md bg-[#e7faf4] px-2 py-0.5 font-bold text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]">
                                    +50%
                                </span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Middle Row: Recharts Activity Summary & Recent Transactions */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 flex-1">

                        {/* RECHARTS Activity Summary Bar Chart (7 cols md) */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.2 }}
                            className="md:col-span-7 flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    Activity Summary
                                </h2>

                                {/* Day / Month / Week Toggle Pills */}
                                <div className="flex items-center rounded-full bg-[#f5f5f7] p-1 dark:bg-white/[0.06]">
                                    {(['Day', 'Month', 'Week'] as const).map((period) => (
                                        <button
                                            key={period}
                                            type="button"
                                            onClick={() => setActivePeriod(period)}
                                            className={cn(
                                                'rounded-full px-3.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
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

                            {/* Recharts BarChart container */}
                            <div className="relative mt-4 h-[180px] w-full">
                                {mounted && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartDataByPeriod[activePeriod]}
                                            margin={{ top: 25, right: 10, left: -25, bottom: 0 }}
                                            barSize={24}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                                stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                            />
                                            <YAxis
                                                ticks={[0, 10, 20, 40]}
                                                domain={[0, 45]}
                                                tickFormatter={(v) => `${v}K`}
                                                tick={{ fontSize: 9, fill: '#9a9ca4', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fontSize: 10, fill: '#81858c', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={6}
                                            />
                                            <RechartsTooltip content={<CustomActivityTooltip />} cursor={{ fill: 'transparent' }} />
                                            {/* Stacked Bars: Base + Extra */}
                                            <Bar dataKey="base" stackId="a" fill="#7042f4" radius={[0, 0, 0, 0]} />
                                            <Bar
                                                dataKey="extra"
                                                stackId="a"
                                                fill={theme === 'dark' ? '#281b45' : '#f0eaff'}
                                                radius={[6, 6, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </motion.div>

                        {/* Recent Transactions (5 cols md) */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.25 }}
                            className="md:col-span-5 flex flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                    Recent Transaction
                                </h2>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveMenuId(activeMenuId === 'recent' ? null : 'recent')}
                                        className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                        aria-label="Menu"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {renderActionMenu('recent')}
                                </div>
                            </div>

                            {/* 4 Transaction Rows */}
                            <div className="space-y-3">
                                {recentTransactions.map((tx) => (
                                    <motion.div
                                        key={tx.id}
                                        whileHover={{ x: 3 }}
                                        className="flex items-center justify-between rounded-xl p-1.5 transition-colors hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04] cursor-pointer"
                                    >
                                        <Link href="/dashboard/transactions" className="flex items-center gap-3 flex-1">
                                            {/* Brand Logo Square Box */}
                                            <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white font-black text-[9px] dark:border-white/[0.08] dark:bg-[#18181b] shadow-sm">
                                                {tx.brand === 'VISA' && (
                                                    <span className="font-extrabold italic text-[#1a1f71] dark:text-[#4d79ff]">VISA</span>
                                                )}
                                                {tx.brand === 'Mastercard' && (
                                                    <div className="flex -space-x-1.5">
                                                        <div className="h-3 w-3 rounded-full bg-[#eb001b]" />
                                                        <div className="h-3 w-3 rounded-full bg-[#f79e1b] opacity-90" />
                                                    </div>
                                                )}
                                                {tx.brand === 'PayPal' && (
                                                    <span className="font-bold text-[#003087] dark:text-[#2670e8]">PayPal</span>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-bold text-[#1c1c24] dark:text-white">
                                                    {tx.title}
                                                </p>
                                                <p className="text-[10px] text-[#9a9ca4]">
                                                    {tx.date}
                                                </p>
                                            </div>
                                        </Link>

                                        <span className={cn(
                                            'text-xs font-extrabold pl-2',
                                            tx.isIncome ? 'text-[#12b88f]' : 'text-[#ef5362]'
                                        )}>
                                            {tx.amount}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ===================== BOTTOM ROW (12-COLUMN GRID) ===================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

                {/* Left Column: Quick Transactions & Savings (4 cols) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                    className="lg:col-span-4 xl:col-span-4 flex flex-col gap-6"
                >
                    {/* Quick Transactions */}
                    <div className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Quick Transactions
                            </h2>
                            <span className="text-[11px] text-[#81858c]">Tap to send</span>
                        </div>

                        {/* Avatars Row matching mockup */}
                        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
                            {/* Add Button */}
                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                    onClick={() => {
                                        setSelectedRecipient('Kaya')
                                        setIsSendMoneyOpen(true)
                                    }}
                                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-[#8553ec] text-[#8553ec] bg-[#f4f0ff]/50 dark:bg-[#281b45]/30 cursor-pointer shadow-sm"
                                    title="Send to new recipient"
                                >
                                    <Plus size={18} strokeWidth={2.5} />
                                </motion.button>
                                <span className="text-[10px] font-bold text-[#81858c]">Add</span>
                            </div>

                            {quickContacts.map((contact) => (
                                <div key={contact.name} className="flex flex-col items-center gap-1.5 shrink-0">
                                    <motion.button
                                        whileHover={{ scale: 1.15, y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={() => {
                                            setSelectedRecipient(contact.name)
                                            setIsSendMoneyOpen(true)
                                        }}
                                        className={cn(
                                            'flex h-11 w-11 items-center justify-center rounded-full text-base shadow-sm ring-2 ring-white transition-all dark:ring-[#121214] cursor-pointer',
                                            contact.color
                                        )}
                                        title={`Send money to ${contact.name}`}
                                    >
                                        <span>{contact.avatar}</span>
                                    </motion.button>
                                    <span className="text-[10px] font-bold text-[#1c1c24] dark:text-[#b4b6bf]">
                                        {contact.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Savings Panel */}
                    <div className="rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Savings
                            </h2>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setActiveMenuId(activeMenuId === 'savings' ? null : 'savings')}
                                    className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                    aria-label="Menu"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {renderActionMenu('savings')}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Healthcare Item */}
                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                className="rounded-2xl bg-[#fafafc] p-3.5 border border-black/[0.03] dark:bg-white/[0.03] dark:border-white/[0.04]"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ef5362] text-white shadow-sm font-black text-sm">
                                            ✚
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                $4,300.00
                                            </p>
                                            <p className="text-[10px] text-[#81858c]">
                                                Healthcare
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-extrabold text-[#1c1c24] dark:text-white">
                                            {healthcareProgress}%
                                        </span>
                                    </div>
                                </div>

                                {/* Teal Progress Bar with Interactive Slider Thumb */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-[9px] text-[#9a9ca4] mb-1">
                                        <span>Target :$50,000</span>
                                    </div>
                                    <div
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const clickX = e.clientX - rect.left
                                            const newP = Math.round((clickX / rect.width) * 100)
                                            setHealthcareProgress(Math.max(10, Math.min(100, newP)))
                                        }}
                                        className="relative h-2 w-full rounded-full bg-[#e8f5f1] dark:bg-white/[0.08] cursor-pointer"
                                    >
                                        <motion.div
                                            className="h-full rounded-full bg-[#12b88f]"
                                            style={{ width: `${healthcareProgress}%` }}
                                        />
                                        <div
                                            className="absolute -top-1 h-4 w-4 rounded-full border-2 border-white bg-[#12b88f] shadow-md dark:border-[#121214]"
                                            style={{ left: `calc(${healthcareProgress}% - 8px)` }}
                                        />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Education Item */}
                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                className="rounded-2xl bg-[#fafafc] p-3.5 border border-black/[0.03] dark:bg-white/[0.03] dark:border-white/[0.04]"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7042f4] text-white shadow-sm text-sm">
                                            🎓
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                $4,300.00
                                            </p>
                                            <p className="text-[10px] text-[#81858c]">
                                                Education
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-extrabold text-[#1c1c24] dark:text-white">
                                            {educationProgress}%
                                        </span>
                                    </div>
                                </div>

                                {/* Purple Progress Bar with Interactive Slider Thumb */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-[9px] text-[#9a9ca4] mb-1">
                                        <span>Target :$50,000</span>
                                    </div>
                                    <div
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const clickX = e.clientX - rect.left
                                            const newP = Math.round((clickX / rect.width) * 100)
                                            setEducationProgress(Math.max(10, Math.min(100, newP)))
                                        }}
                                        className="relative h-2 w-full rounded-full bg-[#f0eaff] dark:bg-white/[0.08] cursor-pointer"
                                    >
                                        <motion.div
                                            className="h-full rounded-full bg-[#7042f4]"
                                            style={{ width: `${educationProgress}%` }}
                                        />
                                        <div
                                            className="absolute -top-1 h-4 w-4 rounded-full border-2 border-white bg-[#7042f4] shadow-md dark:border-[#121214]"
                                            style={{ left: `calc(${educationProgress}% - 8px)` }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                {/* Center Column: RECHARTS Annual Profits Concentric Bullseye (3.5 cols xl) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.35 }}
                    className="lg:col-span-4 xl:col-span-3 flex flex-col"
                >
                    <div className="flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Annual Profits
                            </h2>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setActiveMenuId(activeMenuId === 'profits' ? null : 'profits')}
                                    className="text-[#9a9ca4] hover:text-[#1c1c24] dark:hover:text-white p-1 rounded-full cursor-pointer"
                                    aria-label="Menu"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {renderActionMenu('profits')}
                            </div>
                        </div>

                        {/* Concentric Bullseye Rings Chart matching mockup */}
                        <div className="my-auto flex h-[230px] w-full items-center justify-center relative">
                            {/* Layer 1: $15K (Outer) */}
                            <motion.div
                                whileHover={{ scale: 1.04 }}
                                className="relative flex h-[196px] w-[196px] items-center justify-center rounded-full bg-[#eeeafa] shadow-inner dark:bg-[#241a3b] transition-all cursor-pointer"
                            >
                                <span className="absolute top-2 text-[9px] font-bold text-[#81858c] dark:text-[#bca4ff]">
                                    $15K
                                </span>

                                {/* Layer 2: $9.4K */}
                                <div className="relative flex h-[148px] w-[148px] items-center justify-center rounded-full bg-[#d8c8f6] dark:bg-[#49327a] shadow-inner transition-all">
                                    <span className="absolute top-2 text-[9px] font-bold text-[#622fcf] dark:text-[#d3bdf6]">
                                        $9.4K
                                    </span>

                                    {/* Layer 3: $7.5K */}
                                    <div className="relative flex h-[106px] w-[106px] items-center justify-center rounded-full bg-[#b78cf1] dark:bg-[#7043bd] shadow-inner transition-all">
                                        <span className="absolute top-2 text-[9px] font-bold text-white/90">
                                            $7.5K
                                        </span>

                                        {/* Layer 4: $5K (Inner core) */}
                                        <motion.div
                                            animate={{ scale: [1, 1.04, 1] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                            className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#7042f4] shadow-md"
                                        >
                                            <span className="text-xs font-black text-white">
                                                $5K
                                            </span>
                                        </motion.div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#81858c] pt-2 border-t border-black/[0.03] dark:border-white/[0.04]">
                            <span>Yearly Cumulative ROI</span>
                            <span className="font-extrabold text-[#12b88f]">+24.8%</span>
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Money Sent List (4.5 cols xl) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.4 }}
                    className="lg:col-span-4 xl:col-span-5 flex flex-col"
                >
                    <div className="flex flex-1 flex-col justify-between rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none">
                        
                        {/* Title & Interactive Search/Filter Icons */}
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Money Sent List
                            </h2>

                            <div className="flex items-center gap-2">
                                {/* Search input */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9ca4]" size={13} />
                                    <input
                                        type="text"
                                        value={searchMoneySent}
                                        onChange={(e) => setSearchMoneySent(e.target.value)}
                                        placeholder="Search..."
                                        className="h-8 w-28 sm:w-36 rounded-full bg-[#f5f5f7] pl-8 pr-3 text-[11px] outline-none focus:w-44 transition-all focus:ring-1 focus:ring-[#7042f4] dark:bg-white/[0.06] dark:text-white"
                                    />
                                </div>

                                {/* Status Filter Pill */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = statusFilter === 'All' ? 'Completed' : statusFilter === 'Completed' ? 'Pending' : statusFilter === 'Pending' ? 'Cancelled' : 'All'
                                        setStatusFilter(next)
                                    }}
                                    className="flex h-8 items-center gap-1 rounded-full bg-[#f5f5f7] px-3 text-[10px] font-bold text-[#81858c] hover:text-[#1c1c24] dark:bg-white/[0.06] dark:hover:text-white cursor-pointer"
                                    title="Cycle status filter"
                                >
                                    <SlidersHorizontal size={12} />
                                    <span>{statusFilter}</span>
                                </button>
                            </div>
                        </div>

                        {/* Interactive Table matching mockup */}
                        <div className="overflow-x-auto">
                            <div className="min-w-[370px]">
                                {/* Table Header with Sorting */}
                                <div className="grid grid-cols-5 gap-2 rounded-xl bg-[#f9f9fb] px-3 py-2 text-[9px] font-extrabold text-[#9a9ca4] dark:bg-white/[0.03] select-none">
                                    <span>Account</span>
                                    <span>Request Date</span>
                                    <span
                                        onClick={() => setSortAsc(!sortAsc)}
                                        className="cursor-pointer hover:text-[#1c1c24] dark:hover:text-white flex items-center gap-1"
                                    >
                                        <span>Amount</span>
                                        <span className="text-[8px]">{sortAsc ? '▲' : '▼'}</span>
                                    </span>
                                    <span>Status</span>
                                    <span className="text-right">Relation</span>
                                </div>

                                {/* Table Rows */}
                                <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
                                    <AnimatePresence>
                                        {filteredMoneySent.map((row) => (
                                            <motion.div
                                                key={row.id}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                whileHover={{ x: 2 }}
                                                className="grid grid-cols-5 items-center gap-2 px-3 py-3 text-[11px] transition-colors hover:bg-[#fafafc] dark:hover:bg-white/[0.02] cursor-pointer"
                                            >
                                                {/* Account Name */}
                                                <div className="flex items-center gap-2 font-bold text-[#1c1c24] dark:text-white truncate">
                                                    <span className="text-xs">{row.avatar}</span>
                                                    <span className="truncate">{row.name}</span>
                                                </div>

                                                {/* Request Date */}
                                                <span className="text-[10px] text-[#81858c]">
                                                    {row.date}
                                                </span>

                                                {/* Amount */}
                                                <span className="font-extrabold text-[#1c1c24] dark:text-white">
                                                    {row.amount}
                                                </span>

                                                {/* Status Badge */}
                                                <div>
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-bold',
                                                            row.status === 'Completed' && 'bg-[#f0eaff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]',
                                                            row.status === 'Pending' && 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]',
                                                            row.status === 'Cancelled' && 'bg-[#e4f8f3] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                                        )}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </div>

                                                {/* Relation */}
                                                <span className="text-right text-[10px] text-[#81858c] capitalize">
                                                    {row.relation}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-black/[0.03] dark:border-white/[0.04] text-right">
                            <Link
                                href="/dashboard/transactions"
                                className="text-xs font-bold text-[#6330cf] hover:text-[#8553ec] dark:text-[#bca4ff] transition-colors inline-flex items-center gap-1"
                            >
                                <span>View all transactions</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ===================== MODAL 1: Create Virtual Card Dialog ===================== */}
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
                            className="relative w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] text-[#1c1c24] dark:text-white z-10"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <div>
                                    <h3 className="text-base font-bold">Issue Swippable Virtual Card</h3>
                                    <p className="text-xs text-[#81858c]">Instant issuance on Base EVM</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAddCardOpen(false)}
                                    className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10 text-[#81858c]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateVirtualCard} className="space-y-4 pt-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">
                                        Cardholder Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newCardHolder}
                                        onChange={(e) => setNewCardHolder(e.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">
                                        Monthly Spending Limit (USD)
                                    </label>
                                    <input
                                        type="number"
                                        value={newCardLimit}
                                        onChange={(e) => setNewCardLimit(e.target.value)}
                                        placeholder="5000"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="p-3 rounded-xl bg-[#f0eaff] dark:bg-[#281b45] text-xs text-[#6330cf] dark:text-[#c4a8ff] flex items-center gap-2 font-medium">
                                    <Sparkles size={16} className="shrink-0" />
                                    <span>Real-time limits, zero issuance fees, instant activation.</span>
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
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                                    >
                                        Issue Card
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ===================== MODAL 2: Send Money Dialog ===================== */}
            <AnimatePresence>
                {isSendMoneyOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsSendMoneyOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 15 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="relative w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#121214] text-[#1c1c24] dark:text-white z-10"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                                <div>
                                    <h3 className="text-base font-bold">Quick Transfer</h3>
                                    <p className="text-xs text-[#81858c]">Instant zero-fee transfer via Swippable</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSendMoneyOpen(false)}
                                    className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10 text-[#81858c]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSendMoneySubmit} className="space-y-4 pt-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">
                                        Recipient
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedRecipient}
                                        onChange={(e) => setSelectedRecipient(e.target.value)}
                                        placeholder="Name or wallet address"
                                        className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] px-4 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-[#81858c] mb-1">
                                        Amount ($ USD)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#81858c]">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={sendAmount}
                                            onChange={(e) => setSendAmount(e.target.value)}
                                            className="w-full rounded-xl border border-black/[0.08] bg-[#f5f5f7] pl-8 pr-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Preset Amount Pills */}
                                <div className="flex gap-2">
                                    {['25', '50', '150', '250', '500'].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setSendAmount(amt)}
                                            className={cn(
                                                'flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors cursor-pointer',
                                                sendAmount === amt
                                                    ? 'bg-[#19191b] text-white dark:bg-white dark:text-black'
                                                    : 'bg-[#f5f5f7] text-[#81858c] hover:bg-[#edeef2] dark:bg-white/[0.06] dark:text-[#a0a2af]'
                                            )}
                                        >
                                            ${amt}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSendMoneyOpen(false)}
                                        className="flex-1 rounded-xl border border-black/[0.08] py-2.5 text-xs font-bold text-[#81858c] hover:bg-black/5 dark:border-white/[0.08] dark:hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Send size={14} />
                                        <span>Send Now</span>
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