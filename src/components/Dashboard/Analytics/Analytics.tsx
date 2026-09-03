'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

const performanceData = [
    { month: 'Jan', income: 4500, expense: 3100 },
    { month: 'Feb', income: 5200, expense: 3400 },
    { month: 'Mar', income: 4800, expense: 3800 },
    { month: 'Apr', income: 6100, expense: 4200 },
    { month: 'May', income: 5900, expense: 3900 },
    { month: 'Jun', income: 7200, expense: 4800 },
]

const categoryData = [
    { name: 'Shopping', value: 35, color: '#477e70' },
    { month: 'Travel', value: 25, color: '#8ae2d0' },
    { month: 'Food', value: 20, color: '#666c78' },
    { month: 'Bills', value: 20, color: '#2c3e50' },
]

// Note: categoryData keys corrected for consistency
const spendingCategories = [
    { name: 'Shopping', value: 35, color: '#477e70' },
    { name: 'Travel', value: 25, color: '#8ae2d0' },
    { name: 'Food', value: 20, color: '#477e70' },
    { name: 'Bills', value: 20, color: '#1a1a1a' },
]

export function Analytics() {
    return (
        <div className='flex flex-col gap-10 pb-10'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-3xl font-bold text-white mb-1'>Analytics</h1>
                    <p className='text-white/40 text-sm'>Deep dive into your financial performance and habits</p>
                </div>
                <div className='bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white/60 text-sm flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors'>
                    <Icon icon='solar:calendar-linear' width='20' height='20' />
                    <span>Last 6 Months</span>
                    <Icon icon='solar:alt-arrow-down-linear' />
                </div>
            </div>

            {/* Income vs Expense Chart */}
            <div className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10'>
                <div className='flex justify-between items-center mb-10'>
                    <div>
                        <h2 className='text-xl font-bold text-white tracking-tight'>Performance Overview</h2>
                        <p className='text-white/20 text-[10px] uppercase font-black tracking-widest mt-1'>Monthly cashflow analysis</p>
                    </div>
                    <div className='flex gap-6'>
                        <div className='flex items-center gap-2'>
                            <div className='w-3 h-3 rounded-full bg-primary' />
                            <span className='text-white/40 text-xs font-bold'>Income</span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <div className='w-3 h-3 rounded-full bg-white/10' />
                            <span className='text-white/40 text-xs font-bold'>Expense</span>
                        </div>
                    </div>
                </div>

                <div className='h-[400px] w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                        <AreaChart data={performanceData}>
                            <defs>
                                <linearGradient id='performanceGradient' x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='5%' stopColor='var(--primary)' stopOpacity={0.3} />
                                    <stop offset='95%' stopColor='var(--primary)' stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 'bold' }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 'bold' }}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px' }}
                                itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                            />
                            <Area
                                type='monotone'
                                dataKey='income'
                                stroke='var(--primary)'
                                strokeWidth={4}
                                fill='url(#performanceGradient)'
                                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                            <Area
                                type='monotone'
                                dataKey='expense'
                                stroke='rgba(255,255,255,0.1)'
                                strokeWidth={4}
                                fill='transparent'
                                dot={{ r: 4, fill: 'rgba(255,255,255,0.1)', strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className='grid grid-cols-1 xl:grid-cols-2 gap-10'>
                {/* Spending by Category */}
                <div className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10'>
                    <h2 className='text-xl font-bold text-white mb-8 tracking-tight'>Spending Categories</h2>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-10 items-center'>
                        <div className='h-[250px]'>
                            <ResponsiveContainer width='100%' height='100%'>
                                <PieChart>
                                    <Pie
                                        data={spendingCategories}
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {spendingCategories.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className='space-y-4'>
                            {spendingCategories.map((item, idx) => (
                                <div key={idx} className='flex items-center justify-between'>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-3 h-3 rounded-full' style={{ backgroundColor: item.color }} />
                                        <span className='text-white/60 text-sm font-bold'>{item.name}</span>
                                    </div>
                                    <span className='text-white font-black'>{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Savings Goal */}
                <div className='bg-primary/5 border border-primary/10 rounded-[2.5rem] p-10 flex flex-col justify-between'>
                    <div>
                        <div className='flex justify-between items-start mb-6'>
                            <div>
                                <h2 className='text-xl font-bold text-primary tracking-tight'>Savings Goal</h2>
                                <p className='text-primary/40 text-[10px] uppercase font-black tracking-widest mt-1'>Europe Summer Trip 2026</p>
                            </div>
                            <div className='w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-background shadow-xl shadow-primary/20'>
                                <Icon icon='solar:palet-2-linear' width='30' height='30' />
                            </div>
                        </div>
                        <div className='space-y-4'>
                            <div className='flex justify-between items-end'>
                                <p className='text-4xl font-black text-white'>$12,450.00</p>
                                <p className='text-primary font-bold'>Target: $20,000</p>
                            </div>
                            <div className='w-full h-4 bg-white/5 rounded-full overflow-hidden'>
                                <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: '62%' }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className='h-full bg-primary shadow-[0_0_20px_rgba(71,126,112,0.5)]'
                                />
                            </div>
                            <p className='text-white/40 text-xs font-medium'>You've reached 62% of your goal! Keep it upalexander.</p>
                        </div>
                    </div>

                    <button className='w-full bg-primary text-background py-4 rounded-2xl font-black uppercase tracking-widest mt-10 hover:opacity-90 transition-all'>
                        Increase Contributions
                    </button>
                </div>
            </div>
        </div>
    )
}
