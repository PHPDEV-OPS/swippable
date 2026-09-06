'use client'

import { UserButton } from '@clerk/nextjs'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowRight,
    Bitcoin,
    CreditCard,
    Loader2,
    Moon,
    Power,
    Receipt,
    Search,
    ShieldAlert,
    Smartphone,
    Sun,
    User,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useKillSwitch, useOmnibar, useSetKillSwitch } from '@/lib/admin-client'
import { cn } from '@/lib/utils'
import { PLATFORM_RAILS, RAIL_LABELS, type OmnibarKind } from '@/types/admin'
import { Button, OverrideDialog, Pill } from './primitives'

/* ------------------------------------------------------------- omnibar */

const KIND_ICONS: Record<OmnibarKind, React.ElementType> = {
    USER: User,
    CARD: CreditCard,
    MPESA: Smartphone,
    CRYPTO: Bitcoin,
    TRANSACTION: Receipt,
    UNKNOWN: Search,
}

/**
 * One field for every identifier an incident hands you.
 *
 * The founder chasing a failed payment has a Clerk id, an M-Pesa receipt, a
 * 0x hash or four digits off the back of a card - and no interest in picking a
 * search mode first. The server infers the type from the shape of the string
 * and says what it decided, so a wrong guess is visible rather than silent.
 */
