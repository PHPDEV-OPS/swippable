'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { MessageSquare, Sparkles, X, Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/money'
import { useIsDesktop } from '@/lib/use-media-query'
import { useCards, useDashboardSummary, useTransactions, useWallet } from '@/lib/client-api'
import type { LedgerTransaction, VirtualCard } from '@/types/api'

interface Message {
    id: string | number
    type: 'bot' | 'user'
    text: string
    timestamp: string
}

/**
 * The assistant takes two forms.
 *
 * On a phone it is a bottom sheet: it springs up from the bottom edge, sits
 * above a dimmed page, and is dismissed by dragging its handle down or flicking
 * it - the gesture people already use for every native sheet. On desktop it
 * stays the anchored panel hanging off the floating action button.
 */
export function AiChatButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [inputText, setInputText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dragControls = useDragControls()
    const isDesktop = useIsDesktop()

    // The assistant only ever quotes figures that came out of the database.
    const wallet = useWallet('7D')
    const cards = useCards()
    const transactions = useTransactions()
    const summary = useDashboardSummary('Month')

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            type: 'bot',
            text: "Hi! I'm the Swippable Assistant. Ask me about your wallet balance, cards, spending or recent payments - I read them straight from your account.",
            timestamp: 'Just now',
        },
    ])

    useEffect(() => {
        const handleToggle = () => setIsOpen((prev) => !prev)
        window.addEventListener('toggle-ai-chat', handleToggle)
        return () => window.removeEventListener('toggle-ai-chat', handleToggle)
    }, [])

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    // Escape closes, as it does for every other dialog in the dashboard.
    useEffect(() => {
        if (!isOpen) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen])

    // While the sheet covers the phone, the page behind it must not scroll.
    useEffect(() => {
        if (!isOpen || isDesktop) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [isOpen, isDesktop])

    // Focusing the field on a phone throws the keyboard up over the answer the
    // person just opened the sheet to read, so that is desktop-only.
    useEffect(() => {
        if (isOpen && isDesktop) inputRef.current?.focus()
    }, [isOpen, isDesktop])

    const quickPrompts = [
        'Check card balance',
        'Recent payments',
        'Create virtual card',
        'Spending limit status',
    ]

    const handleSendMessage = (textToSend?: string) => {
        const text = textToSend || inputText
        if (!text.trim()) return

        const userMsg: Message = {
            id: Date.now(),
            type: 'user',
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setMessages((prev) => [...prev, userMsg])
        if (!textToSend) setInputText('')
        setIsTyping(true)

        // Answers are composed from the live account state, never invented.
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    type: 'bot',
                    text: answerFrom(text, {
                        balance: wallet.data?.balance,
                        unallocated: wallet.data?.unallocated,
                        allocated: wallet.data?.allocatedToCards,
                        currency: wallet.data?.currency ?? 'USD',
                        cards: cards.data ?? [],
                        transactions: transactions.data ?? [],
                        spendThisMonth: summary.data?.totalExpense.value,
                        incomeThisMonth: summary.data?.totalIncome.value,
                        loading: wallet.isLoading || cards.isLoading || transactions.isLoading,
                    }),
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ])
            setIsTyping(false)
        }, 500)
    }

    /** A downward flick, or a drag past a third of the sheet, dismisses it. */
    const handleDragEnd = (_event: unknown, info: PanInfo) => {
        if (info.offset.y > 130 || info.velocity.y > 650) setIsOpen(false)
    }

    const panel = (
        <>
            {/* Grab handle. Only the header starts a drag, so scrolling the
                conversation never pulls the sheet down with it. */}
            <div
                onPointerDown={(event) => {
                    if (!isDesktop) dragControls.start(event)
                }}
                className="shrink-0 touch-none bg-gradient-to-r from-[#6330cf] to-[#8553ec] pt-2 lg:pt-0"
            >
                <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/40 lg:hidden" />
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 text-white lg:py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                            <Bot size={18} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold tracking-tight">Swippable Assistant</h3>
                            <p className="text-[10px] font-medium text-white/80">AI Financial Copilot</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
                        aria-label="Close Assistant"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Conversation. `min-h-0` is what lets this pane scroll instead of
                pushing the composer off the bottom of the sheet. */}
            <div className="scrollbar-none scroll-touch min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fafafc] p-4 dark:bg-[#0d0d0f]">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            'flex gap-2 text-[13px] lg:text-xs',
                            msg.type === 'user' ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {msg.type === 'bot' && (
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[#6330cf] dark:bg-[#281b45] dark:text-[#c4a8ff]">
                                <Sparkles size={12} />
                            </div>
                        )}
                        <div
                            className={cn(
                                'max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm',
                                msg.type === 'user'
                                    ? 'rounded-tr-none bg-[#6330cf] text-white'
                                    : 'rounded-tl-none border border-black/[0.04] bg-white text-[#1c1c24] dark:border-white/[0.06] dark:bg-[#1a1a1d] dark:text-[#f0f0f4]'
                            )}
                        >
                            <p className="break-words">{msg.text}</p>
                            <span className="mt-1 block text-right text-[9px] opacity-60">{msg.timestamp}</span>
                        </div>
                        {msg.type === 'user' && (
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#19191b] text-white dark:bg-white dark:text-black">
                                <User size={12} />
                            </div>
                        )}
                    </div>
                ))}

                {isTyping && (
                    <div className="flex items-center gap-2 text-xs text-[#777984]">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[#6330cf] dark:bg-[#281b45]">
                            <Sparkles size={12} />
                        </div>
                        <div className="flex gap-1 rounded-full border border-black/[0.05] bg-white px-3 py-2 dark:border-white/[0.06] dark:bg-[#1a1a1d]">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '0ms' }} />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '150ms' }} />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="scrollbar-none shrink-0 overflow-x-auto border-t border-black/[0.04] bg-white px-3 py-2 dark:border-white/[0.05] dark:bg-[#121214]">
                <div className="flex gap-1.5">
                    {quickPrompts.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => handleSendMessage(prompt)}
                            className="shrink-0 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-[11px] font-medium text-[#555660] transition-colors hover:bg-[#edeef2] active:scale-95 dark:bg-white/[0.06] dark:text-[#a0a2af] dark:hover:bg-white/[0.1] lg:px-2.5 lg:py-1 lg:text-[10px]"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    handleSendMessage()
                }}
                className="flex shrink-0 items-center gap-2 border-t border-black/[0.05] bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] dark:border-white/[0.06] dark:bg-[#121214] lg:pb-3"
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Ask Swippable AI..."
                    className="min-w-0 flex-1 rounded-full bg-[#f5f5f7] px-4 py-2.5 outline-none focus:ring-1 focus:ring-[#8553ec] dark:bg-[#1c1c20] dark:text-white dark:placeholder:text-[#6a6c76] lg:py-2 lg:text-xs"
                />
                <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] to-[#8553ec] text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 lg:h-8 lg:w-8"
                    aria-label="Send message"
                >
                    <Send size={15} />
                </button>
            </form>
        </>
    )

    return (
        <>
            <AnimatePresence>
                {isOpen && !isDesktop && (
                    <motion.div
                        key="scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="assistant"
                        role="dialog"
                        aria-modal={!isDesktop}
                        aria-label="Swippable Assistant"
                        drag={isDesktop ? false : 'y'}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.4 }}
                        onDragEnd={handleDragEnd}
                        initial={isDesktop ? { opacity: 0, y: 16, scale: 0.96 } : { y: '100%' }}
                        animate={isDesktop ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
                        exit={isDesktop ? { opacity: 0, y: 16, scale: 0.96 } : { y: '100%' }}
                        transition={
                            isDesktop
                                ? { duration: 0.2, ease: 'easeOut' }
                                : { type: 'spring', stiffness: 380, damping: 38 }
                        }
                        className={cn(
                            'fixed z-[61] flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#121214]',
                            // Phone: a sheet edge-to-edge along the bottom.
                            'inset-x-0 bottom-0 h-[88dvh] max-h-[88dvh] rounded-t-[28px]',
                            // Desktop: the anchored panel above the action button.
                            'lg:inset-x-auto lg:bottom-24 lg:right-6 lg:h-[520px] lg:max-h-[calc(100dvh-9rem)] lg:w-[380px] lg:rounded-[24px] lg:border lg:border-black/[0.08] lg:dark:border-white/[0.1]'
                        )}
                    >
                        {panel}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action button. On a phone it clears the tab dock; the sheet hides
                it while open because the sheet carries its own close control. */}
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className={cn(
                    'fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] via-[#7b46ea] to-[#925FFF] text-white shadow-[0_8px_28px_rgba(99,48,207,0.35)] transition-all hover:scale-105 active:scale-95 lg:right-6',
                    'bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:bottom-6',
                    isOpen && 'pointer-events-none scale-90 opacity-0 lg:pointer-events-auto lg:scale-100 lg:opacity-100'
                )}
                aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    <X size={22} />
                ) : (
                    <>
                        <MessageSquare size={22} />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#19c9a2] text-[9px] font-bold text-white ring-2 ring-[#f5f5f7] dark:ring-[#080808]">
                            ✦
                        </span>
                    </>
                )}
            </button>
        </>
    )
}

