'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React from 'react'

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

const Transactions = () => {
    const [transactions, setTransactions] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    const fetchTransactions = async () => {
        try {
            const res = await fetch('/api/transactions')
            const data = await res.json()
            if (Array.isArray(data)) {
                // Map backend data to frontend structure
                const mappedData = data.map((t: any) => ({
                    ...t,
                    type: t.type === 'credit' ? 'income' : 'expense',
                    category: t.merchant === 'Refund' ? 'Income' : 'Shopping', // Simple logic for now
                    date: t.created_at,
                    status: t.status.charAt(0).toUpperCase() + t.status.slice(1) // Capitalize
                }))
                setTransactions(mappedData)
            }
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchTransactions()
    }, [])

    const stats = React.useMemo(() => {
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
        <div className='flex flex-col gap-10 pb-10'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-3xl font-bold text-white mb-1'>Transactions</h1>
                    <p className='text-white/40 text-sm'>View and manage all your account activities</p>
                </div>
                <div className='flex items-center gap-3'>
                    <button className='bg-white/5 border border-white/10 px-6 py-3 rounded-2xl text-white font-bold flex items-center gap-2 hover:bg-white/10 transition-all'>
                        <Icon icon='solar:filter-linear' width='20' height='20' />
                        Filters
                    </button>
                    <button className='bg-primary text-background px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20'>
                        <Icon icon='solar:download-linear' width='20' height='20' />
                        Export
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {[
                    { label: 'Total Inflow', value: stats.inflow, change: '+12%', icon: 'solar:arrow-bottom-left-linear', color: 'text-secondary' },
                    { label: 'Total Outflow', value: stats.outflow, change: '-5%', icon: 'solar:arrow-top-right-linear', color: 'text-red-400' },
                    { label: 'Net Balance', value: stats.saved, change: '+15%', icon: 'solar:safe-linear', color: 'text-primary' },
                ].map((stat, idx) => (
                    <div key={idx} className='bg-white/5 border border-white/10 rounded-3xl p-6'>
                        <div className='flex items-center gap-4 mb-4'>
                            <div className='w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40'>
                                <Icon icon={stat.icon} width='24' height='24' />
                            </div>
                            <span className='text-white/40 text-sm font-bold uppercase tracking-widest'>{stat.label}</span>
                        </div>
                        <div className='flex items-end justify-between'>
                            <p className='text-3xl font-black text-white'>{stat.value}</p>
                            <p className={`text-xs font-bold ${stat.color}`}>{stat.change}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transactions List */}
            <div className='bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden'>
                <div className='p-8 border-b border-white/5 flex justify-between items-center'>
                    <h2 className='text-xl font-bold text-white tracking-tight'>Recent Activity</h2>
                    <div className='relative'>
                        <Icon icon='solar:magnifer-linear' className='absolute left-4 top-1/2 -translate-y-1/2 text-white/20' width='20' height='20' />
                        <input
                            type="text"
                            placeholder="Search transactions..."
                            className='bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-all w-64'
                        />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <table className='w-full text-left'>
                        <thead>
                            <tr className='text-white/20 text-[10px] uppercase tracking-[0.2em] font-black'>
                                <th className='px-8 py-6'>Beneficiary / Sender</th>
                                <th className='px-8 py-6'>Category</th>
                                <th className='px-8 py-6'>Date</th>
                                <th className='px-8 py-6'>Status</th>
                                <th className='px-8 py-6 text-right'>Amount</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-white/5'>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className='px-8 py-10 text-center text-white/40'>Loading transactions...</td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className='px-8 py-10 text-center text-white/40'>No transactions found.</td>
                                </tr>
                            ) : (
                                transactions.map((t, idx) => (
                                    <motion.tr
                                        key={t.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className='group cursor-pointer hover:bg-white/[0.02] transition-colors'
                                    >
                                        <td className='px-8 py-6'>
                                            <div className='flex items-center gap-4'>
                                                <div className='w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-primary/20 group-hover:text-primary transition-all'>
                                                    <Icon icon={categoryIcons[t.category] || 'solar:wallet-money-linear'} width='20' height='20' />
                                                </div>
                                                <span className='text-white text-sm font-bold'>{t.merchant}</span>
                                            </div>
                                        </td>
                                        <td className='px-8 py-6'>
                                            <span className='text-white/40 text-xs font-bold'>{t.category}</span>
                                        </td>
                                        <td className='px-8 py-6'>
                                            <span className='text-white/40 text-xs font-bold'>{new Date(t.date).toLocaleDateString()}</span>
                                        </td>
                                        <td className='px-8 py-6'>
                                            <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full ${t.status === 'Completed' ? 'bg-secondary/10 text-secondary' :
                                                t.status === 'Pending' ? 'bg-orange-500/10 text-orange-400' :
                                                    'bg-red-500/10 text-red-400'
                                                }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className='px-8 py-6 text-right'>
                                            <span className={`text-sm font-black ${t.type === 'income' ? 'text-secondary' : 'text-white'}`}>
                                                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toLocaleString('en-US', { style: 'currency', currency: t.currency || 'USD' })}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {transactions.length > 10 && (
                    <div className='p-8 border-t border-white/5 flex justify-center'>
                        <button className='text-white/40 text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors'>
                            Load more transactions
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export { Transactions };
