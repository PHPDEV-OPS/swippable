'use client'

import { BadgeCheck, Ban, Search, Snowflake, UserCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAdminUsers } from '@/lib/admin-client'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { EmptyState, Panel, PanelLoader, Pill, StatusPill, TimeAgo, inputClass, toneForStatus } from './primitives'

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'FROZEN', 'BANNED'] as const
const KYC_FILTERS = ['ALL', 'PENDING', 'VERIFIED', 'REJECTED'] as const

function Avatar({ name, src }: { name: string; src: string | null }) {
    const initials = name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()

    if (src) {
        // eslint-disable-next-line @next/next/no-img-element -- Clerk avatars are already remote-optimised.
        return <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    }

    return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1ebff] text-[11px] font-black text-[#6330cf] dark:bg-[#6330cf]/20 dark:text-[#b79bff]">
            {initials || '?'}
        </span>
    )
}

/**
 * The user roster.
 *
 * Deliberately flat: no tiers, no assignment, no queue. Filters exist only to
 * find the account an incident is about, and every row is a link straight into
 * the override profile - which is where all the actual power lives.
 */
export function UsersConsole() {
    const params = useSearchParams()
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
    const [kyc, setKyc] = useState<(typeof KYC_FILTERS)[number]>('ALL')

    // Deep links from the command center pre-apply a filter.
    useEffect(() => {
        const kycParam = params?.get('kyc')
        if (kycParam && (KYC_FILTERS as readonly string[]).includes(kycParam)) {
            setKyc(kycParam as (typeof KYC_FILTERS)[number])
        }
        const statusParam = params?.get('status')
        if (statusParam && (STATUS_FILTERS as readonly string[]).includes(statusParam)) {
            setStatus(statusParam as (typeof STATUS_FILTERS)[number])
        }
    }, [params])

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 250)
        return () => clearTimeout(timer)
    }, [search])

    const users = useAdminUsers({ q: debounced, status, kyc })
    const rows = users.data ?? []

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">Users</h1>
                <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                    Open any account for direct KYC, limit and status overrides.
                </p>
            </div>

            <Panel bodyClassName="p-0">
                <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.05] p-4 dark:border-white/[0.07]">
                    <div className="relative min-w-[220px] flex-1">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8aab1]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Name, email, UUID or Clerk ID"
                            className={cn(inputClass, 'pl-10')}
                        />
                    </div>

                    <div className="flex items-center gap-1 rounded-full border border-black/[0.06] p-1 dark:border-white/[0.08]">
                        {STATUS_FILTERS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatus(value)}
                                className={cn(
                                    'cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition-all',
                                    status === value
                                        ? 'bg-[#19191b] text-white dark:bg-white dark:text-[#0a0a0a]'
                                        : 'text-[#81858c] hover:text-[#1c1c24] dark:hover:text-white'
                                )}
                            >
                                {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>

                    <select
                        value={kyc}
                        onChange={(event) => setKyc(event.target.value as (typeof KYC_FILTERS)[number])}
                        className={cn(inputClass, 'w-auto min-w-[150px] cursor-pointer')}
                    >
                        {KYC_FILTERS.map((value) => (
                            <option key={value} value={value}>
                                {value === 'ALL' ? 'Any KYC state' : `KYC ${value.toLowerCase()}`}
                            </option>
                        ))}
                    </select>
                </div>

                {users.isLoading ? (
                    <PanelLoader label="Loading accounts" />
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={<Users size={18} />}
                        title="No accounts match"
                        body="Try a different filter, or paste an identifier straight into the omnibar above."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse">
                            <thead>
                                <tr className="border-b border-black/[0.05] text-left dark:border-white/[0.07]">
                                    {['User', 'KYC', 'Status', 'Wallet', 'Cards', 'Deposited', 'Last seen'].map(
                                        (heading) => (
                                            <th
                                                key={heading}
                                                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]"
                                            >
                                                {heading}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="group border-b border-black/[0.04] last:border-0 transition-colors hover:bg-[#fafafb] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                                    >
                                        <td className="px-4 py-3">
                                            <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                                                <Avatar name={user.name} src={user.imageUrl} />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="truncate text-[13.5px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                            {user.name}
                                                        </span>
                                                        {user.isAdmin && <Pill tone="brand">Admin</Pill>}
                                                    </span>
                                                    <span className="block truncate text-[12px] text-[#81858c]">
                                                        {user.email}
                                                    </span>
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Pill tone={toneForStatus(user.kycStatus)}>
                                                {user.kycStatus === 'VERIFIED' && <BadgeCheck size={11} />}
                                                {user.kycStatus}
                                            </Pill>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Pill tone={toneForStatus(user.accountStatus)}>
                                                {user.accountStatus === 'FROZEN' && <Snowflake size={11} />}
                                                {user.accountStatus === 'BANNED' && <Ban size={11} />}
                                                {user.accountStatus === 'ACTIVE' && <UserCheck size={11} />}
                                                {user.accountStatus}
                                            </Pill>
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-bold text-[#111116] dark:text-white">
                                            {formatMoney(user.walletBalance, user.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] text-[#4a4d55] dark:text-[#b9bbc2]">
                                            {user.activeCardCount}/{user.cardCount}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] text-[#4a4d55] dark:text-[#b9bbc2]">
                                            {formatMoney(user.lifetimeDeposits)}
                                        </td>
                                        <td className="px-4 py-3 text-[12.5px] text-[#81858c]">
                                            <TimeAgo iso={user.lastSeenAt} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {rows.length > 0 && (
                <p className="text-[12px] text-[#a8aab1]">
                    Showing {rows.length} account{rows.length === 1 ? '' : 's'}.
                </p>
            )}
        </div>
    )
}

/** Shared by the 360 profile. */
export { Avatar, StatusPill }
