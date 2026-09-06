'use client'

import { ScrollText, Search } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useAuditLog } from '@/lib/admin-client'
import { cn } from '@/lib/utils'
import type { AuditAction } from '@/types/admin'
import { EmptyState, Panel, PanelLoader, Pill, TimeAgo, inputClass, type Tone } from './primitives'

/** Weight follows consequence: halting the platform reads louder than a read. */
const ACTION_TONE: Partial<Record<AuditAction, Tone>> = {
    KILL_SWITCH_ENGAGED: 'danger',
    RAIL_HALTED: 'danger',
    ACCOUNT_STATUS_OVERRIDE: 'danger',
    FORCE_CREDIT: 'danger',
    CARD_PAN_REVEALED: 'danger',
    FORCE_FAIL: 'warning',
    KILL_SWITCH_RELEASED: 'success',
    RAIL_RESUMED: 'success',
    FORCE_RECONCILE: 'success',
    WEBHOOK_COMPLETED: 'success',
    KYC_OVERRIDE: 'brand',
    LIMITS_OVERRIDE: 'brand',
    CARD_LIMIT_OVERRIDE: 'brand',
    CARD_STATUS_OVERRIDE: 'brand',
    SIMULATION_RUN: 'neutral',
    LIQUIDITY_UPDATED: 'neutral',
    ADMIN_BOOTSTRAPPED: 'brand',
}

function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
    if (!before && !after) return null

    const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))
    if (keys.length === 0) return null

    return (
        <dl className="mt-2.5 grid gap-1 rounded-xl bg-[#fafafb] p-3 text-[11.5px] dark:bg-white/[0.03]">
            {keys.map((key) => {
                const from = before?.[key]
                const to = after?.[key]
                if (JSON.stringify(from) === JSON.stringify(to)) return null
                return (
                    <div key={key} className="flex flex-wrap items-baseline gap-x-2">
                        <dt className="font-bold text-[#81858c]">{key}</dt>
                        <dd className="font-mono text-[#a8aab1] line-through">
                            {from === undefined ? '—' : JSON.stringify(from)}
                        </dd>
                        <span className="text-[#a8aab1]">→</span>
                        <dd className="font-mono font-bold text-[#111116] dark:text-white">
                            {to === undefined ? '—' : JSON.stringify(to)}
                        </dd>
                    </div>
                )
            })}
        </dl>
    )
}

/**
 * The audit trail.
 *
 * Append-only by construction — nothing in the app updates or deletes a row —
 * and every override in the product writes here *before* it takes effect. The
 * reason column is the whole point: it is the only place that records why a
 * founder bypassed a control, which is what makes the bypass defensible later.
 */
export function AuditTrail() {
    const audit = useAuditLog(150)
    const [filter, setFilter] = useState('')

    const entries = (audit.data ?? []).filter((entry) => {
        if (!filter.trim()) return true
        const needle = filter.toLowerCase()
        return (
            entry.action.toLowerCase().includes(needle) ||
            entry.actorEmail.toLowerCase().includes(needle) ||
            (entry.reason ?? '').toLowerCase().includes(needle) ||
            (entry.targetId ?? '').toLowerCase().includes(needle)
        )
    })

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Audit trail
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        Every override, with who did it and why. Append-only.
                    </p>
                </div>

                <div className="relative min-w-[260px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8aab1]" />
                    <input
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder="Action, operator, reason or target"
                        className={cn(inputClass, 'pl-10')}
                    />
                </div>
            </div>

            <Panel bodyClassName="p-4">
                {audit.isLoading ? (
                    <PanelLoader label="Loading the trail" />
                ) : entries.length === 0 ? (
                    <EmptyState
                        icon={<ScrollText size={18} />}
                        title="Nothing recorded yet"
                        body="Overrides appear here the moment one is applied — including the first superadmin sign-in."
                    />
                ) : (
                    <ol className="space-y-2.5">
                        {entries.map((entry) => (
                            <li
                                key={entry.id}
                                className="rounded-2xl border border-black/[0.05] p-3.5 dark:border-white/[0.07]"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Pill tone={ACTION_TONE[entry.action] ?? 'neutral'}>
                                            {entry.action.replace(/_/g, ' ')}
                                        </Pill>
                                        {entry.targetType === 'USER' && entry.targetId ? (
                                            <Link
                                                href={`/admin/users/${entry.targetId}`}
                                                className="text-[12px] font-semibold text-[#81858c] underline decoration-dotted underline-offset-2 hover:text-[#6330cf] dark:hover:text-[#b79bff]"
                                            >
                                                user #{entry.targetId}
                                            </Link>
                                        ) : (
                                            entry.targetId && (
                                                <span className="font-mono text-[11.5px] text-[#a8aab1]">
                                                    {entry.targetType.toLowerCase()} {entry.targetId}
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <span className="text-[11.5px] text-[#a8aab1]">
                                        <TimeAgo iso={entry.createdAt} />
                                    </span>
                                </div>

                                {entry.reason && (
                                    <p className="mt-2 text-[12.5px] leading-relaxed text-[#4a4d55] dark:text-[#b9bbc2]">
                                        “{entry.reason}”
                                    </p>
                                )}

                                <Diff before={entry.before} after={entry.after} />

                                <p className="mt-2 text-[11.5px] text-[#a8aab1]">
                                    {entry.actorEmail}
                                    {entry.ip ? ` · ${entry.ip}` : ''}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}
            </Panel>
        </div>
    )
}
