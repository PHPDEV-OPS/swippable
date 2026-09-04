'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React, { useState, useMemo, useEffect } from 'react'

const categoryIcons: { [key: string]: string } = {
    'Technology': 'solar:laptop-minimalistic-linear',
    'Income': 'solar:wallet-money-linear',
    'Food & Drinks': 'solar:cup-first-linear',
    'Entertainment': 'solar:shop-2-linear',
    'Transport': 'solar:wheel-linear',
    'Travel': 'solar:home-2-linear',
    'Shopping': 'solar:bag-heart-linear',
    'Bills': 'solar:bill-list-linear'
}

const defaultTransactions = [
    { id: 1, merchant: 'External Payment', category: 'Income', date: '2024-12-02', amount: 250, type: 'income', status: 'Completed', currency: 'USD' },
    { id: 2, merchant: 'Internal Payment', category: 'Shopping', date: '2024-11-25', amount: 150, type: 'expense', status: 'Completed', currency: 'USD' },
    { id: 3, merchant: 'External Payment', category: 'Income', date: '2024-11-22', amount: 425, type: 'income', status: 'Completed', currency: 'USD' },
    { id: 4, merchant: 'Internal Payment', category: 'Food & Drinks', date: '2024-11-18', amount: 215, type: 'expense', status: 'Completed', currency: 'USD' },
    { id: 5, merchant: 'Wade Warren', category: 'Bills', date: '2024-10-02', amount: 420, type: 'expense', status: 'Completed', currency: 'USD' },
    { id: 6, merchant: 'Robert Fox', category: 'Bills', date: '2024-12-02', amount: 250, type: 'expense', status: 'Pending', currency: 'USD' },
    { id: 7, merchant: 'Jacob Jones', category: 'Travel', date: '2024-12-13', amount: 155, type: 'expense', status: 'Cancelled', currency: 'USD' },
]

