'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft,
    Check,
    CreditCard,
    Info,
    Loader2,
    Lock,
    Minus,
    ShieldCheck,
    Stethoscope,
    X,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ApiRequestError } from '@/lib/client-api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { CheckoutCard, CheckoutRequest, CheckoutResponse } from '@/types/checkout'

/**
 * A test merchant checkout.
 *
 * Deliberately shaped like a real payment page rather than an admin form,
 * because the point is to exercise the authorisation path the way a merchant
 * actually would. What comes back is not a simulation of a result - the wallet
 * really moves, the card's spend counter really advances, and a decline really
 * lands in the cardholder's history and the command center's diagnostics.
 */

const TRACE_ICONS = { PASS: Check, FAIL: X, SKIP: Minus } as const

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        const message = (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`
        throw new ApiRequestError(response.status, message, (payload as { code?: string } | null)?.code)
    }
    return payload as T
}

/** Groups digits into 4s as the shopper types, like any real card field. */
function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 19)
    return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

const inputClass = cn(
    'w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[15px] text-[#111116]',
    'outline-none transition-all placeholder:text-[#a8aab1]',
    'focus:border-[#7042f4] focus:ring-4 focus:ring-[#7042f4]/12'
)

const labelClass = 'mb-1.5 block text-[12.5px] font-bold text-[#3f4149]'

export function Checkout() {
    const queryClient = useQueryClient()

    // null means "untouched", so the fields can fall back to the default card
    // without an effect writing state on every data arrival.
    const [cardNumber, setCardNumber] = useState<string | null>(null)
    const [expiry, setExpiry] = useState<string | null>(null)
    const [cvv, setCvv] = useState('')
    const [amount, setAmount] = useState('9.99')
    const [merchant, setMerchant] = useState('Aurora Coffee Roasters')
    const [country, setCountry] = useState('KE')

    const cards = useQuery({
        queryKey: ['checkout', 'cards'],
        queryFn: () => request<CheckoutCard[]>('/api/checkout'),
        staleTime: 10_000,
    })

    const pay = useMutation({
        mutationFn: (body: CheckoutRequest) =>
            request<CheckoutResponse>('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => {
            // The charge moved the wallet and the card, so every dashboard view
            // that reads them is now stale.
            ;[['me'], ['wallet'], ['cards'], ['transactions'], ['summary'], ['analytics'], ['notifications'], ['checkout']].forEach(
                (key) => queryClient.invalidateQueries({ queryKey: key })
            )
        },
    })

    const result = pay.data

    // The first usable card is the default, so the page is one click from a
    // payment - derived at render rather than written back into state.
    const defaultCard =
        cards.data?.find((card) => card.status === 'ACTIVE' && !card.expired) ?? cards.data?.[0] ?? null

    const cardNumberValue =
        cardNumber ?? (defaultCard ? formatCardNumber(`000000000000${defaultCard.last4}`) : '')
    const expiryValue = expiry ?? defaultCard?.expiry ?? ''

    const selectCard = (card: CheckoutCard) => {
        setCardNumber(formatCardNumber(`000000000000${card.last4}`))
        setExpiry(card.expiry)
        pay.reset()
    }

    const canPay = cardNumberValue.replace(/\D/g, '').length >= 4 && Number(amount) > 0 && !pay.isPending

    return (
        <div className="min-h-screen bg-[#f4f4f6] px-4 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto w-full max-w-[1080px]">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#6b6e76] transition-colors hover:text-[#111116]"
                    >
                        <ArrowLeft size={15} />
                        Back to dashboard
                    </Link>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ede7ff] px-3 py-1.5 text-[11.5px] font-bold text-[#5b2bc9]">
                        <Info size={12} />
                        Test checkout — charges are real
                    </span>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    {/* Payment form. */}
                    <div className="rounded-[26px] border border-black/[0.05] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] sm:p-8">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#6330cf] to-[#925FFF] text-white">
                                <CreditCard size={18} />
                            </span>
                            <div>
                                <h1 className="text-[19px] font-extrabold tracking-tight text-[#111116]">
                                    Card payment
                                </h1>
                                <p className="text-[12.5px] text-[#81858c]">
                                    Runs the real authorisation path against your card.
                                </p>
                            </div>
                        </div>

                        {/* Card picker. */}
                        <div className="mt-6">
                            <span className={labelClass}>Pay with</span>
                            {cards.isLoading ? (
                                <p className="flex items-center gap-2 py-3 text-[13px] text-[#81858c]">
                                    <Loader2 size={14} className="animate-spin" />
                                    Loading your cards
                                </p>
                            ) : (cards.data?.length ?? 0) === 0 ? (
                                <p className="rounded-2xl bg-[#fff8ec] px-4 py-3 text-[13px] leading-relaxed text-[#8a5a00]">
                                    You have no virtual cards yet. Issue one from the{' '}
                                    <Link href="/dashboard/cards" className="font-bold underline">
                                        Cards page
                                    </Link>{' '}
                                    first, then come back here to charge it.
                                </p>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {cards.data!.map((card) => {
                                        const selected = cardNumberValue.replace(/\D/g, '').endsWith(card.last4)
                                        const usable = card.status === 'ACTIVE' && !card.expired
                                        return (
                                            <button
                                                key={card.cardId}
                                                type="button"
                                                onClick={() => selectCard(card)}
                                                className={cn(
                                                    'cursor-pointer rounded-2xl border p-3 text-left transition-all',
                                                    selected
                                                        ? 'border-[#7042f4] bg-[#f6f2ff] ring-2 ring-[#7042f4]/15'
                                                        : 'border-black/[0.07] hover:border-[#7042f4]/40 hover:bg-[#fafafb]'
                                                )}
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="font-mono text-[13.5px] font-bold text-[#111116]">
                                                        •••• {card.last4}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                                                            usable
                                                                ? 'bg-[#e7faf4] text-[#0d8f70]'
                                                                : 'bg-[#ffebeb] text-[#d13849]'
                                                        )}
                                                    >
                                                        {card.expired ? 'EXPIRED' : card.status}
                                                    </span>
                                                </span>
                                                <span className="mt-1 block text-[11.5px] text-[#81858c]">
                                                    {formatMoney(card.available)} available · exp {card.expiry}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Card details. */}
                        <div className="mt-5 space-y-4">
                            <label className="block">
                                <span className={labelClass}>Card number</span>
                                <input
                                    inputMode="numeric"
                                    value={cardNumberValue}
                                    onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                                    placeholder="0000 0000 0000 0000"
                                    className={cn(inputClass, 'font-mono tracking-[0.06em]')}
                                />
                                <span className="mt-1.5 block text-[11.5px] text-[#9a9ca4]">
                                    Sandbox cards hold no real number — the card is matched on its last 4 digits.
                                </span>
                            </label>

                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className={labelClass}>Expiry</span>
                                    <input
                                        inputMode="numeric"
                                        value={expiryValue}
                                        onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                                        placeholder="MM/YY"
                                        className={cn(inputClass, 'font-mono')}
                                    />
                                </label>
                                <label className="block">
                                    <span className={labelClass}>CVV</span>
                                    <input
                                        inputMode="numeric"
                                        value={cvv}
                                        maxLength={4}
                                        onChange={(event) => setCvv(event.target.value.replace(/\D/g, ''))}
                                        placeholder="123"
                                        className={cn(inputClass, 'font-mono')}
                                    />
                                </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                    <span className={labelClass}>Merchant</span>
                                    <input
                                        value={merchant}
                                        onChange={(event) => setMerchant(event.target.value)}
                                        className={inputClass}
                                    />
                                </label>
                                <label className="block">
                                    <span className={labelClass}>Merchant country</span>
                                    <input
                                        value={country}
                                        maxLength={2}
                                        onChange={(event) => setCountry(event.target.value.toUpperCase())}
                                        placeholder="KE"
                                        className={cn(inputClass, 'uppercase')}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Test triggers, stated plainly rather than hidden. */}
                        <div className="mt-5 rounded-2xl bg-[#f7f7f9] p-4">
                            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                Test triggers
                            </p>
                            <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-[#5c5f68]">
                                <li>
                                    CVV <code className="font-mono font-bold">000</code> forces an invalid-CVV decline.
                                </li>
                                <li>
                                    Country <code className="font-mono font-bold">IR KP SY CU RU BY</code> forces a
                                    blocked-country decline.
                                </li>
                                <li>An amount above the card allocation or wallet balance declines naturally.</li>
                            </ul>
                        </div>

                        {pay.isError && (
                            <p className="mt-4 rounded-2xl bg-[#ffebeb] px-4 py-3 text-[13px] font-semibold text-[#c81f30]">
                                {(pay.error as Error).message}
                            </p>
                        )}
                    </div>

                    {/* Order summary + result. */}
                    <div className="space-y-4">
                        <div className="rounded-[26px] border border-black/[0.05] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                            <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                Order summary
                            </h2>

                            <label className="mt-4 block">
                                <span className={labelClass}>Amount (USD)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    className={cn(inputClass, 'text-[22px] font-extrabold')}
                                />
                            </label>

                            <dl className="mt-4 space-y-2 border-t border-dashed border-black/[0.08] pt-4 text-[13px]">
                                <div className="flex justify-between">
                                    <dt className="text-[#81858c]">Merchant</dt>
                                    <dd className="max-w-[60%] truncate font-semibold text-[#111116]">{merchant}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-[#81858c]">Country</dt>
                                    <dd className="font-semibold text-[#111116]">{country || '—'}</dd>
                                </div>
                                <div className="flex justify-between border-t border-dashed border-black/[0.08] pt-2">
                                    <dt className="font-bold text-[#111116]">Total</dt>
                                    <dd className="text-[17px] font-extrabold text-[#111116]">
                                        {formatMoney(amount || '0')}
                                    </dd>
                                </div>
                            </dl>

                            <button
                                type="button"
                                disabled={!canPay}
                                onClick={() =>
                                    pay.mutate({
                                        cardNumber: cardNumberValue,
                                        expiry: expiryValue,
                                        cvv,
                                        amount,
                                        merchant,
                                        merchantCountry: country,
                                    })
                                }
                                className={cn(
                                    'mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold text-white transition-all',
                                    'bg-gradient-to-r from-[#6330cf] to-[#925FFF] shadow-[0_6px_18px_rgba(112,66,244,0.3)] hover:brightness-110',
                                    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
                                )}
                            >
                                {pay.isPending ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Authorising
                                    </>
                                ) : (
                                    <>
                                        <Lock size={15} />
                                        Pay {formatMoney(amount || '0')}
                                    </>
                                )}
                            </button>

                            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#9a9ca4]">
                                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#12b88f]" />
                                You can only charge cards on your own account.
                            </p>
                        </div>

                        {/* Receipt. */}
                        <AnimatePresence>
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={cn(
                                        'overflow-hidden rounded-[26px] border bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]',
                                        result.outcome === 'APPROVED'
                                            ? 'border-[#12b88f]/30'
                                            : 'border-[#e0293c]/30'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'flex items-center gap-2.5 px-5 py-3.5 text-white',
                                            result.outcome === 'APPROVED' ? 'bg-[#0d8f70]' : 'bg-[#e0293c]'
                                        )}
                                    >
                                        {result.outcome === 'APPROVED' ? <Check size={16} /> : <X size={16} />}
                                        <span className="text-[13px] font-black uppercase tracking-[0.08em]">
                                            {result.outcome}
                                        </span>
                                        <span className="ml-auto text-[13px] font-bold">
                                            {formatMoney(result.amount, result.currency)}
                                        </span>
                                    </div>

                                    <div className="space-y-4 p-5">
                                        <p className="text-[13.5px] leading-relaxed text-[#111116]">{result.message}</p>

                                        <dl className="grid gap-1.5 rounded-2xl bg-[#fafafb] p-3.5 text-[12px]">
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[#81858c]">Card</dt>
                                                <dd className="font-mono font-semibold text-[#111116]">
                                                    •••• {result.last4}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[#81858c]">Wallet balance</dt>
                                                <dd className="font-semibold text-[#111116]">
                                                    {formatMoney(result.balanceAfter)}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[#81858c]">Card available</dt>
                                                <dd className="font-semibold text-[#111116]">
                                                    {formatMoney(result.cardAvailableAfter)}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[#81858c]">Reference</dt>
                                                <dd className="truncate font-mono text-[11px] text-[#81858c]">
                                                    {result.txId}
                                                </dd>
                                            </div>
                                        </dl>

                                        {/* Decline reasoning, from the same catalogue the admin sees. */}
                                        {result.diagnostic && (
                                            <div className="rounded-2xl border border-[#e0293c]/25 bg-[#fff8f8] p-3.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-[13px] font-extrabold text-[#111116]">
                                                        {result.diagnostic.title}
                                                    </p>
                                                    <span className="font-mono text-[10.5px] text-[#a8aab1]">
                                                        {result.diagnostic.code}
                                                    </span>
                                                </div>
                                                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#4a4d55]">
                                                    {result.diagnostic.explanation}
                                                </p>
                                                <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-[#4b249f]">
                                                    <Stethoscope size={13} className="mt-0.5 shrink-0" />
                                                    <span>
                                                        <span className="font-bold">Do this: </span>
                                                        {result.diagnostic.remedy}
                                                    </span>
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                                Processor trace
                                            </p>
                                            <ol className="space-y-1.5">
                                                {result.trace.map((step, index) => {
                                                    const Icon = TRACE_ICONS[step.status]
                                                    return (
                                                        <li
                                                            key={`${step.step}-${index}`}
                                                            className="flex items-start gap-2.5"
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                                                    step.status === 'PASS'
                                                                        ? 'bg-[#e7faf4] text-[#0d8f70]'
                                                                        : step.status === 'FAIL'
                                                                          ? 'bg-[#ffebeb] text-[#e0293c]'
                                                                          : 'bg-[#f2f2f4] text-[#9a9ca4]'
                                                                )}
                                                            >
                                                                <Icon size={11} strokeWidth={3} />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="text-[12.5px] font-bold text-[#111116]">
                                                                    {step.step}
                                                                </span>
                                                                <span className="block text-[11.5px] leading-relaxed text-[#81858c]">
                                                                    {step.detail}
                                                                </span>
                                                            </span>
                                                        </li>
                                                    )
                                                })}
                                            </ol>
                                        </div>

                                        <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
                                            <Link
                                                href="/dashboard/transactions"
                                                className="rounded-full bg-[#111116] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[#2a2a2e]"
                                            >
                                                See it in transactions
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => pay.reset()}
                                                className="cursor-pointer rounded-full border border-black/[0.1] px-4 py-2 text-[12.5px] font-bold text-[#3f4149] transition-colors hover:bg-[#f7f7f9]"
                                            >
                                                New payment
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}