interface AccountContext {
    balance?: string
    unallocated?: string
    allocated?: string
    currency: string
    cards: Array<Pick<VirtualCard, 'last4' | 'status' | 'cardSpendingLimit' | 'totalSpentByCard' | 'availableToSpend' | 'utilisation' | 'currency'>>
    transactions: Array<Pick<LedgerTransaction, 'merchant' | 'amount' | 'currency' | 'type' | 'status' | 'createdAt'>>
    spendThisMonth?: string
    incomeThisMonth?: string
    loading: boolean
}

/**
 * Deterministic, data-grounded replies. If a figure has not loaded the
 * assistant says so rather than guessing - it never states a number it cannot
 * read from the account.
 */
function answerFrom(question: string, ctx: AccountContext): string {
    const lower = question.toLowerCase()

    if (ctx.loading) {
        return 'One moment - I am still loading your account data.'
    }

    const money = (value: string | undefined) =>
        value === undefined ? 'unavailable right now' : formatMoney(value, ctx.currency)

    if (lower.includes('balance') || lower.includes('wallet') || lower.includes('how much')) {
        if (ctx.balance === undefined) return 'I could not read your wallet balance just now.'
        return (
            `Your wallet balance is ${money(ctx.balance)}. ` +
            `${money(ctx.allocated)} is allocated to cards and ${money(ctx.unallocated)} is unallocated.`
        )
    }

    if (lower.includes('limit') || lower.includes('spend')) {
        if (ctx.cards.length === 0) {
            return `You have no cards yet, so nothing is allocated. You have spent ${money(ctx.spendThisMonth)} this month.`
        }
        const lines = ctx.cards
            .map(
                (card) =>
                    `•••• ${card.last4}: ${formatMoney(card.totalSpentByCard, card.currency)} of ` +
                    `${formatMoney(card.cardSpendingLimit, card.currency)} used (${Math.round(card.utilisation)}%)`
            )
            .join('; ')
        return `Spend this month: ${money(ctx.spendThisMonth)}. Per card - ${lines}.`
    }

    if (lower.includes('card') || lower.includes('virtual')) {
        if (ctx.cards.length === 0) {
            return 'You have no virtual cards yet. Head to the Cards tab to issue one against your wallet balance.'
        }
        const active = ctx.cards.filter((card) => card.status === 'ACTIVE').length
        const first = ctx.cards[0]
        return (
            `You have ${ctx.cards.length} card${ctx.cards.length === 1 ? '' : 's'} (${active} active). ` +
            `Your most recent is •••• ${first.last4}, ${first.status.toLowerCase()}, with ` +
            `${formatMoney(first.availableToSpend, first.currency)} still available.`
        )
    }

    if (lower.includes('payment') || lower.includes('transaction') || lower.includes('recent')) {
        const latest = ctx.transactions[0]
        if (!latest) return 'You have no transactions yet. Fund your wallet to get started.'
        const direction = latest.type === 'CREDIT' ? 'received' : 'spent'
        return (
            `Your latest transaction: ${formatMoney(latest.amount, latest.currency)} ${direction} ` +
            `at ${latest.merchant} on ${new Date(latest.createdAt).toLocaleDateString()} ` +
            `(${latest.status.toLowerCase()}).`
        )
    }

    if (lower.includes('income') || lower.includes('deposit')) {
        return `You have received ${money(ctx.incomeThisMonth)} this month.`
    }

    return (
        `Your wallet balance is ${money(ctx.balance)} across ${ctx.cards.length} card` +
        `${ctx.cards.length === 1 ? '' : 's'}. Ask me about your balance, cards, spending limits or recent payments.`
    )
}
