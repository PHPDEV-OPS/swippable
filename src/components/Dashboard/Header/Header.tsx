'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bell,
    CreditCard,
    Home,
    Moon,
    Search,
    Sun,
    Wallet,
    Banknote,
    Sparkles,
    BarChart3,
    Settings,
    Menu,
    X,
    Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function DashboardHeader() {
    const pathname = usePathname()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [notificationsRead, setNotificationsRead] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const openAiAssistant = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('toggle-ai-chat'))
        }
    }

    const navItems = [
        { name: 'Home', href: '/dashboard', icon: Home, exact: true },
        { name: 'Wallet', href: '/dashboard/wallet', icon: Wallet, exact: false },
        { name: 'Cards', href: '/dashboard/cards', icon: CreditCard, exact: false },
        { name: 'Payment', href: '/dashboard/transactions', icon: Banknote, exact: false },
        { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, exact: false },
        { name: 'Setting', href: '/dashboard/settings', icon: Settings, exact: false },
    ]

    const notificationsList = [
        { id: 1, title: 'Card Approved', desc: 'Virtual Card •••• 3456 is now active.', time: '10m ago' },
        { id: 2, title: 'Payment Received', desc: '+$250.00 from External Account.', time: '2h ago' },
        { id: 3, title: 'Security Alert', desc: 'New login detected from Chrome on Windows.', time: '1d ago' },
    ]

    const isActive = (href: string, exact: boolean) => {
        if (exact) return pathname === href
        return pathname?.startsWith(href) ?? false
    }

    return (
        <header className="fixed top-3 sm:top-5 inset-x-0 z-40 mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8 pointer-events-none transition-all duration-300">
            <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">

                {/* Left Floating Island: Swippable Logo Pill */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="pointer-events-auto"
                >
                    <Link
                        href="/dashboard"
                        className="group flex h-11 sm:h-12 items-center gap-2.5 rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl px-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08] transition-all hover:scale-102 hover:shadow-[0_6px_28px_rgba(112,66,244,0.18)] active:scale-98"
                        aria-label="Swippable dashboard home"
                    >
                        <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#6330cf] via-[#7c48ea] to-[#925FFF] shadow-sm">
                            <Image
                                src="/images/logo/logo.svg"
                                alt="Swippable"
                                width={22}
                                height={22}
                                className="h-5 w-5 object-contain brightness-0 invert"
                            />
                        </div>
                        <span className="text-sm sm:text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-[#6330cf] via-[#8553ec] to-[#19c9a2] bg-clip-text text-transparent">
                            Swippable
                        </span>
                    </Link>
                </motion.div>

                {/* Center Floating Island: Navigation Capsule */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="pointer-events-auto hidden md:flex flex-1 justify-center max-w-2xl"
                >
                    <nav className="flex items-center gap-1 rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08]">
                        {navItems.map((item) => {
                            const active = isActive(item.href, item.exact)
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200',
                                        active
                                            ? 'bg-[#19191b] text-white shadow-sm dark:bg-white dark:text-black'
                                            : 'text-[#777984] hover:bg-[#f5f5f7] hover:text-[#1c1c24] dark:text-[#888a93] dark:hover:bg-white/[0.06] dark:hover:text-white'
                                    )}
                                >
                                    <Icon size={14} strokeWidth={2} />
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}

                        {/* Agent Assistant Button inside the floating nav */}
                        <button
                            type="button"
                            onClick={openAiAssistant}
                            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[#6330cf] hover:bg-[#f0eaff] transition-colors dark:text-[#c4a8ff] dark:hover:bg-[#281b45] cursor-pointer"
                            title="Open Financial Copilot"
                        >
                            <Sparkles size={13} className="text-[#8553ec] animate-pulse" />
                            <span>Assistant</span>
                        </button>
                    </nav>
                </motion.div>

                {/* Right Floating Cluster: Search, Theme Toggle, Bell, Clerk Account */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="pointer-events-auto flex items-center gap-2 sm:gap-2.5"
                >
                    {/* Floating Search Pill */}
                    <div className="relative hidden xl:flex h-11 sm:h-12 items-center rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl px-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08]">
                        <Search className="text-[#9a9ca4] mr-2 shrink-0" size={14} />
                        <input
                            type="text"
                            aria-label="Search dashboard"
                            placeholder="Search here..."
                            className="w-32 bg-transparent text-xs font-medium text-[#1c1c24] outline-none transition-all placeholder:text-[#9a9ca4] focus:w-48 dark:text-white dark:placeholder:text-[#6a6c76]"
                        />
                    </div>

                    {/* Floating Theme Toggle Circle */}
                    <button
                        type="button"
                        aria-label="Toggle theme"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl text-[#777984] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08] transition-all hover:scale-105 active:scale-95 hover:text-[#6330cf] dark:text-[#8c8e98] dark:hover:text-white cursor-pointer"
                    >
                        {mounted && theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    {/* Floating Notifications Circle with Dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            aria-label="Notifications"
                            onClick={() => {
                                setShowNotifications(!showNotifications)
                                setNotificationsRead(true)
                            }}
                            className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl text-[#777984] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08] transition-all hover:scale-105 active:scale-95 hover:text-[#1c1c24] dark:text-[#8c8e98] dark:hover:text-white cursor-pointer"
                        >
                            <Bell size={17} />
                            {!notificationsRead && (
                                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#ef5362] ring-2 ring-white dark:ring-[#121214]" />
                            )}
                        </button>

                        {/* Notifications Dropdown Panel */}
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#121214]"
                                >
                                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
                                        <h4 className="text-xs font-bold text-[#1c1c24] dark:text-white">Notifications</h4>
                                        <span className="text-[10px] text-[#6330cf] dark:text-[#c4a8ff] font-semibold cursor-pointer">Mark all read</span>
                                    </div>
                                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto scrollbar-none">
                                        {notificationsList.map((n) => (
                                            <div key={n.id} className="p-2.5 rounded-xl hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs font-bold text-[#1c1c24] dark:text-white">{n.title}</p>
                                                    <span className="text-[9px] text-[#81858c]">{n.time}</span>
                                                </div>
                                                <p className="text-[11px] text-[#777984] dark:text-[#888a93] mt-0.5">{n.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Floating Clerk UserButton Capsule */}
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08]">
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: 'h-9 w-9 ring-2 ring-white shadow-sm dark:ring-white/10',
                                    userButtonTrigger: 'focus:outline-none focus:ring-2 focus:ring-[#8553ec]'
                                }
                            }}
                        />
                    </div>

                    {/* Mobile Hamburger Toggle Circle */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 dark:bg-[#121214]/90 backdrop-blur-xl text-[#777984] shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-black/[0.04] dark:border-white/[0.08] md:hidden cursor-pointer dark:text-white"
                        aria-label="Toggle navigation menu"
                    >
                        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </motion.div>
            </div>

            {/* Mobile Navigation Dropdown Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto mt-3 rounded-3xl border border-black/[0.08] bg-white/95 p-4 shadow-2xl backdrop-blur-2xl md:hidden dark:border-white/[0.1] dark:bg-[#121214]/95"
                    >
                        <nav className="flex flex-col gap-1.5">
                            {navItems.map((item) => {
                                const active = isActive(item.href, item.exact)
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                                            active
                                                ? 'bg-[#19191b] text-white dark:bg-white dark:text-black shadow-sm'
                                                : 'text-[#777984] hover:bg-black/5 dark:text-[#888a93] dark:hover:bg-white/5'
                                        )}
                                    >
                                        <Icon size={18} />
                                        <span>{item.name}</span>
                                    </Link>
                                )
                            })}
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileMenuOpen(false)
                                    openAiAssistant()
                                }}
                                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-[#6330cf] bg-[#f0eaff] dark:bg-[#281b45] dark:text-[#c4a8ff]"
                            >
                                <Sparkles size={18} />
                                <span>Assistant</span>
                            </button>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    )
}