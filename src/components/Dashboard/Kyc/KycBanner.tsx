'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { useMe } from '@/lib/client-api'
import { isKycVerified } from '@/types/api'

/**
 * Prompts an unverified user to complete identity verification.
 *
 * Without this the gate is only discoverable by walking into it - a user hits
 * the card screen, gets redirected, and has to work out why. Surfacing it on
 * the dashboard makes verification the obvious next step after sign-up, which
 * is where the user journey puts it.
 *
 * Renders nothing at all once verified, and nothing while the query is still
 * loading: flashing "verify your identity" at someone who already did is worse
 * than showing the banner a moment late.
 */
export function KycBanner() {
    const me = useMe()

    if (me.isLoading || !me.data) return null
    if (isKycVerified(me.data.kycStatus)) return null

    const status = me.data.kycStatus
    const rejected = status === 'REJECTED'

    return (
        <div
            className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ${
                rejected
                    ? 'bg-[#ffebeb] text-[#b42318] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                    : 'bg-[#f0eaff] text-[#5b32c4] dark:bg-[#281b45] dark:text-[#c4a8ff]'
            }`}
        >
            <ShieldCheck size={16} className="shrink-0" />
            <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed">{copyFor(status)}</p>

            {/* A rejected account cannot fix anything by resubmitting, so it is
                not offered a link into a form that will not help. */}
            {!rejected && (
                <Link
                    href="/dashboard/kyc-verification"
                    className="shrink-0 rounded-full bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-4 py-2 text-[11px] font-bold text-white shadow-md transition-all hover:opacity-95"
                >
                    {status === 'FAILED' ? 'Try again' : 'Verify now'}
                </Link>
            )}
        </div>
    )
}

function copyFor(status: string): string {
    switch (status) {
        case 'PENDING':
            return 'Your identity verification is being processed. Card creation unlocks as soon as it completes.'
        case 'FAILED':
            return 'We could not match your details to the national records. Check them against your ID and try again.'
        case 'REJECTED':
            return 'Your identity verification was declined. Please contact support.'
        default:
            return 'Verify your identity to create virtual cards and add money to them.'
    }
}
