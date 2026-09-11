'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { BarChart3, Banknote, CreditCard, Home, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The phone-shaped counterpart to the desktop navigation capsule.
 *
 * On a phone a hamburger that hides the whole product behind one tap is a
 * website pattern; a dock keeps every destination a thumb-reach away, which is
 * what makes an installed Swippable feel like a banking app rather than a page.
 * It borrows the same floating-island language as the desktop header - white
 * blur, hairline border, deep soft shadow - so the two read as one system.
 */

const TABS = [
    { name: 'Home', href: '/dashboard', icon: Home, exact: true },
    { name: 'Wallet', href: '/dashboard/wallet', icon: Wallet, exact: false },
    { name: 'Cards', href: '/dashboard/cards', icon: CreditCard, exact: false },
    { name: 'Payments', href: '/dashboard/transactions', icon: Banknote, exact: false },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, exact: false },
]

export function MobileTabBar() {
    const pathname = usePathname()

    const isActive = (href: string, exact: boolean) =>
        exact ? pathname === href : (pathname?.startsWith(href) ?? false)

    return (
        <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] lg:hidden"
        >
            <div className="flex items-stretch gap-0.5 rounded-[26px] border border-black/[0.05] bg-white/92 p-1.5 shadow-[0_-2px_10px_rgba(0,0,0,0.04),0_12px_34px_rgba(0,0,0,0.14)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#121214]/92">
                {TABS.map((tab) => {
                    const active = isActive(tab.href, tab.exact)
                    const Icon = tab.icon
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            aria-current={active ? 'page' : undefined}
                            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 transition-colors"
                        >
                            {active && (
                                <motion.span
                                    layoutId="dock-active"
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                    className="absolute inset-0 rounded-[20px] bg-[#f2edff] dark:bg-[#241a3d]"
                                />
                            )}
                            <Icon
                                size={19}
                                strokeWidth={active ? 2.4 : 1.9}
                                className={cn(
                                    'relative z-10 transition-colors',
                                    active ? 'text-[#6330cf] dark:text-[#c4a8ff]' : 'text-[#8b8d97]'
                                )}
                            />
                            <span
                                className={cn(
                                    'relative z-10 w-full truncate text-center text-[10px] font-bold leading-none transition-colors',
                                    active ? 'text-[#6330cf] dark:text-[#c4a8ff]' : 'text-[#8b8d97]'
                                )}
                            >
                                {tab.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
