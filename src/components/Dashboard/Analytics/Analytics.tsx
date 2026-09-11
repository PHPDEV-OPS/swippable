'use client'

import { motion } from 'framer-motion'
import React, { useMemo, useState } from 'react'
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
    Cell,
} from 'recharts'
import { formatMoney } from '@/lib/money'
import { useAnalytics } from '@/lib/client-api'
import type { AnalyticsResponse } from '@/types/api'

const RANGES: Array<{ value: AnalyticsResponse['range']; label: string }> = [
    { value: '30d', label: 'Last 30 Days' },
    { value: '6m', label: 'Last 6 Months' },
    { value: 'ytd', label: 'Year to Date' },
]

export function Analytics() {
    const { theme } = useTheme()
    const [range, setRange] = useState<AnalyticsResponse['range']>('6m')

    const { data, isLoading, isError } = useAnalytics(range)

    const currency = data?.currency ?? 'USD'

    const tooltipStyle = useMemo(
        () => ({
            background: theme === 'dark' ? '#18181b' : '#ffffff',
            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
            borderRadius: '16px',
            padding: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        }),
        [theme]
    )

    const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'

    const cashflow = data?.cashflow ?? []
    const categories = data?.categories ?? []
    const velocity = data?.velocity ?? []

    const hasCashflow = cashflow.some((point) => point.income > 0 || point.expense > 0)
    const hasCategories = categories.length > 0
    const hasVelocity = velocity.some((point) => point.transactions > 0)

    const summaryTiles = [
        { label: 'Income', value: data?.totals.income ?? '0.00', tone: 'text-[#12b88f]' },
        { label: 'Expense', value: data?.totals.expense ?? '0.00', tone: 'text-[#ef5362]' },
        { label: 'Net', value: data?.totals.net ?? '0.00', tone: 'text-[#7042f4] dark:text-[#c4a8ff]' },
        {
            label: 'Avg. transaction',
            value: data?.totals.averageTransaction ?? '0.00',
            tone: 'text-[#1c1c24] dark:text-white',
        },
    ]

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Header */}
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-3xl">
                        Financial Analytics
                    </h1>
                    <p className="text-sm text-[#777984] dark:text-[#888a93]">
                        {isLoading
                            ? 'Aggregating your ledger…'
                            : `${data?.totals.transactionCount ?? 0} settled transactions in this range`}
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-black/[0.05] bg-white p-1.5 shadow-sm dark:border-white/[0.08] dark:bg-[#121214]">
                    {RANGES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setRange(option.value)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                                range === option.value
                                    ? 'bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                                    : 'text-[#777984] hover:text-[#1c1c24] dark:text-[#888a93] dark:hover:text-white'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {isError && (
                <div className="rounded-2xl border border-[#ef5362]/20 bg-[#ffebeb] px-4 py-3 text-xs font-semibold text-[#ef5362] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                    We could not load your analytics. Try refreshing.
                </div>
            )}

            {/* Summary tiles */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {summaryTiles.map((tile) => (
                    <div
                        key={tile.label}
                        className="rounded-[20px] border border-black/[0.05] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.08] dark:bg-[#121214]"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9a9ca4]">{tile.label}</p>
                        <p className={`mt-1 text-xl font-extrabold tracking-tight ${tile.tone}`}>
                            {isLoading ? '—' : formatMoney(tile.value, currency)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Cashflow */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-[28px] border border-black/[0.05] bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] sm:p-6 dark:border-white/[0.08] dark:bg-[#121214] sm:p-8"
            >
                <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            Cashflow Performance
                        </h2>
                        <p className="mt-0.5 text-xs font-medium text-[#777984] dark:text-[#888a93]">
                            Deposits in versus card spending out
                        </p>
                    </div>
                    <div className="flex gap-5">
                        <Legend color="#7042f4" label="Income" />
                        <Legend color="#ef5362" label="Expense" />
                    </div>
                </div>

                <div className="h-[340px] w-full">
                    {hasCashflow ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cashflow}>
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7042f4" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#7042f4" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef5362" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#ef5362" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="period"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#81858c', fontSize: 11, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#81858c', fontSize: 11, fontWeight: 600 }}
                                    tickFormatter={(value) =>
                                        value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${value}`
                                    }
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                                    formatter={(value: any, name: any) => [
                                        formatMoney(String(value), currency),
                                        String(name),
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="income"
                                    stroke="#7042f4"
                                    strokeWidth={3.5}
                                    fill="url(#incomeGradient)"
                                    dot={{ r: 4, fill: '#7042f4', strokeWidth: 0 }}
                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="expense"
                                    stroke="#ef5362"
                                    strokeWidth={3}
                                    fill="url(#expenseGradient)"
                                    dot={{ r: 4, fill: '#ef5362', strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState
                            message={isLoading ? 'Loading cashflow…' : 'No settled transactions in this range yet.'}
                        />
                    )}
                </div>
            </motion.div>

            {/* Categories + velocity */}
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="rounded-[28px] border border-black/[0.05] bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] sm:p-6 dark:border-white/[0.08] dark:bg-[#121214] sm:p-8"
                >
                    <h2 className="mb-6 text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                        Spending Categories
                    </h2>

                    {hasCategories ? (
                        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categories}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                        >
                                            {categories.map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            formatter={(value: any, name: any, item: any) => [
                                                `${formatMoney(item?.payload?.amount ?? '0', currency)} (${value}%)`,
                                                String(name),
                                            ]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3.5">
                                {categories.map((category) => (
                                    <div key={category.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: category.color }}
                                            />
                                            <span className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                {category.name}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                {formatMoney(category.amount, currency)}
                                            </span>
                                            <span className="ml-2 text-xs font-bold text-[#81858c]">
                                                {category.value}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-[220px]">
                            <EmptyState
                                message={isLoading ? 'Loading…' : 'No card spending recorded in this range yet.'}
                            />
                        </div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                    className="rounded-[28px] border border-black/[0.05] bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.02)] sm:p-6 dark:border-white/[0.08] dark:bg-[#121214] sm:p-8"
                >
                    <h2 className="mb-1 text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                        Weekly Velocity
                    </h2>
                    <p className="mb-6 text-xs font-medium text-[#777984] dark:text-[#888a93]">
                        Transaction volume over the last 7 days
                    </p>

                    <div className="h-[220px] w-full">
                        {hasVelocity ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={velocity} barSize={20}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
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
                                        contentStyle={tooltipStyle}
                                        formatter={(value: any, _name: any, item: any) => [
                                            `${formatMoney(String(value), currency)} · ${item?.payload?.transactions ?? 0} tx`,
                                            'Volume',
                                        ]}
                                    />
                                    <Bar dataKey="volume" fill="#7042f4" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message={isLoading ? 'Loading…' : 'No activity in the last 7 days.'} />
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function Legend({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-bold text-[#1c1c24] dark:text-white">{label}</span>
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
