'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React, { useState } from 'react'
import { useTheme } from 'next-themes'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell
} from 'recharts'

const performanceData = [
    { month: 'Jan', income: 4500, expense: 3100 },
    { month: 'Feb', income: 5200, expense: 3400 },
    { month: 'Mar', income: 4800, expense: 3800 },
    { month: 'Apr', income: 6100, expense: 4200 },
    { month: 'May', income: 5900, expense: 3900 },
    { month: 'Jun', income: 7200, expense: 4800 },
]

const spendingCategories = [
    { name: 'Shopping', value: 35, color: '#7042f4' },
    { name: 'Travel', value: 25, color: '#12b88f' },
    { name: 'Food & Drinks', value: 20, color: '#f79e1b' },
    { name: 'Bills & Utilities', value: 20, color: '#ef5362' },
]

const weeklyActivity = [
    { day: 'Mon', transactions: 12, volume: 1420 },
    { day: 'Tue', transactions: 18, volume: 2150 },
    { day: 'Wed', transactions: 24, volume: 3100 },
    { day: 'Thu', transactions: 15, volume: 1890 },
    { day: 'Fri', transactions: 28, volume: 4200 },
    { day: 'Sat', transactions: 32, volume: 4900 },
    { day: 'Sun', transactions: 20, volume: 2800 },
]

export function Analytics() {
    const { theme } = useTheme()
    const [timeframe, setTimeframe] = useState('Last 6 Months')

    return (
        <div className='flex flex-col gap-8 pb-12'>
            {/* Header */}
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight mb-1'>
                        Financial Analytics
                    </h1>
                    <p className='text-[#777984] dark:text-[#888a93] text-sm'>
                        Real-time visualization of your spending, income flows, and category distributions
                    </p>
                </div>
                <div className='flex items-center gap-2 rounded-2xl bg-white dark:bg-[#121214] p-1.5 border border-black/[0.05] dark:border-white/[0.08] shadow-sm'>
                    {['Last 30 Days', 'Last 6 Months', 'Year to Date'].map((t) => (
                        <button
                            key={t}
                            type='button'
                            onClick={() => setTimeframe(t)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                timeframe === t
                                    ? 'bg-[#19191b] text-white dark:bg-white dark:text-black shadow-sm'
                                    : 'text-[#777984] hover:text-[#1c1c24] dark:text-[#888a93] dark:hover:text-white'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Income vs Expense Chart */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[28px] p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'
            >
                <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
                    <div>
                        <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white tracking-tight'>
                            Cashflow Performance
                        </h2>
                        <p className='text-[#777984] dark:text-[#888a93] text-xs font-medium mt-0.5'>
                            Income inflows vs. Expense outflows
                        </p>
                    </div>
                    <div className='flex gap-5'>
                        <div className='flex items-center gap-2'>
                            <div className='w-3 h-3 rounded-full bg-[#7042f4]' />
                            <span className='text-[#1c1c24] dark:text-white text-xs font-bold'>Income</span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <div className='w-3 h-3 rounded-full bg-[#ef5362]' />
                            <span className='text-[#1c1c24] dark:text-white text-xs font-bold'>Expense</span>
                        </div>
                    </div>
                </div>

                <div className='h-[340px] w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                        <AreaChart data={performanceData}>
                            <defs>
                                <linearGradient id='incomeGradient' x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='5%' stopColor='#7042f4' stopOpacity={0.3} />
                                    <stop offset='95%' stopColor='#7042f4' stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id='expenseGradient' x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='5%' stopColor='#ef5362' stopOpacity={0.25} />
                                    <stop offset='95%' stopColor='#ef5362' stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                            />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#81858c', fontSize: 11, fontWeight: 600 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#81858c', fontSize: 11, fontWeight: 600 }}
                                tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: theme === 'dark' ? '#18181b' : '#ffffff',
                                    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                    borderRadius: '16px',
                                    padding: '12px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                }}
                                itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                            />
                            <Area
                                type='monotone'
                                dataKey='income'
                                stroke='#7042f4'
                                strokeWidth={3.5}
                                fill='url(#incomeGradient)'
                                dot={{ r: 4, fill: '#7042f4', strokeWidth: 0 }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                            <Area
                                type='monotone'
                                dataKey='expense'
                                stroke='#ef5362'
                                strokeWidth={3}
                                fill='url(#expenseGradient)'
                                dot={{ r: 4, fill: '#ef5362', strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Bottom Row: Spending Categories & Weekly Volume */}
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-8'>
                {/* Spending by Category */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[28px] p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'
                >
                    <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white mb-6 tracking-tight'>
                        Spending Categories
                    </h2>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6 items-center'>
                        <div className='h-[220px] w-full'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <PieChart>
                                    <Pie
                                        data={spendingCategories}
                                        dataKey='value'
                                        nameKey='name'
                                        cx='50%'
                                        cy='50%'
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                    >
                                        {spendingCategories.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: theme === 'dark' ? '#18181b' : '#ffffff',
                                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                            borderRadius: '14px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className='space-y-3.5'>
                            {spendingCategories.map((c) => (
                                <div key={c.name} className='flex items-center justify-between'>
                                    <div className='flex items-center gap-2.5'>
                                        <div className='w-3 h-3 rounded-full' style={{ backgroundColor: c.color }} />
                                        <span className='text-xs font-bold text-[#1c1c24] dark:text-white'>{c.name}</span>
                                    </div>
                                    <span className='text-xs font-bold text-[#81858c]'>{c.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Weekly Transaction Velocity */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                    className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[28px] p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'
                >
                    <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white mb-6 tracking-tight'>
                        Weekly Velocity
                    </h2>
                    <div className='h-[220px] w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                            <BarChart data={weeklyActivity} barSize={20}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
                                />
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#81858c', fontSize: 10, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#81858c', fontSize: 10, fontWeight: 600 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: theme === 'dark' ? '#18181b' : '#ffffff',
                                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: '14px'
                                    }}
                                />
                                <Bar dataKey="volume" fill="#7042f4" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
