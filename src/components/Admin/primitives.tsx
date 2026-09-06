'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The command center's shared vocabulary.
 *
 * Two rules run through every piece here and are worth stating once:
 *
 *  - Destructive weight is reserved. Purple is the brand and marks anything
 *    routine; red is spent only on things that halt money or restrict a real
 *    person, so a red control on screen always means the same thing.
 *  - No override is one click. `OverrideDialog` is the only way an action
 *    reaches the API, and it will not submit without a typed reason, because
 *    the reason is what the audit log is actually for.
 */

/* ------------------------------------------------------------- surfaces */

export function Panel({
    title,
    subtitle,
    action,
    children,
    className,
    bodyClassName,
}: {
    title?: string
    subtitle?: string
    action?: React.ReactNode
    children: React.ReactNode
    className?: string
    bodyClassName?: string
}) {
    return (
        <section
            className={cn(
                'rounded-[22px] border border-black/[0.05] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)]',
                'dark:border-white/[0.07] dark:bg-[#121214] dark:shadow-none',
                className
            )}
        >
            {(title || action) && (
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.07]">
                    <div className="min-w-0">
                        {title && (
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#81858c]">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="mt-1 text-[13px] text-[#4a4d55] dark:text-[#9a9ca4]">{subtitle}</p>
                        )}
                    </div>
                    {action}
                </header>
            )}
            <div className={cn('p-5', bodyClassName)}>{children}</div>
        </section>
    )
}

/* ---------------------------------------------------------------- pills */

const TONES = {
    neutral: 'bg-[#f2f2f4] text-[#4a4d55] dark:bg-white/[0.07] dark:text-[#b9bbc2]',
    brand: 'bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]',
    success: 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]',
    warning: 'bg-[#fff4e5] text-[#b06f00] dark:bg-[#3a2a08] dark:text-[#ffb84d]',
    danger: 'bg-[#ffebeb] text-[#d13849] dark:bg-[#3c151a] dark:text-[#ff7a87]',
} as const

export type Tone = keyof typeof TONES

export function Pill({
    children,
    tone = 'neutral',
    className,
}: {
    children: React.ReactNode
    tone?: Tone
    className?: string
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap',
                TONES[tone],
                className
            )}
        >
            {children}
        </span>
    )
}

/** The status vocabulary is shared, so a status always reads the same colour. */
export function toneForStatus(status: string): Tone {
    const value = status.toUpperCase()
    if (['ACTIVE', 'SUCCESS', 'SETTLED', 'VERIFIED', 'APPROVED', 'PASS'].includes(value)) return 'success'
    if (['PENDING', 'PAUSED', 'FROZEN', 'WARNING'].includes(value)) return 'warning'
    if (['FAILED', 'BANNED', 'DECLINED', 'REJECTED', 'CLOSED', 'CRITICAL', 'FAIL'].includes(value)) return 'danger'
    return 'neutral'
}

export function StatusPill({ status }: { status: string }) {
    const tone = toneForStatus(status)
    return (
        <Pill tone={tone}>
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    tone === 'success'
                        ? 'bg-[#12b88f]'
                        : tone === 'warning'
                          ? 'bg-[#f5a524]'
                          : tone === 'danger'
                            ? 'bg-[#ef5362]'
                            : 'bg-[#9a9ca4]'
                )}
            />
            {status}
        </Pill>
    )
}

/* -------------------------------------------------------------- buttons */

const BUTTON_VARIANTS = {
    primary:
        'bg-gradient-to-r from-[#6330cf] to-[#925FFF] text-white shadow-[0_4px_14px_rgba(99,48,207,0.28)] hover:brightness-110',
    danger: 'bg-[#e0293c] text-white shadow-[0_4px_14px_rgba(224,41,60,0.25)] hover:bg-[#c81f30]',
    ghost:
        'bg-white text-[#1c1c24] border border-black/[0.08] hover:bg-[#f7f7f9] dark:bg-white/[0.05] dark:text-[#e4e5eb] dark:border-white/[0.1] dark:hover:bg-white/[0.09]',
    dark: 'bg-[#19191b] text-white hover:bg-[#2a2a2e] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-[#e7e7ea]',
} as const

export function Button({
    variant = 'ghost',
    loading,
    className,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof BUTTON_VARIANTS
    loading?: boolean
}) {
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition-all',
                'disabled:cursor-not-allowed disabled:opacity-50',
                BUTTON_VARIANTS[variant],
                className
            )}
        >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {children}
        </button>
    )
}

/* --------------------------------------------------------------- inputs */

export function Field({
    label,
    hint,
    children,
    className,
}: {
    label: string
    hint?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <label className={cn('block', className)}>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                {label}
            </span>
            {children}
            {hint && <span className="mt-1.5 block text-[11.5px] text-[#9a9ca4]">{hint}</span>}
        </label>
    )
}

export const inputClass = cn(
    'w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13.5px] text-[#1c1c24]',
    'outline-none transition-colors placeholder:text-[#a8aab1]',
    'focus:border-[#925FFF] focus:ring-2 focus:ring-[#925FFF]/20',
    'dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-[#e4e5eb] dark:placeholder:text-[#6e7079]'
)

