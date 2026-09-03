'use client'

import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet'
import { Address, Avatar, Name, Identity, EthBalance } from '@coinbase/onchainkit/identity'

const cardColors = [
    { name: 'Emerald Night', value: 'from-primary to-secondary' },
    { name: 'Electric Violet', value: 'from-purple-600 to-blue-600' },
    { name: 'Sunset Blaze', value: 'from-orange-500 to-red-600' },
    { name: 'Ocean Depths', value: 'from-cyan-500 to-blue-700' },
    { name: 'Royal Gold', value: 'from-yellow-400 to-orange-500' },
    { name: 'Space Gray', value: 'from-zinc-700 to-zinc-900' }
]

const Cards = () => {
    const { data: session } = useSession()
    const [cards, setCards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCardIdx, setSelectedCardIdx] = useState(0)
    const [isWalletConnected, setIsWalletConnected] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    
    const { address, isConnected } = useAccount()
    const { disconnect } = useDisconnect()

    // Form states for new card
    const [cardHolder, setCardHolder] = useState(session?.user?.name || '')
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
            // Check if previously connected via DB
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
    }, [session, isConnected, address])

    useEffect(() => {
        if (session?.user?.name && !cardHolder) {
            setCardHolder(session.user.name)
        }
    }, [session])

    const handleCreateCard = async () => {
        try {
            const res = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'Virtual',
                    color: cardColor,
                    holder: cardHolder,
                    spendingLimit: parseFloat(spendingLimit),
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
        <div className='flex flex-col gap-10 pb-10 relative'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
                <div>
                    <h1 className='text-3xl font-bold text-white mb-1'>Your Cards</h1>
                    <p className='text-white/40 text-sm'>Manage your physical and virtual payment cards</p>
                </div>
                {isWalletConnected && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className='bg-primary text-background px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20'
                    >
                        <Icon icon='solar:add-circle-linear' width='24' height='24' />
                        Create Virtual Card
                    </button>
                )}
            </div>

            {!isWalletConnected ? (
                <div className='bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center flex flex-col items-center gap-8 max-w-4xl mx-auto w-full'>
                    <div className='w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary'>
                        <Icon icon='solar:wallet-2-linear' width='48' height='48' />
                    </div>
                    <div>
                        <h2 className='text-3xl font-black text-white mb-3'>Connect your bank or wallet</h2>
                        <p className='text-white/40 max-w-md mx-auto'>To generate a virtual card, you first need to connect a funding source. This allows for seamless top-ups and limit management.</p>
                    </div>
                    <div className='flex justify-center w-full max-w-md'>
                        <WalletDropdown>
                            <ConnectWallet className="bg-primary text-background px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                                <Avatar className="h-6 w-6" />
                                <Name />
                            </ConnectWallet>
                            <WalletDropdownDisconnect />
                        </WalletDropdown>
                    </div>
                </div>
            ) : (
                <div className='grid grid-cols-1 xl:grid-cols-2 gap-10'>
                    {/* Cards List */}
                    <div className='space-y-6'>
                        <h2 className='text-xl font-bold text-white tracking-tight px-2'>My Wallet</h2>
                        <div className='grid gap-6'>
                            {loading ? (
                                <div className='text-white/40 p-10 text-center'>Loading cards...</div>
                            ) : cards.length === 0 ? (
                                <div className='text-white/40 p-10 text-center border border-white/10 border-dashed rounded-[2.5rem]'>
                                    No cards found. Create your first virtual card!
                                </div>
                            ) : (
                                cards.map((card, idx) => (
                                    <motion.div
                                        key={card.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => setSelectedCardIdx(idx)}
                                        className={`bg-linear-to-br ${card.color} rounded-[2.5rem] p-8 aspect-[1.6/1] flex flex-col justify-between relative overflow-hidden group shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.02] ${selectedCardIdx === idx ? 'ring-2 ring-primary ring-offset-4 ring-offset-background' : ''}`}
                                    >
                                        <div className='absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/20 blur-[60px] rounded-full transition-all duration-700 group-hover:bg-white/30' />
                                        <div className='flex justify-between items-start relative z-10'>
                                            <span className='text-white font-black italic text-2xl tracking-tighter'>Swippable</span>
                                            <div className='flex flex-col items-end'>
                                                <Icon icon='solar:chip-linear' width='50' height='50' className='text-white/90' />
                                                <span className='text-[10px] text-white/60 font-black uppercase tracking-widest mt-1'>{card.type} Card</span>
                                            </div>
                                        </div>

                                        <div className='text-white text-3xl font-mono tracking-[0.15em] relative z-10 mt-4 tabular-nums'>
                                            {card.number}
                                        </div>

                                        <div className='flex justify-between items-end text-white relative z-10'>
                                            <div className='space-y-4'>
                                                <div>
                                                    <p className='text-[10px] text-white/60 uppercase tracking-widest font-black mb-1'>Card Holder</p>
                                                    <p className='font-bold text-lg'>{card.holder}</p>
                                                </div>
                                                <div className='flex gap-10'>
                                                    <div>
                                                        <p className='text-[10px] text-white/60 uppercase tracking-widest font-black mb-1'>Expiry</p>
                                                        <p className='font-bold text-lg'>{card.expiry}</p>
                                                    </div>
                                                    <div>
                                                        <p className='text-[10px] text-white/60 uppercase tracking-widest font-black mb-1'>Status</p>
                                                        <div className='flex items-center gap-2'>
                                                            <div className={`w-2 h-2 rounded-full ${card.status === 'Active' ? 'bg-secondary animate-pulse' : 'bg-red-500'}`} />
                                                            <p className='font-bold text-lg'>{card.status}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='bg-white/25 w-16 h-10 rounded-xl backdrop-blur-md border border-white/20 flex flex-col items-center justify-center'>
                                                <span className='text-[10px] font-black opacity-50'>{card.currency}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Card Details & Management */}
                    <div className='space-y-8'>
                        {selectedCard && (
                            <div className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10'>
                                <h2 className='text-xl font-bold text-white mb-8 tracking-tight'>Card Management</h2>
                                <div className='space-y-4'>
                                    <button className='w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group'>
                                        <div className='flex items-center gap-4'>
                                            <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:scale-110 transition-transform`}>
                                                <Icon icon='solar:shield-keyhole-linear' width='24' height='24' />
                                            </div>
                                            <div className='text-left'>
                                                <p className='text-white font-bold text-sm'>Change PIN</p>
                                                <p className='text-white/20 text-xs font-medium'>Secure your card with a new code</p>
                                            </div>
                                        </div>
                                        <Icon icon='solar:alt-arrow-right-linear' className='text-white/20 group-hover:text-primary transition-colors' />
                                    </button>

                                    <button
                                        onClick={() => handleToggleFreeze(selectedCard.id, selectedCard.status)}
                                        className='w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group'
                                    >
                                        <div className='flex items-center gap-4'>
                                            <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform`}>
                                                <Icon icon='solar:plain-linear' width='24' height='24' />
                                            </div>
                                            <div className='text-left'>
                                                <p className='text-white font-bold text-sm'>{selectedCard.status === 'Active' ? 'Freeze Card' : 'Unfreeze Card'}</p>
                                                <p className='text-white/20 text-xs font-medium'>Temporarily disable your card</p>
                                            </div>
                                        </div>
                                        <Icon icon='solar:alt-arrow-right-linear' className='text-white/20 group-hover:text-primary transition-colors' />
                                    </button>

                                    {selectedCard.type === 'Virtual' && (
                                        <button
                                            onClick={() => handleDeleteCard(selectedCard.id)}
                                            className='w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group'
                                        >
                                            <div className='flex items-center gap-4'>
                                                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform`}>
                                                    <Icon icon='solar:trash-bin-minimalistic-linear' width='24' height='24' />
                                                </div>
                                                <div className='text-left'>
                                                    <p className='text-white font-bold text-sm'>Delete Virtual Card</p>
                                                    <p className='text-white/20 text-xs font-medium'>Permanently remove this card</p>
                                                </div>
                                            </div>
                                            <Icon icon='solar:alt-arrow-right-linear' className='text-white/20 group-hover:text-primary transition-colors' />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10'>
                            <h2 className='text-xl font-bold text-white mb-6 tracking-tight'>Spending Statistics</h2>
                            <div className='space-y-6'>
                                <div className='flex justify-between items-end'>
                                    <div>
                                        <p className='text-white/40 text-[10px] uppercase font-black tracking-widest mb-1'>Monthly Limit</p>
                                        <p className='text-3xl font-black text-white'>${Number(selectedCard?.spendingLimit || 5000).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <p className='text-primary text-sm font-bold'>${Number(selectedCard?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} Used</p>
                                </div>
                                <div className='w-full h-3 bg-white/5 rounded-full overflow-hidden'>
                                    <div
                                        className='h-full bg-primary shadow-[0_0_20px_rgba(71,126,112,0.5)]'
                                        style={{ width: `${(Number(selectedCard?.balance || 0) / Number(selectedCard?.spendingLimit || 5000)) * 100}%` }}
                                    />
                                </div>
                                <p className='text-white/20 text-xs text-center font-medium'>You have {100 - Math.round((Number(selectedCard?.balance || 0) / Number(selectedCard?.spendingLimit || 5000)) * 100)}% of your monthly limit remaining</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Card Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className='fixed inset-0 z-[100] flex items-center justify-center p-6'>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className='absolute inset-0 bg-black/80 backdrop-blur-xl'
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className='bg-[#0d0d0d] border border-white/10 rounded-[3rem] p-10 max-w-2xl w-full relative z-10 shadow-3xl'
                        >
                            <div className='flex justify-between items-start mb-8'>
                                <div>
                                    <h2 className='text-3xl font-black text-white mb-1'>New Virtual Card</h2>
                                    <p className='text-white/40 text-sm'>Customize your new virtual spending card</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className='w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors'
                                >
                                    <Icon icon='solar:close-circle-linear' width='24' height='24' />
                                </button>
                            </div>

                            <div className='grid grid-cols-1 md:grid-cols-2 gap-10'>
                                <div className='space-y-8'>
                                    <div className='space-y-3'>
                                        <label className='text-white/30 text-[10px] font-black uppercase tracking-[0.2em] ml-1'>Card Holder Name</label>
                                        <input
                                            type="text"
                                            value={cardHolder}
                                            onChange={(e) => setCardHolder(e.target.value)}
                                            placeholder="Enter name"
                                            className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-primary transition-all'
                                        />
                                    </div>
                                    <div className='space-y-3'>
                                        <label className='text-white/30 text-[10px] font-black uppercase tracking-[0.2em] ml-1'>Spending Limit (USD)</label>
                                        <input
                                            type="number"
                                            value={spendingLimit}
                                            onChange={(e) => setSpendingLimit(e.target.value)}
                                            placeholder="5000"
                                            className='w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-primary transition-all'
                                        />
                                    </div>
                                    <div className='space-y-3'>
                                        <label className='text-white/30 text-[10px] font-black uppercase tracking-[0.2em] ml-1'>Card Layout</label>
                                        <div className='grid grid-cols-3 gap-3'>
                                            {cardColors.map((color) => (
                                                <button
                                                    key={color.name}
                                                    onClick={() => setCardColor(color.value)}
                                                    className={`h-12 rounded-xl bg-linear-to-br ${color.value} border-2 transition-all ${cardColor === color.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className='flex flex-col justify-center'>
                                    <p className='text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-center'>Preview</p>
                                    <div className={`bg-linear-to-br ${cardColor} rounded-3xl p-6 aspect-[1.6/1] flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-primary/10`}>
                                        <div className='absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-white/20 blur-[40px] rounded-full' />
                                        <div className='flex justify-between items-start relative z-10'>
                                            <span className='text-white font-black italic text-lg tracking-tighter'>Swippable</span>
                                            <Icon icon='solar:chip-linear' width='32' height='32' className='text-white/90' />
                                        </div>
                                        <div className='text-white text-xl font-mono tracking-[0.1em] relative z-10 tabular-nums'>
                                            **** **** **** ****
                                        </div>
                                        <div className='flex justify-between items-end text-white relative z-10'>
                                            <div>
                                                <p className='text-[8px] text-white/60 uppercase tracking-widest font-black mb-0.5'>Holder</p>
                                                <p className='font-bold text-sm truncate max-w-[120px]'>{cardHolder || 'Your Name'}</p>
                                            </div>
                                            <div className='bg-white/25 px-2 py-1 rounded-lg backdrop-blur-md border border-white/10 text-[10px] font-black'>USD</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCreateCard}
                                        className='bg-primary text-background w-full py-5 rounded-[2rem] font-black uppercase tracking-widest mt-10 hover:opacity-90 transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95'
                                    >
                                        Generate Card
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

export { Cards };