const Transactions = () => {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

    const fetchTransactions = async () => {
        try {
            const res = await fetch('/api/transactions')
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                const mappedData = data.map((t: any) => ({
                    ...t,
                    type: t.type === 'credit' ? 'income' : 'expense',
                    category: t.merchant === 'Refund' ? 'Income' : 'Shopping',
                    date: t.created_at,
                    status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : 'Completed'
                }))
                setTransactions(mappedData)
            } else {
                setTransactions(defaultTransactions)
            }
        } catch {
            setTransactions(defaultTransactions)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTransactions()
    }, [])

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const matchesQuery = t.merchant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.category?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesType = filterType === 'all' ? true : t.type === filterType
            return matchesQuery && matchesType
        })
    }, [transactions, searchQuery, filterType])

    const stats = useMemo(() => {
        const inflow = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + Number(t.amount), 0)
        const outflow = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + Number(t.amount), 0)
        return {
            inflow: inflow.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            outflow: outflow.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            saved: (inflow - outflow).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        }
    }, [transactions])

    return (
        <div className='flex flex-col gap-8 pb-10'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight mb-1'>
                        Transactions & Payments
                    </h1>
                    <p className='text-[#777984] dark:text-[#888a93] text-sm'>
                        Monitor and filter all your Swippable account activities in real time
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <div className='flex rounded-xl bg-white dark:bg-[#121214] p-1 border border-black/[0.05] dark:border-white/[0.08] text-xs font-semibold'>
                        <button
                            type='button'
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'all' ? 'bg-[#19191b] text-white dark:bg-white dark:text-black' : 'text-[#777984]'}`}
                        >
                            All
                        </button>
                        <button
                            type='button'
                            onClick={() => setFilterType('income')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'income' ? 'bg-[#12b88f] text-white' : 'text-[#777984]'}`}
                        >
                            Income
                        </button>
                        <button
                            type='button'
                            onClick={() => setFilterType('expense')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'expense' ? 'bg-[#ef5362] text-white' : 'text-[#777984]'}`}
                        >
                            Expenses
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
                {[
                    { label: 'Total Inflow', value: stats.inflow, change: '+12%', icon: 'solar:arrow-bottom-left-linear', color: 'text-[#12b88f]', bg: 'bg-[#e7faf4] dark:bg-[#0b3c32]' },
                    { label: 'Total Outflow', value: stats.outflow, change: '-5%', icon: 'solar:arrow-top-right-linear', color: 'text-[#ef5362]', bg: 'bg-[#ffebeb] dark:bg-[#3c151a]' },
                    { label: 'Net Balance', value: stats.saved, change: '+15%', icon: 'solar:safe-linear', color: 'text-[#7042f4] dark:text-[#c4a8ff]', bg: 'bg-[#f4f0ff] dark:bg-[#281b45]' },
                ].map((stat, idx) => (
                    <div key={idx} className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'>
                        <div className='flex items-center gap-3.5 mb-4'>
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                                <Icon icon={stat.icon} width='22' height='22' />
                            </div>
                            <span className='text-[#777984] dark:text-[#888a93] text-xs font-bold uppercase tracking-wider'>{stat.label}</span>
                        </div>
                        <div className='flex items-end justify-between'>
                            <p className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight'>{stat.value}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${stat.bg} ${stat.color}`}>{stat.change}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transactions List */}
            <div className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[24px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.02)]'>
                <div className='p-6 border-b border-black/[0.05] dark:border-white/[0.06] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                    <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white tracking-tight'>Payment Records</h2>
                    <div className='relative w-full sm:w-72'>
                        <Icon icon='solar:magnifer-linear' className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9a9ca4]' width='18' height='18' />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search payments..."
                            className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-full pl-10 pr-4 py-2 text-xs font-semibold text-[#1c1c24] dark:text-white outline-none focus:ring-2 focus:ring-[#7042f4]'
                        />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <table className='w-full text-left'>
                        <thead>
                            <tr className='bg-[#fafafc] dark:bg-white/[0.02] text-[#9a9ca4] text-[9px] uppercase tracking-wider font-bold border-b border-black/[0.04] dark:border-white/[0.06]'>
                                <th className='px-6 py-4'>Beneficiary / Sender</th>
                                <th className='px-6 py-4'>Category</th>
                                <th className='px-6 py-4'>Date</th>
                                <th className='px-6 py-4'>Status</th>
                                <th className='px-6 py-4 text-right'>Amount</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-black/[0.03] dark:divide-white/[0.04] text-xs'>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className='px-6 py-8 text-center text-[#777984]'>Loading payments...</td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className='px-6 py-8 text-center text-[#777984]'>No matching payments found.</td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t, idx) => (
                                    <motion.tr
                                        key={t.id || idx}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className='hover:bg-[#f9f9fc] dark:hover:bg-white/[0.02] transition-colors'
                                    >
                                        <td className='px-6 py-4'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-9 h-9 rounded-xl bg-[#f5f5f7] dark:bg-white/5 flex items-center justify-center text-[#6330cf] dark:text-[#c4a8ff] shadow-sm'>
                                                    <Icon icon={categoryIcons[t.category] || 'solar:wallet-money-linear'} width='18' height='18' />
                                                </div>
                                                <span className='font-bold text-[#1c1c24] dark:text-white'>{t.merchant}</span>
                                            </div>
                                        </td>
                                        <td className='px-6 py-4'>
                                            <span className='font-medium text-[#777984] dark:text-[#888a93]'>{t.category}</span>
                                        </td>
                                        <td className='px-6 py-4'>
                                            <span className='font-medium text-[#777984] dark:text-[#888a93]'>{t.date?.slice(0, 10)}</span>
                                        </td>
                                        <td className='px-6 py-4'>
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                                t.status === 'Completed' ? 'bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa]' :
                                                t.status === 'Pending' ? 'bg-[#ffebeb] text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]' :
                                                'bg-[#faf0ff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff]'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className='px-6 py-4 text-right'>
                                            <span className={`font-extrabold ${t.type === 'income' ? 'text-[#12b88f]' : 'text-[#1c1c24] dark:text-white'}`}>
                                                {t.type === 'income' ? '+' : '-'} ${Math.abs(Number(t.amount)).toFixed(2)}
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

export { Transactions };