/* ------------------------------------------------------ override dialog */

/**
 * The single gate every override passes through.
 *
 * It exists because of one specific failure: a founder clicking "approve KYC"
 * or "force credit" from muscle memory and leaving no record of why. The reason
 * field is required, it is what lands in `admin_audit_log`, and the button
 * stays disabled until it is filled.
 */
export function OverrideDialog({
    open,
    onClose,
    title,
    description,
    confirmLabel,
    destructive,
    loading,
    error,
    onConfirm,
    children,
    reasonPlaceholder = 'e.g. Verified passport over a support call on 6 Sep',
}: {
    open: boolean
    onClose: () => void
    title: string
    description: string
    confirmLabel: string
    destructive?: boolean
    loading?: boolean
    error?: string | null
    onConfirm: (reason: string) => void
    children?: React.ReactNode
    reasonPlaceholder?: string
}) {
    const [reason, setReason] = useState('')

    useEffect(() => {
        if (open) setReason('')
    }, [open])

    if (!open) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full max-w-lg overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-2xl dark:border-white/[0.09] dark:bg-[#131315]"
                >
                    <header className="flex items-start justify-between gap-4 border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.07]">
                        <div className="flex items-start gap-3">
                            <div
                                className={cn(
                                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                    destructive
                                        ? 'bg-[#ffebeb] text-[#e0293c] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                        : 'bg-[#f1ebff] text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]'
                                )}
                            >
                                <AlertTriangle size={17} />
                            </div>
                            <div>
                                <h3 className="text-[15px] font-extrabold text-[#111116] dark:text-white">{title}</h3>
                                <p className="mt-1 text-[13px] leading-relaxed text-[#5c5f68] dark:text-[#9a9ca4]">
                                    {description}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="cursor-pointer rounded-full p-1 text-[#9a9ca4] transition-colors hover:text-[#1c1c24] dark:hover:text-white"
                            aria-label="Close"
                        >
                            <X size={17} />
                        </button>
                    </header>

                    <div className="space-y-4 px-5 py-4">
                        {children}

                        <Field
                            label="Reason for this override"
                            hint="Written to the audit log against your account. Required."
                        >
                            <textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={3}
                                placeholder={reasonPlaceholder}
                                className={cn(inputClass, 'resize-none')}
                            />
                        </Field>

                        {error && (
                            <p className="rounded-xl bg-[#ffebeb] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#c81f30] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                                {error}
                            </p>
                        )}
                    </div>

                    <footer className="flex items-center justify-end gap-2 border-t border-black/[0.05] bg-[#fafafb] px-5 py-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant={destructive ? 'danger' : 'primary'}
                            loading={loading}
                            disabled={reason.trim().length < 4}
                            onClick={() => onConfirm(reason.trim())}
                        >
                            {confirmLabel}
                        </Button>
                    </footer>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

/* ------------------------------------------------------------ feedback */

export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f2f4] text-[#9a9ca4] dark:bg-white/[0.06]">
                {icon}
            </div>
            <div>
                <p className="text-[14px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">{title}</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#81858c]">{body}</p>
            </div>
        </div>
    )
}

export function PanelLoader({ label = 'Loading' }: { label?: string }) {
    return (
        <div className="flex items-center justify-center gap-2.5 px-6 py-14 text-[13px] font-semibold text-[#81858c]">
            <Loader2 size={16} className="animate-spin" />
            {label}
        </div>
    )
}

/** Thin utilisation meter, used wherever a figure is a share of a cap. */
export function Meter({ percent, tone = 'brand' }: { percent: number; tone?: Tone }) {
    const clamped = Math.max(0, Math.min(100, percent))
    const fill =
        tone === 'danger'
            ? 'bg-[#ef5362]'
            : tone === 'warning'
              ? 'bg-[#f5a524]'
              : tone === 'success'
                ? 'bg-[#12b88f]'
                : 'bg-gradient-to-r from-[#6330cf] to-[#925FFF]'

    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eeeef1] dark:bg-white/[0.08]">
            <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${clamped}%` }} />
        </div>
    )
}

/** Relative time, e.g. "14m ago". Renders nothing until mounted, to avoid hydration drift. */
export function TimeAgo({ iso }: { iso: string | null }) {
    const [text, setText] = useState<string | null>(null)

    useEffect(() => {
        if (!iso) return setText(null)
        const compute = () => {
            const diff = Date.now() - new Date(iso).getTime()
            const minutes = Math.round(diff / 60000)
            if (minutes < 1) return 'just now'
            if (minutes < 60) return `${minutes}m ago`
            const hours = Math.round(minutes / 60)
            if (hours < 24) return `${hours}h ago`
            return `${Math.round(hours / 24)}d ago`
        }
        setText(compute())
        const timer = setInterval(() => setText(compute()), 60_000)
        return () => clearInterval(timer)
    }, [iso])

    if (!iso) return <span className="text-[#a8aab1]">never</span>
    return <span suppressHydrationWarning>{text ?? '—'}</span>
}