function Omnibar() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [debounced, setDebounced] = useState('')
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const results = useOmnibar(debounced)

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query), 220)
        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
        }
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                inputRef.current?.focus()
                setOpen(true)
            }
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    const items = results.data?.results ?? []

    return (
        <div ref={containerRef} className="relative w-full max-w-xl">
            <div
                className={cn(
                    'flex h-11 items-center gap-2.5 rounded-full border px-4 transition-all',
                    'border-white/[0.09] bg-white/[0.05] focus-within:border-[#925FFF]/60 focus-within:bg-white/[0.08]'
                )}
            >
                <Search size={15} className="shrink-0 text-[#7c7f88]" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setOpen(true)
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="User ID, M-Pesa ref, 0x hash, or last 4 digits…"
                    className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-[#6e7079]"
                    aria-label="Search users, transactions and cards"
                />
                {results.isFetching && <Loader2 size={13} className="animate-spin text-[#7c7f88]" />}
                <kbd className="hidden shrink-0 rounded-md border border-white/[0.12] px-1.5 py-0.5 font-sans text-[10px] font-bold text-[#7c7f88] sm:block">
                    ⌘K
                </kbd>
            </div>

            <AnimatePresence>
                {open && debounced.trim().length >= 2 && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="absolute left-0 right-0 top-[52px] z-50 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-2xl dark:border-white/[0.09] dark:bg-[#131315]"
                    >
                        <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-2.5 dark:border-white/[0.07]">
                            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                Parsed as
                            </span>
                            <Pill tone="brand">{results.data?.detected ?? 'Detecting…'}</Pill>
                        </div>

                        {items.length === 0 ? (
                            <p className="px-4 py-6 text-center text-[13px] text-[#81858c]">
                                {results.isFetching ? 'Searching every rail…' : 'Nothing matched that identifier.'}
                            </p>
                        ) : (
                            <ul className="max-h-[340px] overflow-y-auto py-1">
                                {items.map((item, index) => {
                                    const Icon = KIND_ICONS[item.kind]
                                    return (
                                        <li key={`${item.href}-${index}`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpen(false)
                                                    setQuery('')
                                                    router.push(item.href)
                                                }}
                                                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f7f7f9] dark:hover:bg-white/[0.05]"
                                            >
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]">
                                                    <Icon size={14} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[13.5px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                        {item.title}
                                                    </span>
                                                    <span className="block truncate text-[12px] text-[#81858c]">
                                                        {item.subtitle}
                                                    </span>
                                                </span>
                                                {item.badge && <Pill tone="neutral">{item.badge}</Pill>}
                                                <ArrowRight size={13} className="shrink-0 text-[#a8aab1]" />
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* --------------------------------------------------------- kill switch */

/**
 * The global halt.
 *
 * Engaging it is the single most consequential action in the product, so it is
 * deliberately awkward: a reason is required, the confirmation is destructive-
 * styled, and the whole shell repaints red afterwards (see `AdminShell`) so
 * nobody can forget the platform is down. Releasing it takes the same dialog.
 */
function KillSwitchControl() {
    const killSwitch = useKillSwitch()
    const mutate = useSetKillSwitch()
    const [dialog, setDialog] = useState<null | { engage: boolean }>(null)
    const [railMenu, setRailMenu] = useState(false)
    const [pendingRail, setPendingRail] = useState<null | { rail: (typeof PLATFORM_RAILS)[number]; halt: boolean }>(null)

    const state = killSwitch.data
    const engaged = (state?.haltedRails.length ?? 0) > 0
    const fullyEngaged = Boolean(state?.engaged)

    return (
        <>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setRailMenu((value) => !value)}
                        className="hidden h-11 cursor-pointer items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.05] px-3.5 text-[12.5px] font-bold text-[#b9bbc2] transition-colors hover:bg-white/[0.09] lg:flex"
                        aria-label="Rail controls"
                    >
                        <ShieldAlert size={14} />
                        Rails
                        {engaged && !fullyEngaged && (
                            <span className="rounded-full bg-[#e0293c] px-1.5 text-[10px] font-black text-white">
                                {state?.haltedRails.length}
                            </span>
                        )}
                    </button>

                    <AnimatePresence>
                        {railMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.14 }}
                                className="absolute right-0 top-[52px] z-50 w-[300px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-2xl dark:border-white/[0.09] dark:bg-[#131315]"
                            >
                                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                    Individual rails
                                </p>
                                {PLATFORM_RAILS.map((rail) => {
                                    const halted = state?.haltedRails.includes(rail)
                                    return (
                                        <button
                                            key={rail}
                                            type="button"
                                            disabled={fullyEngaged}
                                            onClick={() => {
                                                setRailMenu(false)
                                                setPendingRail({ rail, halt: !halted })
                                            }}
                                            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#f7f7f9] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.05]"
                                        >
                                            <span className="text-[13px] font-semibold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                {RAIL_LABELS[rail]}
                                            </span>
                                            <Pill tone={halted ? 'danger' : 'success'}>
                                                {halted ? 'Halted' : 'Open'}
                                            </Pill>
                                        </button>
                                    )
                                })}
                                {fullyEngaged && (
                                    <p className="px-3 py-2 text-[11.5px] leading-relaxed text-[#81858c]">
                                        The global switch is engaged, so every rail is already halted. Release it to
                                        control rails individually.
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <button
                    type="button"
                    onClick={() => setDialog({ engage: !fullyEngaged })}
                    disabled={killSwitch.isLoading}
                    className={cn(
                        'group flex h-11 cursor-pointer items-center gap-2.5 rounded-full px-4 text-[12.5px] font-black uppercase tracking-[0.06em] transition-all',
                        fullyEngaged
                            ? 'bg-[#e0293c] text-white shadow-[0_0_0_4px_rgba(224,41,60,0.22)] hover:bg-[#c81f30]'
                            : 'border border-[#e0293c]/35 bg-[#e0293c]/10 text-[#ff7a87] hover:bg-[#e0293c]/20'
                    )}
                >
                    <Power size={15} className={fullyEngaged ? 'animate-pulse' : ''} />
                    <span className="hidden sm:inline">{fullyEngaged ? 'Platform halted' : 'Kill switch'}</span>
                </button>
            </div>

            <OverrideDialog
                open={Boolean(dialog)}
                onClose={() => setDialog(null)}
                destructive={dialog?.engage}
                title={dialog?.engage ? 'Halt the entire platform' : 'Release the kill switch'}
                description={
                    dialog?.engage
                        ? 'Card minting, both deposit rails and every card authorisation stop immediately, for every user. In-flight requests are refused with a 503.'
                        : 'All four rails resume on the next request. Any deposits that failed while halted are not retried automatically.'
                }
                confirmLabel={dialog?.engage ? 'Halt everything' : 'Resume the platform'}
                loading={mutate.isPending}
                error={mutate.error ? (mutate.error as Error).message : null}
                reasonPlaceholder={
                    dialog?.engage ? 'e.g. Issuer settlement pool drained — pausing while we top up' : 'e.g. Float restored, incident closed'
                }
                onConfirm={(reason) =>
                    mutate.mutate(
                        { engaged: dialog?.engage, reason },
                        { onSuccess: () => setDialog(null) }
                    )
                }
            />

            <OverrideDialog
                open={Boolean(pendingRail)}
                onClose={() => setPendingRail(null)}
                destructive={pendingRail?.halt}
                title={`${pendingRail?.halt ? 'Halt' : 'Resume'} ${pendingRail ? RAIL_LABELS[pendingRail.rail] : ''}`}
                description={
                    pendingRail?.halt
                        ? 'This single rail stops for every user. The other three keep running.'
                        : 'This rail starts accepting traffic again on the next request.'
                }
                confirmLabel={pendingRail?.halt ? 'Halt this rail' : 'Resume this rail'}
                loading={mutate.isPending}
                error={mutate.error ? (mutate.error as Error).message : null}
                onConfirm={(reason) =>
                    pendingRail &&
                    mutate.mutate(
                        { rail: pendingRail.rail, halted: pendingRail.halt, reason },
                        { onSuccess: () => setPendingRail(null) }
                    )
                }
            />
        </>
    )
}

/* --------------------------------------------------------------- header */

export function CommandHeader() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    return (
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0d0d11]/95 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
                <Link href="/admin" className="flex shrink-0 items-center gap-2.5 lg:hidden">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[#6330cf] to-[#925FFF] text-[13px] font-black text-white">
                        S
                    </span>
                </Link>

                <Omnibar />

                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="hidden h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.05] text-[#b9bbc2] transition-colors hover:bg-white/[0.09] sm:flex"
                        aria-label="Toggle theme"
                    >
                        {mounted && theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    </button>

                    <KillSwitchControl />

                    <div className="ml-1 flex h-11 items-center rounded-full border border-white/[0.09] bg-white/[0.05] pl-1 pr-1">
                        <UserButton appearance={{ elements: { avatarBox: { width: 34, height: 34 } } }} />
                    </div>
                </div>
            </div>
        </header>
    )
}

export { Button }
