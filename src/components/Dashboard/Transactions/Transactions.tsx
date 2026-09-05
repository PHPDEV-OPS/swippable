'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React, { useMemo, useState } from 'react'
import { formatMoney, subtract, sum } from '@/lib/money'
import { useTransactions } from '@/lib/client-api'
import type { LedgerTransaction } from '@/types/api'

const categoryIcons: Record<string, string> = {
    Technology: 'solar:laptop-minimalistic-linear',
    'M-Pesa Deposit': 'solar:phone-calling-linear',
    'Crypto Deposit': 'solar:wallet-money-linear',
    'Card Funding': 'solar:card-transfer-linear',
    'Food & Drinks': 'solar:cup-first-linear',
    Entertainment: 'solar:shop-2-linear',
    Transport: 'solar:wheel-linear',
    Travel: 'solar:plane-linear',
    Shopping: 'solar:bag-heart-linear',
    'Bills & Utilities': 'solar:bill-list-linear',
    Healthcare: 'solar:health-linear',
    Refund: 'solar:rewind-back-linear',
    Other: 'solar:card-linear',
}

const Transactions = () => {
    const { data, isLoading, isError } = useTransactions()

    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'CREDIT' | 'DEBIT'>('all')

    const transactions: LedgerTransaction[] = useMemo(() => data ?? [], [data])

    const filteredTransactions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        return transactions.filter((tx) => {
            const matchesQuery =
                !query ||
                tx.merchant.toLowerCase().includes(query) ||
                tx.category.toLowerCase().includes(query) ||
                tx.channel.toLowerCase().includes(query) ||
                (tx.cardLast4 ?? '').includes(query)
            const matchesType = filterType === 'all' || tx.type === filterType
            return matchesQuery && matchesType
        })
    }, [transactions, searchQuery, filterType])

    /**
     * Totals are computed on settled rows only, and exclude internal card
     * funding movements, so inflow/outflow match the wallet's real activity.
     */
    const stats = useMemo(() => {
        const settled = transactions.filter((tx) => tx.status === 'SUCCESS' && tx.channel !== 'CARD_FUNDING')
        const inflow = sum(settled.filter((tx) => tx.type === 'CREDIT').map((tx) => tx.amount))
        const outflow = sum(settled.filter((tx) => tx.type === 'DEBIT').map((tx) => tx.amount))
        return { inflow, outflow, net: subtract(inflow, outflow) }
    }, [transactions])

    const statTiles = [
        {
            label: 'Total Inflow',
            value: stats.inflow,
            icon: 'solar:arrow-bottom-left-linear',
            color: 'text-[#12b88f]',
            bg: 'bg-[#e7faf4] dark:bg-[#0b3c32]',
        },
        {
            label: 'Total Outflow',
            value: stats.outflow,
            icon: 'solar:arrow-top-right-linear',
            color: 'text-[#ef5362]',
            bg: 'bg-[#ffebeb] dark:bg-[#3c151a]',
        },
        {
            label: 'Net Position',
            value: stats.net,
            icon: 'solar:safe-linear',
            color: 'text-[#7042f4] dark:text-[#c4a8ff]',
            bg: 'bg-[#f4f0ff] dark:bg-[#281b45]',
        },
    ]

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-3xl">
                        Transactions &amp; Payments
                    </h1>
                    <p className="text-sm text-[#777984] dark:text-[#888a93]">
                        {isLoading
                            ? 'Loading your ledger…'
                            : `${transactions.length} record${transactions.length === 1 ? '' : 's'} in your ledger`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-xl border border-black/[0.05] bg-white p-1 text-xs font-semibold dark:border-white/[0.08] dark:bg-[#121214]">
                        {(
                            [
                                ['all', 'All', 'bg-[#19191b] text-white dark:bg-white dark:text-black'],
                                ['CREDIT', 'Income', 'bg-[#12b88f] text-white'],
                                ['DEBIT', 'Expenses', 'bg-[#ef5362] text-white'],
                            ] as const
                        ).map(([value, label, activeClass]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setFilterType(value)}
                                className={`rounded-lg px-3 py-1.5 transition-colors ${
                                    filterType === value ? activeClass : 'text-[#777984]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {statTiles.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-[24px] border border-black/[0.05] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.08] dark:bg-[#121214]"
                    >
                        <div className="mb-4 flex items-center gap-3.5">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.bg} ${stat.color}`}
                            >
                                <Icon icon={stat.icon} width="22" height="22" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#777984] dark:text-[#888a93]">
                                {stat.label}
                            </span>
                        </div>
                        <p className="text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-3xl">
                            {isLoading ? '—' : formatMoney(stat.value)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Records */}
            <div className="overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.08] dark:bg-[#121214]">
                <div className="flex flex-col items-start justify-between gap-4 border-b border-black/[0.05] p-6 dark:border-white/[0.06] sm:flex-row sm:items-center">
                    <h2 className="text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                        Payment Records
                    </h2>
                    <div className="relative w-full sm:w-72">
                        <Icon
                            icon="solar:magnifer-linear"
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9a9ca4]"
                            width="18"
                            height="18"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search merchant, category or card…"
                            className="w-full rounded-full border border-black/[0.05] bg-[#f5f5f7] py-2 pl-10 pr-4 text-xs font-semibold text-[#1c1c24] outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/[0.08] dark:bg-white/5 dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-black/[0.04] bg-[#fafafc] text-[9px] font-bold uppercase tracking-wider text-[#9a9ca4] dark:border-white/[0.06] dark:bg-white/[0.02]">
                                <th className="px-6 py-4">Merchant</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Channel</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03] text-xs dark:divide-white/[0.04]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#777984]">
                                        Loading payments…
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#ef5362]">
                                        We could not load your transactions. Try refreshing.
                                    </td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#777984]">
                                        {transactions.length === 0
                                            ? 'No transactions yet. Fund your wallet to get started.'
                                            : 'No payments match this filter.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx, index) => (
                                    <motion.tr
                                        key={tx.id}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: Math.min(index * 0.02, 0.4) }}
                                        className="transition-colors hover:bg-[#f9f9fc] dark:hover:bg-white/[0.02]"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#6330cf] shadow-sm dark:bg-white/5 dark:text-[#c4a8ff]">
                                                    <Icon
                                                        icon={categoryIcons[tx.category] ?? categoryIcons.Other}
                                                        width="18"
                                                        height="18"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-[#1c1c24] dark:text-white">
                                                        {tx.merchant}
                                                    </span>
                                                    {tx.cardLast4 && (
                                                        <p className="text-[10px] text-[#9a9ca4]">
                                                            Card •••• {tx.cardLast4}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-[#777984] dark:text-[#888a93]">
                                                {tx.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="rounded-md bg-[#f4f0ff] px-2 py-0.5 text-[9px] font-bold text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]">
                                                {tx.channel.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-[#777984] dark:text-[#888a93]">
                                                {new Date(tx.createdAt).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                                    tx.status === 'SUCCESS'
                                                        ? 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                                        : tx.status === 'PENDING'
                                                          ? 'bg-[#fef7eb] text-[#e9a72b] dark:bg-[#38270b] dark:text-[#f7b746]'
                                                          : 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                                }`}
                                            >
                                                {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span
                                                className={`font-extrabold ${
                                                    tx.type === 'CREDIT'
                                                        ? 'text-[#12b88f]'
                                                        : 'text-[#1c1c24] dark:text-white'
                                                }`}
                                            >
                                                {tx.type === 'CREDIT' ? '+ ' : '− '}
                                                {formatMoney(tx.amount, tx.currency).replace('-', '')}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export { Transactions }
