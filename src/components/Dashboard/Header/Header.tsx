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
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDismissNotifications, useMarkNotificationsRead, useNotifications } from '@/lib/client-api'

/**
 * Two shapes, one component.
 *
 * From `md` up this is the floating three-island header the desktop dashboard
 * was designed around. Below `md` the islands merge into a single title bar
 * pinned under the status bar, and navigation moves to `MobileTabBar` - a
 * phone should not hide its whole product behind a hamburger, and an installed
 * app has no browser chrome to fall back on.
 */
export function DashboardHeader() {
    const pathname = usePathname()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)

    const notifications = useNotifications()
    const markRead = useMarkNotificationsRead()
    const dismiss = useDismissNotifications()

    const unreadCount = (notifications.data ?? []).filter((item) => !item.read).length

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
        { name: 'Payments', href: '/dashboard/transactions', icon: Banknote, exact: false },
        { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, exact: false },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings, exact: false },
    ]

    const isActive = (href: string, exact: boolean) => {
        if (exact) return pathname === href
        return pathname?.startsWith(href) ?? false
    }

    /** Circular control: bare on the mobile bar, its own floating island on desktop. */
    const controlClass =
        'flex h-10 w-10 items-center justify-center rounded-full text-[#777984] transition-all active:scale-95 dark:text-[#8c8e98] ' +
        'lg:h-12 lg:w-12 lg:border lg:border-black/[0.04] lg:bg-white/90 lg:shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:backdrop-blur-xl lg:hover:scale-105 lg:dark:border-white/[0.08] lg:dark:bg-[#121214]/90'

    return (
        // The top pad is a single calc rather than a safe-area utility next to
        // `pt-2`: two utilities setting padding-top would only fight over the
        // cascade.
        <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-[1440px] px-3 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] transition-all duration-300 sm:px-6 lg:top-5 lg:pt-0 lg:px-8">
            {/* Below md the row itself is the island; from md up it is a bare
                flex track and each child floats on its own. */}
            <div className="flex items-center justify-between gap-2 rounded-[22px] border border-black/[0.05] bg-white/92 px-2 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.08)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#121214]/92 lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none lg:dark:bg-transparent">

                {/* Wordmark */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="min-w-0"
                >
                    <Link
                        href="/dashboard"
                        className={cn(
                            'group flex h-10 items-center gap-2.5 rounded-full px-2 transition-all active:scale-98',
                            'lg:h-12 lg:border lg:border-black/[0.04] lg:bg-white/90 lg:px-4 lg:shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:backdrop-blur-xl lg:hover:scale-102 lg:hover:shadow-[0_6px_28px_rgba(112,66,244,0.18)] lg:dark:border-white/[0.08] lg:dark:bg-[#121214]/90'
                        )}
                        aria-label="Swippable dashboard home"
                    >
                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#6330cf] via-[#7c48ea] to-[#925FFF] shadow-sm">
                            <Image
                                src="/images/logo/logo-mark.svg"
                                alt="Swippable"
                                width={22}
                                height={22}
                                className="h-5 w-5 object-contain brightness-0 invert"
                            />
                        </div>
                        <span className="truncate bg-gradient-to-r from-[#6330cf] via-[#8553ec] to-[#19c9a2] bg-clip-text text-sm font-extrabold tracking-tight text-transparent lg:text-[15px]">
                            Swippable
                        </span>
                    </Link>
                </motion.div>

                {/* Desktop navigation capsule */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="hidden max-w-2xl flex-1 justify-center lg:flex"
                >
                    <nav className="flex items-center gap-1 rounded-full border border-black/[0.04] bg-white/90 p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#121214]/90">
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

                        <button
                            type="button"
                            onClick={openAiAssistant}
                            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[#6330cf] transition-colors hover:bg-[#f0eaff] dark:text-[#c4a8ff] dark:hover:bg-[#281b45]"
                            title="Open Financial Copilot"
                        >
                            <Sparkles size={13} className="text-[#8553ec]" />
                            <span>Assistant</span>
                        </button>
                    </nav>
                </motion.div>

                {/* Controls */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="flex shrink-0 items-center gap-0.5 lg:gap-2.5"
                >
                    <div className="relative hidden h-12 items-center rounded-full border border-black/[0.04] bg-white/90 px-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#121214]/90 xl:flex">
                        <Search className="mr-2 shrink-0 text-[#9a9ca4]" size={14} />
                        <input
                            type="text"
                            aria-label="Search dashboard"
                            placeholder="Search here..."
                            className="w-32 bg-transparent text-xs font-medium text-[#1c1c24] outline-none transition-all placeholder:text-[#9a9ca4] focus:w-48 dark:text-white dark:placeholder:text-[#6a6c76]"
                        />
                    </div>

                    <button
                        type="button"
                        aria-label="Toggle theme"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={cn(controlClass, 'cursor-pointer hover:text-[#6330cf] dark:hover:text-white')}
                    >
                        {mounted && theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    <div className="relative">
                        <button
                            type="button"
                            aria-label="Notifications"
                            onClick={() => setShowNotifications((open) => !open)}
                            className={cn(controlClass, 'cursor-pointer hover:text-[#1c1c24] dark:hover:text-white')}
                        >
                            <Bell size={17} />
                            {unreadCount > 0 && (
                                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef5362] px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#121214] lg:right-2 lg:top-2">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    {/* Tapping anywhere else closes the panel, the way a
                                        native sheet dismisses. */}
                                    <button
                                        type="button"
                                        aria-label="Close notifications"
                                        onClick={() => setShowNotifications(false)}
                                        className="fixed inset-0 z-40 cursor-default lg:hidden"
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1.75rem))] rounded-2xl border border-black/[0.08] bg-white p-4 shadow-2xl backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#121214] sm:w-80"
                                    >
                                        <div className="flex items-center justify-between gap-2 border-b border-black/[0.05] pb-3 dark:border-white/[0.06]">
                                            <h4 className="text-xs font-bold text-[#1c1c24] dark:text-white">
                                                Notifications
                                                {unreadCount > 0 && (
                                                    <span className="ml-1.5 rounded-full bg-[#f0eaff] px-1.5 py-0.5 text-[9px] font-bold text-[#6330cf] dark:bg-[#281b45] dark:text-[#c4a8ff]">
                                                        {unreadCount} new
                                                    </span>
                                                )}
                                            </h4>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => markRead.mutate()}
                                                    disabled={unreadCount === 0}
                                                    className="text-[10px] font-semibold text-[#6330cf] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#c4a8ff]"
                                                >
                                                    Mark all read
                                                </button>
                                                <span className="text-[10px] text-[#d3d4da] dark:text-white/20">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => dismiss.mutate({ scope: 'all' })}
                                                    disabled={(notifications.data ?? []).length === 0}
                                                    className="text-[10px] font-semibold text-[#81858c] transition-colors hover:text-[#ef5362] disabled:cursor-not-allowed disabled:opacity-35"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                        <div className="scrollbar-none scroll-touch mt-2 max-h-[min(16rem,50vh)] space-y-2 overflow-y-auto">
                                            <AnimatePresence initial={false}>
                                                {(notifications.data ?? []).map((item) => (
                                                    <motion.div
                                                        key={item.id}
                                                        layout
                                                        initial={{ opacity: 0, y: -4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, x: 24, height: 0, marginTop: 0 }}
                                                        transition={{ duration: 0.18 }}
                                                        className={cn(
                                                            'group/notif relative rounded-xl p-2.5 transition-colors hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04]',
                                                            !item.read && 'bg-[#f7f4ff] dark:bg-white/[0.05]'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[#1c1c24] dark:text-white">
                                                                {!item.read && (
                                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7042f4]" />
                                                                )}
                                                                <span className="truncate">{item.title}</span>
                                                            </p>
                                                            <span className="shrink-0 text-[9px] text-[#81858c] transition-opacity group-hover/notif:opacity-0">
                                                                {relativeTime(item.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="mt-0.5 text-[11px] text-[#777984] dark:text-[#888a93]">{item.body}</p>

                                                        <button
                                                            type="button"
                                                            onClick={() => dismiss.mutate({ id: item.id })}
                                                            aria-label="Dismiss notification"
                                                            className="absolute right-1.5 top-1.5 rounded-md p-1 text-[#9a9ca4] opacity-0 transition-all hover:bg-black/5 hover:text-[#ef5362] group-hover/notif:opacity-100 dark:hover:bg-white/10"
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {notifications.isLoading && (
                                                <p className="py-6 text-center text-[11px] text-[#81858c]">Loading…</p>
                                            )}

                                            {!notifications.isLoading && (notifications.data ?? []).length === 0 && (
                                                <p className="py-6 text-center text-[11px] text-[#81858c]">
                                                    Nothing yet. Card and deposit activity shows up here.
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-full lg:h-12 lg:w-12 lg:border lg:border-black/[0.04] lg:bg-white/90 lg:shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:backdrop-blur-xl lg:dark:border-white/[0.08] lg:dark:bg-[#121214]/90">
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: 'h-9 w-9 ring-2 ring-white shadow-sm dark:ring-white/10',
                                    userButtonTrigger: 'focus:outline-none focus:ring-2 focus:ring-[#8553ec]'
                                }
                            }}
                        >
                            {/* Settings is not a dock tab, so the account menu is where
                                it lives on a phone. */}
                            <UserButton.MenuItems>
                                <UserButton.Link
                                    label="Swippable settings"
                                    labelIcon={<Settings size={15} />}
                                    href="/dashboard/settings"
                                />
                            </UserButton.MenuItems>
                        </UserButton>
                    </div>
                </motion.div>
            </div>
        </header>
    )
}

/** Compact "2h ago" style stamp for the notification list. */
function relativeTime(iso: string): string {
    const deltaMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(deltaMs / 60000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    return `${days}d ago`
}
