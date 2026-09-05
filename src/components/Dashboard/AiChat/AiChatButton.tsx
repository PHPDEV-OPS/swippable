'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles, X, Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
    id: string | number
    type: 'bot' | 'user'
    text: string
    timestamp: string
}

export function AiChatButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [inputText, setInputText] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            type: 'bot',
            text: "Hello! I'm Swippable Agent Assistant. I can help you monitor transactions, check your virtual card balances, and track spending.",
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

    const quickPrompts = [
        'Check card balance',
        'Recent payments',
        'Create virtual card',
        'Spending limit status'
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

        // Realistic Swippable Agent responses
        setTimeout(() => {
            const lower = text.toLowerCase()
            let botReply = "I'm monitoring your Swippable account. You can manage your cards, send payments, or review spending limits anytime!"

            if (lower.includes('balance')) {
                botReply = 'Your current Total Balance is $9,810.00 USD across your active Swippable virtual cards.'
            } else if (lower.includes('card') || lower.includes('virtual')) {
                botReply = 'Your Swippable Virtual Card (•••• 3456) is Active with $4,850.00 remaining under your monthly limit. You can generate a new card in the Cards tab.'
            } else if (lower.includes('payment') || lower.includes('transaction') || lower.includes('recent')) {
                botReply = 'Your last transaction was an External Payment of +$250.00 via VISA on 02-12-24.'
            } else if (lower.includes('limit') || lower.includes('spend')) {
                botReply = 'You have utilized 3% of your $5,000 monthly spending limit. Healthcare and Education savings are on track!'
            }

            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    type: 'bot',
                    text: botReply,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ])
            setIsTyping(false)
        }, 800)
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="mb-4 flex h-[500px] w-[350px] sm:w-[380px] flex-col overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-2xl dark:border-white/[0.1] dark:bg-[#121214]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-black/[0.05] bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-5 py-4 text-white dark:border-white/[0.08]">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                                    <Bot size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight">Swippable Assistant</h3>
                                    <p className="text-[10px] text-white/80 font-medium">AI Financial Copilot</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                                aria-label="Close Assistant"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Messages Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafc] dark:bg-[#0d0d0f] scrollbar-none">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        'flex gap-2 text-xs',
                                        msg.type === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    {msg.type === 'bot' && (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[#6330cf] dark:bg-[#281b45] dark:text-[#c4a8ff] mt-0.5">
                                            <Sparkles size={12} />
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            'max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed',
                                            msg.type === 'user'
                                                ? 'bg-[#6330cf] text-white rounded-tr-none'
                                                : 'bg-white text-[#1c1c24] border border-black/[0.04] dark:bg-[#1a1a1d] dark:border-white/[0.06] dark:text-[#f0f0f4] rounded-tl-none'
                                        )}
                                    >
                                        <p>{msg.text}</p>
                                        <span className="block mt-1 text-[9px] opacity-60 text-right">
                                            {msg.timestamp}
                                        </span>
                                    </div>
                                    {msg.type === 'user' && (
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#19191b] text-white dark:bg-white dark:text-black mt-0.5">
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
                                    <div className="flex gap-1 rounded-full bg-white px-3 py-2 border border-black/[0.05] dark:bg-[#1a1a1d] dark:border-white/[0.06]">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '0ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '150ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8553ec]" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Prompts */}
                        <div className="flex gap-1.5 overflow-x-auto px-3 py-2 bg-white dark:bg-[#121214] border-t border-black/[0.04] dark:border-white/[0.05] scrollbar-none">
                            {quickPrompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => handleSendMessage(prompt)}
                                    className="shrink-0 rounded-full bg-[#f5f5f7] hover:bg-[#edeef2] px-2.5 py-1 text-[10px] font-medium text-[#555660] transition-colors dark:bg-white/[0.06] dark:text-[#a0a2af] dark:hover:bg-white/[0.1]"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* Input Area */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                handleSendMessage()
                            }}
                            className="flex items-center gap-2 border-t border-black/[0.05] bg-white p-3 dark:border-white/[0.06] dark:bg-[#121214]"
                        >
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Ask Swippable AI..."
                                className="flex-1 rounded-full bg-[#f5f5f7] px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#8553ec] dark:bg-[#1c1c20] dark:text-white dark:placeholder:text-[#6a6c76]"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] to-[#8553ec] text-white shadow-md disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
                                aria-label="Send message"
                            >
                                <Send size={13} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] via-[#7b46ea] to-[#925FFF] text-white shadow-[0_8px_28px_rgba(99,48,207,0.35)] transition-all hover:scale-105 active:scale-95"
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? (
                    <X size={22} />
                ) : (
                    <>
                        <MessageSquare size={22} className="transition-transform group-hover:scale-110" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#19c9a2] ring-2 ring-white text-[9px] font-bold text-white dark:ring-[#080808]">
                            ✦
                        </span>
                    </>
                )}
            </button>
        </div>
    )
}
