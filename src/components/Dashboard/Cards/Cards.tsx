'use client'

import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet'
import { Avatar, Name } from '@coinbase/onchainkit/identity'

const cardColors = [
    { name: 'Swippable Violet', value: 'from-[#6330cf] via-[#824fed] to-[#5b2bd0]' },
    { name: 'Emerald Night', value: 'from-teal-600 to-emerald-900' },
    { name: 'Electric Blue', value: 'from-blue-600 to-indigo-800' },
    { name: 'Sunset Blaze', value: 'from-orange-500 to-rose-600' },
    { name: 'Royal Gold', value: 'from-amber-400 to-orange-600' },
    { name: 'Midnight Onyx', value: 'from-zinc-800 to-black' }
]

const Cards = () => {
    const { user } = useUser()
    const [cards, setCards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCardIdx, setSelectedCardIdx] = useState(0)
    const [isWalletConnected, setIsWalletConnected] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    
    const { address, isConnected } = useAccount()
    const { disconnect } = useDisconnect()

    // Form states for new card
    const [cardHolder, setCardHolder] = useState(user?.fullName || '')
    const [cardColor, setCardColor] = useState(cardColors[0].value)
    const [spendingLimit, setSpendingLimit] = useState('5000')

    const fetchCards = async () => {
        try {
            const res = await fetch('/api/cards')
            const data = await res.json()
            if (Array.isArray(data)) {
                setCards(data)
            }
        } catch (error) {
            console.error('Error fetching cards:', error)
        } finally {
            setLoading(false)
        }
    }

    const syncWallet = async (walletAddress: string) => {
        try {
            const res = await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress })
            })

            if (res.ok) {
                setIsWalletConnected(true)
                toast.success('Wallet connected successfully!')
            }
        } catch (error) {
            console.error('Error syncing wallet:', error)
        }
    }

    useEffect(() => {
        fetchCards()
        if (isConnected && address) {
            syncWallet(address)
        } else {
            const fetchWallet = async () => {
                try {
                    const res = await fetch('/api/wallet')
                    if (res.ok) {
                        const data = await res.json()
                        if (data && data.base_account_address) {
                            setIsWalletConnected(true)
                        }
                    }
                } catch (error) {
                    console.error('Error fetching wallet:', error)
                }
            }
            fetchWallet()
        }
    }, [user, isConnected, address])

    useEffect(() => {
        if (user?.fullName && !cardHolder) {
            setCardHolder(user.fullName)
        }
    }, [user])

    const handleCreateCard = async () => {
        try {
            const res = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'Virtual',
                    color: cardColor,
                    holder: cardHolder || user?.fullName || 'Swippable Cardholder',
                    spendingLimit: parseFloat(spendingLimit) || 5000,
                    balance: 0,
                    currency: 'USD'
                })
            })
            if (res.ok) {
                toast.success('Virtual card created successfully!')
                setShowCreateModal(false)
                fetchCards()
            }
        } catch (error) {
            toast.error('Failed to create virtual card')
            console.error('Error creating card:', error)
        }
    }

    const handleToggleFreeze = async (cardId: number, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'Frozen' : 'Active'
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                toast.success(`Card ${newStatus === 'Frozen' ? 'frozen' : 'unfrozen'}`)
                fetchCards()
            }
        } catch (error) {
            console.error('Error updating card:', error)
        }
    }

    const handleDeleteCard = async (cardId: number) => {
        if (!confirm('Are you sure you want to delete this virtual card?')) return
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success('Card deleted')
                fetchCards()
                setSelectedCardIdx(0)
            }
        } catch (error) {
            console.error('Error deleting card:', error)
        }
    }

    const selectedCard = cards[selectedCardIdx]

    return (
        <div className='flex flex-col gap-8 pb-10 relative'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight mb-1'>
                        Your Cards
                    </h1>
                    <p className='text-[#777984] dark:text-[#888a93] text-sm'>
                        Manage your physical and virtual Swippable payment cards
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className='bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-purple-500/20 active:scale-95'
                >
                    <Icon icon='solar:add-circle-linear' width='22' height='22' />
                    Create Virtual Card
                </button>
            </div>

            <div className='grid grid-cols-1 xl:grid-cols-2 gap-8'>
                {/* Cards List */}
                <div className='space-y-5'>
                    <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white tracking-tight px-1'>
                        My Wallet
                    </h2>
                    <div className='grid gap-5'>
                        {loading ? (
                            <div className='text-[#777984] dark:text-[#888a93] p-10 text-center bg-white dark:bg-[#121214] rounded-3xl border border-black/[0.04] dark:border-white/[0.06]'>
                                Loading cards...
                            </div>
                        ) : cards.length === 0 ? (
                            <div className='text-center p-10 bg-white dark:bg-[#121214] border border-dashed border-black/[0.08] dark:border-white/10 rounded-3xl space-y-4'>
                                <p className='text-[#777984] dark:text-[#888a93] text-sm'>
                                    No cards found yet. Create your first virtual card now!
                                </p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className='bg-[#6330cf] text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-all'
                                >
                                    + Issue Virtual Card
                                </button>
                            </div>
                        ) : (
                            cards.map((card, idx) => (
                                <motion.div
                                    key={card.id}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.08 }}
                                    onClick={() => setSelectedCardIdx(idx)}
                                    className={`bg-gradient-to-br ${card.color || 'from-[#6330cf] to-[#8553ec]'} rounded-[2rem] p-7 aspect-[1.6/1] flex flex-col justify-between relative overflow-hidden group shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.01] ${selectedCardIdx === idx ? 'ring-3 ring-[#7042f4] ring-offset-4 ring-offset-[#f5f5f7] dark:ring-offset-[#080808]' : ''}`}
                                >
                                    {/* Gloss reflection overlay */}
                                    <div className='pointer-events-none absolute -inset-full bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.2)_48%,rgba(255,255,255,0.05)_55%,transparent_70%)] opacity-80' />

                                    <div className='flex justify-between items-start relative z-10'>
                                        <span className='text-white font-black italic text-2xl tracking-tighter'>Swippable</span>
                                        <div className='flex flex-col items-end'>
                                            <Icon icon='solar:chip-linear' width='42' height='42' className='text-white/90' />
                                            <span className='text-[9px] text-white/70 font-black uppercase tracking-widest mt-1'>{card.type || 'Virtual'} Card</span>
                                        </div>
                                    </div>

                                    <div className='text-white text-2xl sm:text-3xl font-mono tracking-[0.16em] relative z-10 mt-3 tabular-nums drop-shadow-sm'>
                                        {card.number || '•••• •••• •••• 3456'}
                                    </div>

                                    <div className='flex justify-between items-end text-white relative z-10'>
                                        <div className='space-y-3'>
                                            <div>
                                                <p className='text-[9px] text-white/70 uppercase tracking-widest font-bold mb-0.5'>Card Holder</p>
                                                <p className='font-bold text-base sm:text-lg uppercase'>{card.holder || user?.fullName || 'CARDHOLDER'}</p>
                                            </div>
                                            <div className='flex gap-8'>
                                                <div>
                                                    <p className='text-[9px] text-white/70 uppercase tracking-widest font-bold mb-0.5'>Expiry</p>
                                                    <p className='font-semibold text-sm sm:text-base'>{card.expiry || '12/28'}</p>
                                                </div>
                                                <div>
                                                    <p className='text-[9px] text-white/70 uppercase tracking-widest font-bold mb-0.5'>Status</p>
                                                    <div className='flex items-center gap-1.5'>
                                                        <div className={`w-2 h-2 rounded-full ${card.status === 'Active' ? 'bg-[#12b88f] animate-pulse' : 'bg-red-500'}`} />
                                                        <p className='font-semibold text-sm sm:text-base'>{card.status || 'Active'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-xs'>
                                            {card.currency || 'USD'}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Card Details & Management */}
                <div className='space-y-6'>
                    {selectedCard && (
                        <div className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[2rem] p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'>
                            <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white mb-6 tracking-tight'>Card Management</h2>
                            <div className='space-y-3'>
                                <button className='w-full flex items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.04] hover:bg-[#eceef2] dark:hover:bg-white/[0.07] transition-all group'>
                                    <div className='flex items-center gap-4'>
                                        <div className='w-11 h-11 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-[#6330cf] dark:text-[#c4a8ff] shadow-sm'>
                                            <Icon icon='solar:shield-keyhole-linear' width='22' height='22' />
                                        </div>
                                        <div className='text-left'>
                                            <p className='text-[#1c1c24] dark:text-white font-bold text-sm'>Change Security PIN</p>
                                            <p className='text-[#777984] dark:text-[#888a93] text-xs font-medium'>Update authentication code</p>
                                        </div>
                                    </div>
                                    <Icon icon='solar:alt-arrow-right-linear' className='text-[#9a9ca4] group-hover:text-[#6330cf] dark:group-hover:text-white transition-colors' />
                                </button>

                                <button
                                    onClick={() => handleToggleFreeze(selectedCard.id, selectedCard.status)}
                                    className='w-full flex items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.04] hover:bg-[#eceef2] dark:hover:bg-white/[0.07] transition-all group'
                                >
                                    <div className='flex items-center gap-4'>
                                        <div className='w-11 h-11 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-amber-500 shadow-sm'>
                                            <Icon icon='solar:plain-linear' width='22' height='22' />
                                        </div>
                                        <div className='text-left'>
                                            <p className='text-[#1c1c24] dark:text-white font-bold text-sm'>{selectedCard.status === 'Active' ? 'Freeze Card' : 'Unfreeze Card'}</p>
                                            <p className='text-[#777984] dark:text-[#888a93] text-xs font-medium'>Temporarily lock/unlock spending</p>
                                        </div>
                                    </div>
                                    <Icon icon='solar:alt-arrow-right-linear' className='text-[#9a9ca4] group-hover:text-amber-500 transition-colors' />
                                </button>

                                <button
                                    onClick={() => handleDeleteCard(selectedCard.id)}
                                    className='w-full flex items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] dark:bg-white/[0.04] hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group'
                                >
                                    <div className='flex items-center gap-4'>
                                        <div className='w-11 h-11 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-red-500 shadow-sm'>
                                            <Icon icon='solar:trash-bin-minimalistic-linear' width='22' height='22' />
                                        </div>
                                        <div className='text-left'>
                                            <p className='text-red-600 dark:text-red-400 font-bold text-sm'>Delete Virtual Card</p>
                                            <p className='text-[#777984] dark:text-[#888a93] text-xs font-medium'>Permanently deactivate card</p>
                                        </div>
                                    </div>
                                    <Icon icon='solar:alt-arrow-right-linear' className='text-[#9a9ca4] group-hover:text-red-500 transition-colors' />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[2rem] p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'>
                        <h2 className='text-lg font-bold text-[#1c1c24] dark:text-white mb-6 tracking-tight'>Spending Statistics</h2>
                        <div className='space-y-5'>
                            <div className='flex justify-between items-end'>
                                <div>
                                    <p className='text-[#777984] dark:text-[#888a93] text-[10px] uppercase font-bold tracking-widest mb-1'>Monthly Limit</p>
                                    <p className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white'>${Number(selectedCard?.spendingLimit || 5000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <p className='text-[#12b88f] text-sm font-bold'>${Number(selectedCard?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} Used</p>
                            </div>
                            <div className='w-full h-2.5 bg-[#f5f5f7] dark:bg-white/10 rounded-full overflow-hidden'>
                                <div
                                    className='h-full bg-gradient-to-r from-[#6330cf] to-[#12b88f] rounded-full'
                                    style={{ width: `${Math.min(100, (Number(selectedCard?.balance || 0) / Number(selectedCard?.spendingLimit || 5000)) * 100)}%` }}
                                />
                            </div>
                            <p className='text-[#777984] dark:text-[#888a93] text-xs text-center font-medium'>
                                You have {100 - Math.round((Number(selectedCard?.balance || 0) / Number(selectedCard?.spendingLimit || 5000)) * 100)}% of your monthly limit remaining
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Card Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6'>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className='absolute inset-0 bg-black/60 backdrop-blur-md'
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 16 }}
                            className='bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full relative z-10 shadow-2xl text-[#1c1c24] dark:text-white'
                        >
                            <div className='flex justify-between items-start mb-6'>
                                <div>
                                    <h2 className='text-2xl font-bold tracking-tight'>Issue Swippable Virtual Card</h2>
                                    <p className='text-[#777984] dark:text-[#888a93] text-xs mt-0.5'>Customize your new virtual spending card</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className='w-8 h-8 rounded-full flex items-center justify-center text-[#777984] hover:bg-black/5 dark:hover:bg-white/10 transition-colors'
                                >
                                    <Icon icon='solar:close-circle-linear' width='22' height='22' />
                                </button>
                            </div>

                            <div className='space-y-4'>
                                <div>
                                    <label className='text-[10px] font-bold uppercase tracking-wider text-[#777984] dark:text-[#888a93] block mb-1.5'>Cardholder Name</label>
                                    <input
                                        type="text"
                                        value={cardHolder}
                                        onChange={(e) => setCardHolder(e.target.value)}
                                        placeholder="Enter cardholder name"
                                        className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'
                                    />
                                </div>
                                <div>
                                    <label className='text-[10px] font-bold uppercase tracking-wider text-[#777984] dark:text-[#888a93] block mb-1.5'>Monthly Spending Limit (USD)</label>
                                    <input
                                        type="number"
                                        value={spendingLimit}
                                        onChange={(e) => setSpendingLimit(e.target.value)}
                                        placeholder="5000"
                                        className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'
                                    />
                                </div>
                                <div>
                                    <label className='text-[10px] font-bold uppercase tracking-wider text-[#777984] dark:text-[#888a93] block mb-1.5'>Card Color Theme</label>
                                    <div className='grid grid-cols-6 gap-2'>
                                        {cardColors.map((color) => (
                                            <button
                                                key={color.name}
                                                type='button'
                                                onClick={() => setCardColor(color.value)}
                                                className={`h-9 rounded-xl bg-gradient-to-br ${color.value} border-2 transition-all ${cardColor === color.value ? 'border-black dark:border-white scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className='flex gap-3 pt-6'>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className='flex-1 py-3 rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold text-[#777984] hover:bg-black/5 dark:hover:bg-white/5'
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCard}
                                    className='flex-1 bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white py-3 rounded-xl font-bold text-xs shadow-lg shadow-purple-500/20 hover:opacity-95'
                                >
                                    Generate Card
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export { Cards };
