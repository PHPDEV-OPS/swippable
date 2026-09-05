'use client'

import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAccount } from 'wagmi'
import { formatMoney } from '@/lib/money'
import {
    ApiRequestError,
    useCards,
    useDeleteCard,
    useFundCard,
    useIssueCard,
    useLinkWallet,
    useMe,
    useSetCardStatus,
    useWallet,
} from '@/lib/client-api'
import type { VirtualCard } from '@/types/api'
import { SwippableCard } from './SwippableCard'
import { useRevealCard, type RevealedCard } from '@/lib/client-api'

const cardColors = [
    { name: 'Swippable Violet', value: 'from-[#6330cf] via-[#824fed] to-[#5b2bd0]' },
    { name: 'Emerald Night', value: 'from-teal-600 to-emerald-900' },
    { name: 'Electric Blue', value: 'from-blue-600 to-indigo-800' },
    { name: 'Sunset Blaze', value: 'from-orange-500 to-rose-600' },
    { name: 'Royal Gold', value: 'from-amber-400 to-orange-600' },
    { name: 'Midnight Onyx', value: 'from-zinc-800 to-black' },
]

function errorMessage(error: unknown, fallback: string) {
    return error instanceof ApiRequestError ? error.message : fallback
}

const Cards = () => {
    const me = useMe()
    const wallet = useWallet('7D')
    const cardsQuery = useCards()

    const issueCard = useIssueCard()
    const fundCard = useFundCard()
    const deleteCard = useDeleteCard()
    const setCardStatus = useSetCardStatus()
    const linkWallet = useLinkWallet()

    const { address, isConnected } = useAccount()

    const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showFundModal, setShowFundModal] = useState<'FUND' | 'WITHDRAW' | null>(null)

    const reveal = useRevealCard()
    const [revealed, setRevealed] = useState<RevealedCard | null>(null)
    const [revealError, setRevealError] = useState<string | null>(null)

    const [cardHolder, setCardHolder] = useState('')
    const [cardColor, setCardColor] = useState(cardColors[0].value)
    const [initialAmount, setInitialAmount] = useState('100')
    const [fundAmount, setFundAmount] = useState('50')

    const cards = cardsQuery.data ?? []
    const selectedCard: VirtualCard | undefined =
        cards.find((card) => card.cardId === selectedCardId) ?? cards[0]

    useEffect(() => {
        if (me.data?.name && !cardHolder) setCardHolder(me.data.name)
    }, [me.data?.name, cardHolder])

    // Persist a freshly connected on-chain address so crypto deposits can be matched.
    useEffect(() => {
        if (!isConnected || !address) return
        if (wallet.data?.onChainAddress?.toLowerCase() === address.toLowerCase()) return

        linkWallet.mutate(address, {
            onSuccess: () => toast.success('Wallet linked to your account'),
            onError: (error) => toast.error(errorMessage(error, 'Could not link the wallet')),
        })
        // linkWallet is stable for the component's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, address, wallet.data?.onChainAddress])

    const handleCreateCard = async () => {
        if (!initialAmount || Number(initialAmount) <= 0) {
            toast.error('Enter an amount greater than zero')
            return
        }

        try {
            const result = await issueCard.mutateAsync({
                amount: initialAmount,
                currency: 'USD',
                color: cardColor,
                holder: cardHolder || me.data?.name,
                type: 'Virtual',
            })
            setShowCreateModal(false)
            setSelectedCardId(result.card.cardId)
            toast.success(`Card •••• ${result.card.last4} issued`)
            if (result.warning) toast(result.warning, { icon: '⚠️', duration: 6000 })
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to issue the card'))
        }
    }

    const handleToggleFreeze = async (card: VirtualCard) => {
        const next = card.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
        try {
            await setCardStatus.mutateAsync({ cardId: card.cardId, status: next })
            toast.success(next === 'PAUSED' ? 'Card paused' : 'Card resumed')
        } catch (error) {
            toast.error(errorMessage(error, 'Could not update the card'))
        }
    }

    const handleDeleteCard = async (card: VirtualCard) => {
        if (!confirm(`Terminate card •••• ${card.last4}? Its unspent limit returns to your wallet.`)) return

        try {
            const result = await deleteCard.mutateAsync(card.cardId)
            setSelectedCardId(null)
            toast.success(`Card closed. ${formatMoney(result.released)} released back to your wallet.`)
        } catch (error) {
            toast.error(errorMessage(error, 'Could not terminate the card'))
        }
    }

    const handleReveal = async (card: VirtualCard) => {
        // A second press drops the values rather than merely hiding them.
        if (revealed) {
            setRevealed(null)
            setRevealError(null)
            return
        }

        setRevealError(null)
        try {
            setRevealed(await reveal.mutateAsync(card.cardId))
        } catch (error) {
            const message = errorMessage(error, 'Could not retrieve the card details')
            setRevealError(message)
            toast.error(message, { duration: 6000 })
        }
    }

    const handleAdjustFunding = async () => {
        if (!selectedCard) return
        if (!fundAmount || Number(fundAmount) <= 0) {
            toast.error('Enter an amount greater than zero')
            return
        }

        try {
            const result = await fundCard.mutateAsync({
                cardId: selectedCard.cardId,
                amount: fundAmount,
                action: showFundModal === 'WITHDRAW' ? 'WITHDRAW' : 'FUND',
            })
            setShowFundModal(null)
            toast.success(
                showFundModal === 'WITHDRAW'
                    ? `${formatMoney(fundAmount)} returned to your wallet`
                    : `${formatMoney(fundAmount)} allocated to •••• ${result.card.last4}`
            )
            if (result.warning) toast(result.warning, { icon: '⚠️', duration: 6000 })
        } catch (error) {
            toast.error(errorMessage(error, 'Could not update the card limit'))
        }
    }

    const unallocated = wallet.data?.unallocated ?? '0.00'

    return (
        <div className="relative flex flex-col gap-8 pb-10">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-[#1c1c24] dark:text-white sm:text-3xl">
                        Your Cards
                    </h1>
                    <p className="text-sm text-[#777984] dark:text-[#888a93]">
                        {formatMoney(unallocated)} of your wallet is still unallocated
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-6 py-3 font-bold text-white shadow-lg shadow-purple-500/20 transition-all hover:opacity-95 active:scale-95"
                >
                    <Icon icon="solar:add-circle-linear" width="22" height="22" />
                    Create Virtual Card
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {/* Card list */}
                <div className="space-y-5">
                    <h2 className="px-1 text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                        My Wallet
                    </h2>
                    <div className="grid gap-5">
                        {cardsQuery.isLoading ? (
                            <div className="rounded-3xl border border-black/[0.04] bg-white p-10 text-center text-[#777984] dark:border-white/[0.06] dark:bg-[#121214] dark:text-[#888a93]">
                                Loading cards…
                            </div>
                        ) : cards.length === 0 ? (
                            <div className="space-y-4 rounded-3xl border border-dashed border-black/[0.08] bg-white p-10 text-center dark:border-white/10 dark:bg-[#121214]">
                                <p className="text-sm text-[#777984] dark:text-[#888a93]">
                                    No cards yet. Issue one to allocate part of your wallet balance to it.
                                </p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="rounded-xl bg-[#6330cf] px-5 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90"
                                >
                                    + Issue Virtual Card
                                </button>
                            </div>
                        ) : (
                            cards.map((card, index) => (
                                <motion.div
                                    key={card.cardId}
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.08 }}
                                    onClick={() => {
                                        setSelectedCardId(card.cardId)
                                        setRevealed(null)
                                        setRevealError(null)
                                    }}
                                    className={`cursor-pointer rounded-[7%/11%] transition-all ${
                                        selectedCard?.cardId === card.cardId
                                            ? 'ring-3 ring-[#7042f4] ring-offset-4 ring-offset-[#f5f5f7] dark:ring-offset-[#080808]'
                                            : 'opacity-95 hover:opacity-100'
                                    }`}
                                >
                                    <SwippableCard
                                        card={card}
                                        interactive={selectedCard?.cardId === card.cardId}
                                        revealed={selectedCard?.cardId === card.cardId ? revealed : null}
                                        revealing={selectedCard?.cardId === card.cardId && reveal.isPending}
                                        revealError={selectedCard?.cardId === card.cardId ? revealError : null}
                                        onReveal={
                                            selectedCard?.cardId === card.cardId ? () => handleReveal(card) : undefined
                                        }
                                    />
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Card management */}
                <div className="space-y-6">
                    {selectedCard && (
                        <div className="rounded-[2rem] border border-black/[0.05] bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.08] dark:bg-[#121214]">
                            <h2 className="mb-6 text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                                Card Management
                            </h2>
                            <div className="space-y-3">
                                <ManagementRow
                                    icon="solar:card-send-linear"
                                    iconClass="text-[#6330cf] dark:text-[#c4a8ff]"
                                    title="Add Funds to Card"
                                    subtitle={`${formatMoney(unallocated)} unallocated in your wallet`}
                                    onClick={() => {
                                        setShowFundModal('FUND')
                                        setFundAmount('50')
                                    }}
                                />

                                <ManagementRow
                                    icon="solar:card-recive-linear"
                                    iconClass="text-[#12b88f]"
                                    title="Release Funds to Wallet"
                                    subtitle={`${formatMoney(selectedCard.availableToSpend)} available to release`}
                                    onClick={() => {
                                        setShowFundModal('WITHDRAW')
                                        setFundAmount('50')
                                    }}
                                />

                                <ManagementRow
                                    icon="solar:plain-linear"
                                    iconClass="text-amber-500"
                                    title={selectedCard.status === 'ACTIVE' ? 'Pause Card' : 'Resume Card'}
                                    subtitle="A paused card declines every authorisation"
                                    onClick={() => handleToggleFreeze(selectedCard)}
                                />

                                <ManagementRow
                                    icon="solar:trash-bin-minimalistic-linear"
                                    iconClass="text-red-500"
                                    title="Terminate Card"
                                    subtitle="Closes the card and releases its unspent limit"
                                    danger
                                    onClick={() => handleDeleteCard(selectedCard)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="rounded-[2rem] border border-black/[0.05] bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.08] dark:bg-[#121214]">
                        <h2 className="mb-6 text-lg font-bold tracking-tight text-[#1c1c24] dark:text-white">
                            Spending Statistics
                        </h2>

                        {selectedCard ? (
                            <div className="space-y-5">
                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#777984] dark:text-[#888a93]">
                                            Card Limit
                                        </p>
                                        <p className="text-2xl font-extrabold text-[#1c1c24] dark:text-white sm:text-3xl">
                                            {formatMoney(selectedCard.cardSpendingLimit, selectedCard.currency)}
                                        </p>
                                    </div>
                                    <p className="text-sm font-bold text-[#ef5362]">
                                        {formatMoney(selectedCard.totalSpentByCard, selectedCard.currency)} spent
                                    </p>
                                </div>

                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f5f5f7] dark:bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#6330cf] to-[#12b88f]"
                                        style={{ width: `${Math.min(100, selectedCard.utilisation)}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-center">
                                    <div className="rounded-2xl bg-[#fafafc] p-3 dark:bg-white/[0.03]">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9a9ca4]">
                                            Available
                                        </p>
                                        <p className="text-sm font-extrabold text-[#1c1c24] dark:text-white">
                                            {formatMoney(selectedCard.availableToSpend, selectedCard.currency)}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-[#fafafc] p-3 dark:bg-white/[0.03]">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9a9ca4]">
                                            Transactions
                                        </p>
                                        <p className="text-sm font-extrabold text-[#1c1c24] dark:text-white">
                                            {selectedCard.transactionCount}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-center text-xs font-medium text-[#777984] dark:text-[#888a93]">
                                    {Math.max(0, 100 - Math.round(selectedCard.utilisation))}% of this card&apos;s
                                    limit is still available
                                </p>
                            </div>
                        ) : (
                            <p className="py-6 text-center text-xs text-[#777984] dark:text-[#888a93]">
                                Issue a card to see its spending statistics.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Create card modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <ModalShell onClose={() => setShowCreateModal(false)}>
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Issue Swippable Virtual Card</h2>
                                <p className="mt-0.5 text-xs text-[#777984] dark:text-[#888a93]">
                                    {formatMoney(unallocated)} unallocated in your wallet
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[#777984] transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                            >
                                <Icon icon="solar:close-circle-linear" width="22" height="22" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <Field label="Cardholder Name">
                                <input
                                    type="text"
                                    value={cardHolder}
                                    onChange={(event) => setCardHolder(event.target.value)}
                                    placeholder="Enter cardholder name"
                                    className="w-full rounded-xl border border-black/10 bg-[#f5f5f7] px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/10 dark:bg-white/5"
                                />
                            </Field>

                            <Field label="Amount to allocate (USD)">
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={initialAmount}
                                    onChange={(event) => setInitialAmount(event.target.value)}
                                    className="w-full rounded-xl border border-black/10 bg-[#f5f5f7] px-4 py-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/10 dark:bg-white/5"
                                />
                            </Field>

                            <Field label="Card Colour Theme">
                                <div className="grid grid-cols-6 gap-2">
                                    {cardColors.map((color) => (
                                        <button
                                            key={color.name}
                                            type="button"
                                            onClick={() => setCardColor(color.value)}
                                            className={`h-9 rounded-xl bg-gradient-to-br ${color.value} border-2 transition-all ${
                                                cardColor === color.value
                                                    ? 'scale-105 border-black shadow-md dark:border-white'
                                                    : 'border-transparent opacity-70 hover:opacity-100'
                                            }`}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </Field>
                        </div>

                        <div className="flex gap-3 pt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 rounded-xl border border-black/10 py-3 text-xs font-bold text-[#777984] hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCard}
                                disabled={issueCard.isPending}
                                className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:opacity-95 disabled:opacity-60"
                            >
                                {issueCard.isPending ? 'Issuing…' : 'Generate Card'}
                            </button>
                        </div>
                    </ModalShell>
                )}
            </AnimatePresence>

            {/* Fund / withdraw modal */}
            <AnimatePresence>
                {showFundModal && selectedCard && (
                    <ModalShell onClose={() => setShowFundModal(null)}>
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {showFundModal === 'FUND' ? 'Add Funds to Card' : 'Release Funds to Wallet'}
                                </h2>
                                <p className="mt-0.5 text-xs text-[#777984] dark:text-[#888a93]">
                                    Card •••• {selectedCard.last4} ·{' '}
                                    {showFundModal === 'FUND'
                                        ? `${formatMoney(unallocated)} unallocated`
                                        : `${formatMoney(selectedCard.availableToSpend)} releasable`}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowFundModal(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[#777984] transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                            >
                                <Icon icon="solar:close-circle-linear" width="22" height="22" />
                            </button>
                        </div>

                        <Field label="Amount (USD)">
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={fundAmount}
                                onChange={(event) => setFundAmount(event.target.value)}
                                className="w-full rounded-xl border border-black/10 bg-[#f5f5f7] px-4 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-[#7042f4] dark:border-white/10 dark:bg-white/5"
                            />
                        </Field>

                        <div className="mt-3 flex gap-2">
                            {['25', '50', '100', '250'].map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setFundAmount(amount)}
                                    className="flex-1 rounded-lg bg-[#f5f5f7] py-1.5 text-xs font-bold text-[#777984] hover:text-[#1c1c24] dark:bg-white/5 dark:hover:text-white"
                                >
                                    ${amount}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-6">
                            <button
                                onClick={() => setShowFundModal(null)}
                                className="flex-1 rounded-xl border border-black/10 py-3 text-xs font-bold text-[#777984] hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdjustFunding}
                                disabled={fundCard.isPending}
                                className="flex-1 rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] py-3 text-xs font-bold text-white shadow-lg shadow-purple-500/20 hover:opacity-95 disabled:opacity-60"
                            >
                                {fundCard.isPending
                                    ? 'Working…'
                                    : showFundModal === 'FUND'
                                      ? 'Add Funds'
                                      : 'Release Funds'}
                            </button>
                        </div>
                    </ModalShell>
                )}
            </AnimatePresence>
        </div>
    )
}

function ManagementRow({
    icon,
    iconClass,
    title,
    subtitle,
    onClick,
    danger,
}: {
    icon: string
    iconClass: string
    title: string
    subtitle: string
    onClick: () => void
    danger?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`group flex w-full items-center justify-between rounded-2xl bg-[#f5f5f7] p-4 transition-all dark:bg-white/[0.04] ${
                danger ? 'hover:bg-red-50 dark:hover:bg-red-950/20' : 'hover:bg-[#eceef2] dark:hover:bg-white/[0.07]'
            }`}
        >
            <div className="flex items-center gap-4">
                <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/5 ${iconClass}`}
                >
                    <Icon icon={icon} width="22" height="22" />
                </div>
                <div className="text-left">
                    <p
                        className={`text-sm font-bold ${
                            danger ? 'text-red-600 dark:text-red-400' : 'text-[#1c1c24] dark:text-white'
                        }`}
                    >
                        {title}
                    </p>
                    <p className="text-xs font-medium text-[#777984] dark:text-[#888a93]">{subtitle}</p>
                </div>
            </div>
            <Icon icon="solar:alt-arrow-right-linear" className="text-[#9a9ca4]" />
        </button>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#777984] dark:text-[#888a93]">
                {label}
            </label>
            {children}
        </div>
    )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                className="relative z-10 w-full max-w-xl rounded-[2.5rem] border border-black/10 bg-white p-6 text-[#1c1c24] shadow-2xl dark:border-white/10 dark:bg-[#121214] dark:text-white sm:p-8"
            >
                {children}
            </motion.div>
        </div>
    )
}

export { Cards }
