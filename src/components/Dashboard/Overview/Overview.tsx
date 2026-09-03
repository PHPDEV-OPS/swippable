'use client'

import { useSession } from 'next-auth/react'
import React, { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts'

const chartData = [
    { name: 'Mon', value: 2400 },
    { name: 'Tue', value: 1398 },
    { name: 'Wed', value: 9800 },
    { name: 'Thu', value: 3908 },
    { name: 'Fri', value: 4800 },
    { name: 'Sat', value: 3800 },
    { name: 'Sun', value: 4300 },
]

const Overview = () => {
    const { data: session } = useSession()
    const [cards, setCards] = useState<any[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const [cardsRes, transRes] = await Promise.all([
                fetch('/api/cards'),
                fetch('/api/transactions')
            ])
            const cardsData = await cardsRes.json()
            const transData = await transRes.json()
            setCards(Array.isArray(cardsData) ? cardsData : [])
            setTransactions(Array.isArray(transData) ? transData : [])
        } catch (error) {
            console.error('Error fetching overview data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const totalBalance = cards.reduce((acc, card) => acc + Number(card.balance), 0)
    const mainCard = cards[0]

    return (
        <div className='flex flex-col gap-8 pb-10'>
            {/* Welcome Header */}
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-2xl font-bold text-white mb-1'>
                        Good afternoon, {session?.user?.name || 'User'}! 👋
                    </h1>
                    <p className='text-white/40 text-sm'>Welcome back to your financial dashboard</p>
                </div>
                <div className='flex items-center gap-3'>
                    <div className='bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white/60 text-sm flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors'>
                        <Icon icon='solar:calendar-linear' width='20' height='20' />
                        <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <Icon icon='solar:alt-arrow-down-linear' />
                    </div>
                    <button className='bg-primary text-background px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20'>
                        <Icon icon='solar:flash-drive-linear' width='20' height='20' />
                        Quick Transfer
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-1 xl:grid-cols-3 gap-8'>
                {/* Main Content Column */}
                <div className='xl:col-span-2 space-y-8'>

                    {/* Card and Balance Section */}
                    <div className='bg-white/5 border border-white/10 rounded-[2rem] p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center'>
                        {/* The Physical Card */}
                        {mainCard ? (
                            <div className={`bg-linear-to-br ${mainCard.color} rounded-3xl p-8 aspect-[1.58/1] flex flex-col justify-between relative overflow-hidden group shadow-2xl shadow-primary/10 transition-transform duration-500 hover:scale-[1.02]`}>
                                <div className='absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/20 blur-[50px] rounded-full transition-all duration-700 group-hover:bg-white/30' />
                                <div className='flex justify-between items-start relative z-10'>
                                    <span className='text-white font-black italic text-2xl tracking-tighter'>Swippable</span>
                                    <Icon icon='solar:chip-linear' width='50' height='50' className='text-white/90' />
                                </div>
                                <div className='text-white text-3xl font-mono tracking-[0.15em] relative z-10 mt-4 tabular-nums'>
                                    {mainCard.number}
                                </div>
                                <div className='flex justify-between items-end text-white relative z-10'>
                                    <div>
                                        <p className='text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1'>Card Holder Name</p>
                                        <p className='font-bold text-lg'>{mainCard.holder}</p>
                                    </div>
                                    <div>
                                        <p className='text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1'>Expiry</p>
                                        <p className='font-bold text-lg'>{mainCard.expiry}</p>
                                    </div>
                                    <div className='bg-white/25 w-14 h-9 rounded-lg backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-[10px] opacity-70'>
                                        {mainCard.currency}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className='bg-white/5 border border-white/10 border-dashed rounded-3xl aspect-[1.58/1] flex flex-col items-center justify-center gap-4 text-white/20'>
                                <Icon icon='solar:card-linear' width='48' height='48' />
                                <p className='font-bold'>No active cards</p>
                            </div>
                        )}

                        {/* Balance Info */}
                        <div className='space-y-8'>
                            <div className='relative'>
                                <p className='text-white/40 text-xs uppercase tracking-[0.2em] font-bold mb-2'>Total Balance</p>
                                <div className='flex items-end gap-3 font-bold text-white'>
                                    <span className='text-6xl tracking-tighter'>{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    <span className='text-2xl text-white/40 mb-2 font-medium'>USD</span>
                                </div>
                            </div>

                            <div className='grid grid-cols-4 gap-4'>
                                {[
                                    { icon: 'solar:square-share-line-linear', label: 'Send' },
                                    { icon: 'solar:reply-2-linear', label: 'Receive' },
                                    { icon: 'solar:copy-linear', label: 'Copy' },
                                    { icon: 'solar:shield-linear', label: 'Block' }
                                ].map((item, idx) => (
                                    <button key={idx} className='flex flex-col items-center gap-2 group'>
                                        <div className='w-14 h-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/60 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300 shadow-inner group-hover:shadow-lg group-hover:shadow-primary/20'>
                                            <Icon icon={item.icon} width='24' height='24' />
                                        </div>
                                        <span className='text-[11px] font-bold text-white/30 group-hover:text-white transition-colors uppercase tracking-widest'>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Transactions & Statistics Row */}
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                        {/* Transactions Card */}
                        <div className='bg-white/5 border border-white/10 rounded-[2rem] p-8'>
                            <div className='flex justify-between items-center mb-8'>
                                <h2 className='text-xl font-bold text-white tracking-tight'>Transactions</h2>
                                <button className='text-primary text-xs font-bold uppercase tracking-widest hover:underline'>Show more</button>
                            </div>

                            <div className='space-y-6'>
                                {transactions.length === 0 ? (
                                    <p className='text-white/20 text-center py-10 font-bold'>No recent activity</p>
                                ) : (
                                    transactions.slice(0, 3).map((t, idx) => (
                                        <div key={idx} className='flex justify-between items-center group cursor-pointer hover:translate-x-1 transition-transform'>
                                            <div className='flex items-center gap-4'>
                                                <div className='w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:scale-110 transition-transform'>
                                                    <Icon icon='solar:user-linear' width='24' height='24' />
                                                </div>
                                                <div>
                                                    <p className='text-white text-sm font-bold'>{t.merchant}</p>
                                                    <p className='text-white/20 text-[10px] uppercase tracking-wider font-bold'>{t.category}</p>
                                                </div>
                                            </div>
                                            <p className={`font-black text-sm tracking-tight ${t.type === 'income' ? 'text-primary' : 'text-white'}`}>
                                                {t.type === 'income' ? '+' : '-'}{Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className='text-[10px] opacity-30 font-bold ml-1'>{t.currency}</span>
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Statistics Card */}
                        <div className='bg-white/5 border border-white/10 rounded-[2rem] p-8 flex flex-col'>
                            <div className='flex justify-between items-center mb-8'>
                                <h2 className='text-xl font-bold text-white tracking-tight'>Your Statistics</h2>
                                <div className='bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-white/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-white transition-colors'>
                                    This week <Icon icon='solar:alt-arrow-down-linear' />
                                </div>
                            </div>
                            <div className='flex-1 h-[250px] w-full'>
                                <ResponsiveContainer width='100%' height='100%'>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id='statsGradient' x1='0' y1='0' x2='0' y2='1'>
                                                <stop offset='5%' stopColor='var(--primary)' stopOpacity={0.3} />
                                                <stop offset='95%' stopColor='var(--primary)' stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            contentStyle={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                            itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                                        />
                                        <Area
                                            type='monotone'
                                            dataKey='value'
                                            stroke='var(--primary)'
                                            fill='url(#statsGradient)'
                                            strokeWidth={4}
                                            dot={{ r: 6, fill: 'var(--primary)', strokeWidth: 0 }}
                                            activeDot={{ r: 8, fill: 'var(--primary)', stroke: '#fff', strokeWidth: 2 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Global Transfers Map/List */}
                    <div className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10 relative overflow-hidden'>
                        <div className='flex justify-between items-center mb-4 z-10 relative'>
                            <h2 className='text-2xl font-black text-white tracking-tighter'>Global Transfers</h2>
                            <button className='text-primary text-xs font-bold uppercase tracking-widest border-b border-primary/20 pb-0.5 hover:border-primary transition-all'>Show more</button>
                        </div>
                        <p className='text-white/20 text-[10px] mb-10 z-10 relative uppercase tracking-[0.3em] font-black'>Recent transfers around the world</p>

                        <div className='h-[350px] relative rounded-3xl overflow-hidden bg-white/[0.02] flex items-center justify-center'>
                            <Icon icon='solar:map-linear' width='80%' className='text-white/5' />
                            <div className='absolute top-1/3 left-1/4 w-3 h-3 bg-primary rounded-full animate-ping' />
                            <div className='absolute top-1/2 right-1/3 w-3 h-3 bg-secondary rounded-full animate-ping' />

                            <div className='absolute bottom-6 right-6 flex flex-col gap-2'>
                                <button className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors'><Icon icon='solar:add-linear' /></button>
                                <button className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors'><Icon icon='solar:minimize-linear' /></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (Invest & Transfer) */}
                <div className='space-y-8'>
                    {/* Smart Invest */}
                    <div className='bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl'>
                        <div className='flex justify-between items-center mb-8'>
                            <h2 className='text-xl font-bold text-white tracking-tight'>Smart Invest</h2>
                        </div>

                        <div className='space-y-8'>
                            {[
                                { name: 'TechFlow Inc', code: 'TFLO', price: '$116.33', change: '+$1,024.00' },
                                { name: 'DataVerse Corp', code: 'DVCR', price: '$228.92', change: '+$495.00' },
                                { name: 'CloudNine Systems', code: 'CNIN', price: '$561.12', change: '+$2,025.35' },
                                { name: 'FinSight Labs', code: 'FSLB', price: '$342.10', change: '+$210.45' }
                            ].map((stock, idx) => (
                                <div key={idx} className='flex justify-between items-center group cursor-pointer'>
                                    <div className='flex items-center gap-4'>
                                        <div className='w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-primary group-hover:text-background transition-all'>
                                            <Icon icon='solar:graph-up-linear' width='22' height='22' />
                                        </div>
                                        <div>
                                            <p className='text-white text-sm font-bold'>{stock.name}</p>
                                            <p className='text-white/20 text-[10px] font-black tracking-widest'>{stock.code}</p>
                                        </div>
                                    </div>
                                    <div className='text-right'>
                                        <p className='text-white text-sm font-black'>{stock.price}</p>
                                        <p className='text-primary text-[10px] font-black'>{stock.change}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fast Transfer */}
                    <div className='bg-white/5 border border-white/10 rounded-[2rem] p-8'>
                        <h2 className='text-xl font-bold text-white mb-8 tracking-tight'>Fast transfer</h2>

                        <div className='flex items-center gap-4 mb-10 overflow-x-auto pb-4 no-scrollbar'>
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className='min-w-[56px] h-14 rounded-full border-4 border-white/10 overflow-hidden ring-4 ring-white/5 flex-shrink-0 transition-transform hover:scale-110 cursor-pointer'>
                                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt='user' />
                                </div>
                            ))}
                        </div>

                        <div className='space-y-4'>
                            <div className='bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center'>
                                <span className='text-white/30 text-[10px] font-black uppercase tracking-widest'>Amount</span>
                                <input type="number" placeholder="0.00" className='bg-transparent text-right text-white text-[11px] font-black outline-none w-20' />
                            </div>
                        </div>

                        <button className='bg-primary text-background w-full py-5 mt-8 rounded-[2rem] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-2xl shadow-primary/30 active:scale-95'>
                            Transfer money
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { Overview };

