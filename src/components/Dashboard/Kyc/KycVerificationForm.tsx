'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { KycStatus } from '@/types/api'

/**
 * Identity verification form.
 *
 * Collects exactly the four fields the national-database match needs and posts
 * them to /api/kyc/verify. Nothing here talks to Dojah: the browser never sees
 * the provider, the AppId or the secret key, only our own endpoint.
 */

const LABEL =
    'text-[#777984] dark:text-[#888a93] text-[10px] font-bold uppercase tracking-wider ml-1'
const FIELD =
    'w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-[#1c1c24] dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4] disabled:opacity-60'

interface Props {
    status: KycStatus
    /** Where to send the user once they are verified. */
    returnTo: string
}

export function KycVerificationForm({ status, returnTo }: Props) {
    const router = useRouter()
    const queryClient = useQueryClient()

    const [form, setForm] = useState({ firstName: '', lastName: '', idNumber: '', dob: '' })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setForm((current) => ({ ...current, [key]: event.target.value }))
        setError(null)
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        if (submitting) return

        setSubmitting(true)
        setError(null)

        try {
            const response = await fetch('/api/kyc/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const payload = (await response.json().catch(() => null)) as
                | { status?: string; message?: string; error?: string }
                | null

            if (response.ok && payload?.status === 'VERIFIED') {
                toast.success('Identity verified')
                // The card gate reads the server row, so the cached `me` query
                // must be dropped before we navigate or the page we land on
                // would still believe the user is unverified.
                await queryClient.invalidateQueries()
                router.replace(returnTo)
                router.refresh()
                return
            }

            setError(payload?.message ?? payload?.error ?? 'Verification failed. Please try again.')
        } catch {
            setError('Could not reach the server. Check your connection and try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // The maximum DOB that still clears the 18-year check the API enforces, so
    // the date picker cannot offer a value the server will reject.
    const latestDob = (() => {
        const date = new Date()
        date.setUTCFullYear(date.getUTCFullYear() - 18)
        return date.toISOString().slice(0, 10)
    })()

    return (
        <form onSubmit={handleSubmit} className='space-y-6'>
            {status === 'REJECTED' && (
                <Banner tone='danger'>
                    Your verification was declined by our compliance team. Please contact support -
                    resubmitting here will not change the outcome.
                </Banner>
            )}
            {status === 'FAILED' && (
                <Banner tone='warning'>
                    Your last attempt did not match the national records. Check every field against your
                    physical ID card and try again.
                </Banner>
            )}
            {status === 'PENDING' && (
                <Banner tone='info'>
                    A verification is already being processed for this account. You can resubmit if it does
                    not complete shortly.
                </Banner>
            )}

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <Field label='First name (as on ID)'>
                    <input
                        type='text'
                        required
                        autoComplete='given-name'
                        value={form.firstName}
                        onChange={update('firstName')}
                        disabled={submitting}
                        placeholder='John'
                        className={FIELD}
                    />
                </Field>
                <Field label='Last name (as on ID)'>
                    <input
                        type='text'
                        required
                        autoComplete='family-name'
                        value={form.lastName}
                        onChange={update('lastName')}
                        disabled={submitting}
                        placeholder='Mwangi'
                        className={FIELD}
                    />
                </Field>
                <Field label='National ID number'>
                    <input
                        type='text'
                        required
                        inputMode='numeric'
                        value={form.idNumber}
                        onChange={update('idNumber')}
                        disabled={submitting}
                        placeholder='12345678'
                        className={FIELD}
                    />
                </Field>
                <Field label='Date of birth'>
                    <input
                        type='date'
                        required
                        max={latestDob}
                        value={form.dob}
                        onChange={update('dob')}
                        disabled={submitting}
                        className={FIELD}
                    />
                </Field>
            </div>

            {error && <Banner tone='danger'>{error}</Banner>}

            <p className='text-[11px] leading-relaxed text-[#777984] dark:text-[#888a93]'>
                Your details are checked against the Kenyan national identity database and are used only to
                verify who you are. They are never shared with merchants.
            </p>

            <div className='flex justify-end gap-3 border-t border-black/[0.05] pt-6 dark:border-white/[0.08]'>
                <button
                    type='submit'
                    disabled={submitting}
                    className='rounded-xl bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-7 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'
                >
                    {submitting ? 'Verifying…' : 'Verify my identity'}
                </button>
            </div>
        </form>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-1.5'>
            <label className={LABEL}>{label}</label>
            {children}
        </div>
    )
}

function Banner({ tone, children }: { tone: 'danger' | 'warning' | 'info'; children: React.ReactNode }) {
    const tones = {
        danger: 'bg-[#fdeaea] text-[#b42318] dark:bg-[#3a1a1a] dark:text-[#ffb4ab]',
        warning: 'bg-[#fff6e5] text-[#9a6200] dark:bg-[#3a2d14] dark:text-[#f5c86b]',
        info: 'bg-[#f0eaff] text-[#5b32c4] dark:bg-[#281b45] dark:text-[#c4a8ff]',
    } as const

    return (
        <div className={`rounded-xl px-4 py-3 text-[11px] font-semibold leading-relaxed ${tones[tone]}`}>
            {children}
        </div>
    )
}
