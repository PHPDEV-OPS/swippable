'use client'

import { useAuth } from '@clerk/nextjs'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeftRight,
    CreditCard,
    FlaskConical,
    Gauge,
    Menu,
    ScrollText,
    ShieldAlert,
    Users,
    X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BrandLoader from '@/components/Common/BrandLoader'
import { useAdminSession, useKillSwitch } from '@/lib/admin-client'
import { cn } from '@/lib/utils'
import { RAIL_LABELS } from '@/types/admin'
import { CommandHeader } from './CommandHeader'
import { Pill, TimeAgo } from './primitives'

const NAV = [
    { href: '/admin', label: 'Command center', icon: Gauge, exact: true },
    { href: '/admin/users', label: 'Users', icon: Users, exact: false },
    { href: '/admin/transactions', label: 'Transaction rails', icon: ArrowLeftRight, exact: false },
    { href: '/admin/cards', label: 'Card lifecycle', icon: CreditCard, exact: false },
    { href: '/admin/simulator', label: 'Simulation lab', icon: FlaskConical, exact: false },
    { href: '/admin/audit', label: 'Audit trail', icon: ScrollText, exact: false },
]

/**
 * The command center shell.
 *
 * Two things are load-bearing here beyond layout:
 *
 *  1. Access. `useAdminSession` hits a route that answers 404 for anyone who
 *     is not a founder, so a non-admin never sees the chrome, let alone the
 *     data. Every API route repeats the check server-side - this is UX, not
 *     the security boundary.
 *
 *  2. The halted state. When the kill switch is engaged the whole surface
 *     repaints: a red band pins to the top, the rail's accent turns red, and
 *     the content gets a red ring. Halting the platform should be impossible
 *     to forget you did.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useAuth()
    const session = useAdminSession()
    const killSwitch = useKillSwitch()
    const pathname = usePathname()
    const router = useRouter()
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.replace('/sign-in')
    }, [isLoaded, isSignedIn, router])

    useEffect(() => setMobileOpen(false), [pathname])

    if (!isLoaded || session.isLoading) {
        return <BrandLoader label="Verifying superadmin access" />
    }

    if (!isSignedIn) return null

    if (session.isError || !session.data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0d0d11] px-6">
                <div className="max-w-sm text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e0293c]/15 text-[#ff7a87]">
                        <ShieldAlert size={22} />
                    </div>
                    <h1 className="text-lg font-extrabold text-white">Not available</h1>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[#8a8d96]">
                        This account does not have superadmin access. If you reached this by mistake, head back to your
                        dashboard.
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-5 inline-flex rounded-full bg-gradient-to-r from-[#6330cf] to-[#925FFF] px-5 py-2.5 text-[13px] font-bold text-white"
                    >
                        Go to dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const halted = killSwitch.data?.haltedRails ?? []
    const isHalted = halted.length > 0
    const fullyHalted = Boolean(killSwitch.data?.engaged)

    return (
        <div className={cn('min-h-screen bg-[#f5f5f7] transition-colors dark:bg-[#08080a]')}>
            {/* Platform-halted band. Pinned above everything, impossible to miss. */}
            <AnimatePresence>
                {isHalted && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="sticky top-0 z-50 overflow-hidden bg-[#e0293c] text-white"
                    >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
                            <ShieldAlert size={15} className="shrink-0 animate-pulse" />
                            <span className="text-[12.5px] font-black uppercase tracking-[0.08em]">
                                {fullyHalted ? 'Platform halted' : `${halted.length} rail${halted.length > 1 ? 's' : ''} halted`}
                            </span>
                            <span className="text-[12.5px] font-medium text-white/85">
                                {fullyHalted
                                    ? 'Minting, deposits and card authorisations are all refused.'
                                    : halted.map((rail) => RAIL_LABELS[rail]).join(' · ')}
                            </span>
                            {killSwitch.data?.reason && (
                                <span className="text-[12.5px] italic text-white/75">“{killSwitch.data.reason}”</span>
                            )}
                            <span className="ml-auto text-[11.5px] font-semibold text-white/70">
                                {killSwitch.data?.engagedBy} · <TimeAgo iso={killSwitch.data?.engagedAt ?? null} />
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex">
                {/* Dark rail. Fixed on desktop, a drawer below lg. */}
                <aside
                    className={cn(
                        'fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col bg-[#0d0d11] transition-transform duration-300',
                        'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
                        mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    )}
                >
                    <div className="flex h-16 items-center justify-between px-5">
                        <Link href="/admin" className="flex items-center gap-2.5">
                            <span
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-tr transition-colors',
                                    isHalted ? 'from-[#e0293c] to-[#ff6b7a]' : 'from-[#6330cf] to-[#925FFF]'
                                )}
                            >
                                <Image
                                    src="/images/logo/logo-mark.svg"
                                    alt="Swippable"
                                    width={20}
                                    height={20}
                                    className="h-4.5 w-4.5 object-contain brightness-0 invert"
                                />
                            </span>
                            <span className="text-[15px] font-extrabold tracking-tight text-white">Swippable</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            className="cursor-pointer text-[#7c7f88] lg:hidden"
                            aria-label="Close navigation"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="px-5 pb-4">
                        <Pill tone={isHalted ? 'danger' : 'brand'} className="w-full justify-center">
                            {isHalted ? 'Halted' : 'Superadmin'}
                        </Pill>
                    </div>

                    <nav className="flex-1 space-y-1 overflow-y-auto px-3">
                        {NAV.map((item) => {
                            const Icon = item.icon
                            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href)
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold transition-all',
                                        active
                                            ? isHalted
                                                ? 'bg-[#e0293c]/15 text-white'
                                                : 'bg-white/[0.08] text-white'
                                            : 'text-[#7c7f88] hover:bg-white/[0.04] hover:text-[#d5d6db]'
                                    )}
                                >
                                    <Icon size={16} strokeWidth={2.1} />
                                    {item.label}
                                    {active && (
                                        <span
                                            className={cn(
                                                'ml-auto h-1.5 w-1.5 rounded-full',
                                                isHalted ? 'bg-[#ff7a87]' : 'bg-[#925FFF]'
                                            )}
                                        />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>

                    <div className="border-t border-white/[0.07] p-4">
                        <p className="truncate text-[13px] font-bold text-white">{session.data.name}</p>
                        <p className="truncate text-[11.5px] text-[#7c7f88]">{session.data.email}</p>
                        <Link
                            href="/dashboard"
                            className="mt-3 block rounded-xl border border-white/[0.09] px-3 py-2 text-center text-[12px] font-bold text-[#b9bbc2] transition-colors hover:bg-white/[0.05]"
                        >
                            Back to user app
                        </Link>
                    </div>
                </aside>

                {mobileOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobileOpen(false)}
                    />
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="absolute left-4 top-1/2 z-50 -translate-y-1/2 cursor-pointer text-[#b9bbc2] lg:hidden"
                            aria-label="Open navigation"
                            style={{ marginTop: 0 }}
                        >
                            <Menu size={20} />
                        </button>
                        <div className="lg:pl-0 [&>header]:pl-14 lg:[&>header]:pl-0">
                            <CommandHeader />
                        </div>
                    </div>

                    <main
                        className={cn(
                            'min-w-0 flex-1 p-4 transition-all sm:p-6',
                            isHalted && 'ring-2 ring-inset ring-[#e0293c]/25'
                        )}
                    >
                        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    )
}
