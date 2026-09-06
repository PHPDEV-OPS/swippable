'use client'

import {
    Bitcoin,
    Check,
    CircleSlash,
    FlaskConical,
    Minus,
    Play,
    RotateCcw,
    ShoppingCart,
    Smartphone,
    Terminal,
    X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAdminCards, useAdminUsers, useDeclines, useSimulate } from '@/lib/admin-client'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DeclineCode, SimulationScenario } from '@/types/admin'
import { Button, Field, Panel, Pill, inputClass } from './primitives'

interface ScenarioSpec {
    id: SimulationScenario
    label: string
    blurb: string
    group: 'Card' | 'M-Pesa' | 'Crypto'
    needsCard: boolean
}

const SCENARIOS: ScenarioSpec[] = [
    {
        id: 'CARD_PAYMENT_APPROVED',
        label: 'Approved payment',
        blurb: 'Runs the real authorisation: card allocation, wallet balance and platform float are all checked.',
        group: 'Card',
        needsCard: true,
    },
    {
        id: 'CARD_PAYMENT_DECLINED',
        label: 'Declined payment',
        blurb: 'Force a specific processor decline code, even one the current state would not produce.',
        group: 'Card',
        needsCard: true,
    },
    {
        id: 'CARD_REFUND',
        label: 'Refund / chargeback',
        blurb: 'Reverses a card debit: credits the wallet and rolls back the card’s spend counter.',
        group: 'Card',
        needsCard: true,
    },
    {
        id: 'MPESA_STK_SUCCESS',
        label: 'STK push paid',
        blurb: 'Raises a prompt, records the PENDING row, then settles it exactly as the Daraja callback would.',
        group: 'M-Pesa',
        needsCard: false,
    },
    {
        id: 'MPESA_STK_FAILURE',
        label: 'STK push cancelled',
        blurb: 'ResultCode 1032 — the user dismissed the prompt. Nothing should be credited.',
        group: 'M-Pesa',
        needsCard: false,
    },
    {
        id: 'MPESA_CALLBACK_TIMEOUT',
        label: 'Callback never arrives',
        blurb: 'Money taken, no callback. Produces a stranded deposit for the intervention module to reconcile.',
        group: 'M-Pesa',
        needsCard: false,
    },
    {
        id: 'CRYPTO_DEPOSIT_CONFIRMED',
        label: 'Deposit confirmed',
        blurb: 'A USDC transfer on Base reaching 12 confirmations, settled through the webhook path.',
        group: 'Crypto',
        needsCard: false,
    },
    {
        id: 'CRYPTO_WEBHOOK_MISSED',
        label: 'Webhook missed',
        blurb: 'Transfer lands on-chain but the indexer never posts. Leaves a row for manual completion.',
        group: 'Crypto',
        needsCard: false,
    },
]

const DECLINE_CODES: DeclineCode[] = [
    'INVALID_CVV',
    'BLOCKED_MERCHANT_COUNTRY',
    'EXPIRED_CARD',
    'CARD_LIMIT_EXCEEDED',
    'INSUFFICIENT_WALLET_BALANCE',
    'INSUFFICIENT_PLATFORM_FLOAT',
    'CARD_NOT_ACTIVE',
    'ACCOUNT_FROZEN',
]

const GROUP_ICONS = {
    Card: FlaskConical,
    'M-Pesa': Smartphone,
    Crypto: Bitcoin,
} as const

const TRACE_ICONS = {
    PASS: Check,
    FAIL: X,
    SKIP: Minus,
} as const

/**
 * The simulation lab.
 *
 * The point of this screen is that nothing on it is a mock. Every scenario is
 * executed by the same functions the live webhooks call, so an approved
 * payment here debits the wallet through the identical guarded statement a
 * real Flutterwave authorisation does, and a decline fails at the identical
 * check.
 *
 * Dry run is the default and the safe path: it walks every check and reports
 * where a real charge would have stopped, without writing anything. Switching
 * to a live run is a deliberate, reasoned act — it moves real money in the
 * ledger, so it demands a justification and is tagged `simulated` everywhere it
 * lands.
 */
export function SimulationLab() {
    const [scenario, setScenario] = useState<SimulationScenario>('CARD_PAYMENT_APPROVED')
    const [userRef, setUserRef] = useState('')
    const [cardId, setCardId] = useState('')
    const [amount, setAmount] = useState('25.00')
    const [merchant, setMerchant] = useState('Simulated Merchant')
    const [country, setCountry] = useState('KE')
    const [declineCode, setDeclineCode] = useState<DeclineCode>('INVALID_CVV')
    const [dryRun, setDryRun] = useState(true)
    const [reason, setReason] = useState('')

    const users = useAdminUsers({})
    const selectedUser = users.data?.find((user) => String(user.id) === userRef)
    const cards = useAdminCards({ userId: selectedUser?.id })
    const simulate = useSimulate()
    const declines = useDeclines({})

    const spec = useMemo(() => SCENARIOS.find((item) => item.id === scenario)!, [scenario])

    // Clear a card selection that no longer belongs to the chosen user.
    useEffect(() => {
        if (!cards.data?.some((card) => card.cardId === cardId)) setCardId('')
    }, [cards.data, cardId])

    const canRun =
        Boolean(userRef) &&
        Number(amount) > 0 &&
        (!spec.needsCard || Boolean(cardId)) &&
        (dryRun || reason.trim().length >= 4)

    const result = simulate.data

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Simulation lab
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        Rehearse payments, declines and lost webhooks against the real authorisation path.
                    </p>
                </div>
                <Link
                    href="/checkout"
                    className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-bold text-[#1c1c24] transition-colors hover:bg-[#f7f7f9] dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-[#e4e5eb] dark:hover:bg-white/[0.09]"
                >
                    <ShoppingCart size={14} />
                    Open the test checkout
                </Link>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
                {/* Composer. */}
                <Panel title="Scenario" bodyClassName="p-4 space-y-4">
                    {(['Card', 'M-Pesa', 'Crypto'] as const).map((group) => {
                        const Icon = GROUP_ICONS[group]
                        return (
                            <div key={group}>
                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                    <Icon size={12} />
                                    {group}
                                </p>
                                <div className="grid gap-2">
                                    {SCENARIOS.filter((item) => item.group === group).map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setScenario(item.id)}
                                            className={cn(
                                                'cursor-pointer rounded-xl border p-3 text-left transition-all',
                                                scenario === item.id
                                                    ? 'border-[#925FFF]/50 bg-[#f1ebff] dark:bg-[#6330cf]/15'
                                                    : 'border-black/[0.06] hover:border-[#925FFF]/30 hover:bg-[#fafafb] dark:border-white/[0.08] dark:hover:bg-white/[0.04]'
                                            )}
                                        >
                                            <span className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                {item.label}
                                            </span>
                                            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-[#81858c]">
                                                {item.blurb}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </Panel>

                {/* Parameters + result. */}
                <div className="space-y-4">
                    <Panel title="Parameters" bodyClassName="p-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Target user">
                                <select
                                    value={userRef}
                                    onChange={(event) => setUserRef(event.target.value)}
                                    className={cn(inputClass, 'cursor-pointer')}
                                >
                                    <option value="">Select an account…</option>
                                    {(users.data ?? []).map((user) => (
                                        <option key={user.id} value={String(user.id)}>
                                            {user.name} — {formatMoney(user.walletBalance)}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Amount (USD)">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    className={inputClass}
                                />
                            </Field>

                            {spec.needsCard && (
                                <Field label="Card" className="sm:col-span-2">
                                    <select
                                        value={cardId}
                                        onChange={(event) => setCardId(event.target.value)}
                                        disabled={!userRef}
                                        className={cn(inputClass, 'cursor-pointer disabled:opacity-50')}
                                    >
                                        <option value="">
                                            {userRef ? 'Select a card…' : 'Choose a user first'}
                                        </option>
                                        {(cards.data ?? []).map((card) => (
                                            <option key={card.cardId} value={card.cardId}>
                                                •••• {card.last4} — {formatMoney(card.available)} available ·{' '}
                                                {card.status}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}

                            {spec.group === 'Card' && (
                                <>
                                    <Field label="Merchant">
                                        <input
                                            value={merchant}
                                            onChange={(event) => setMerchant(event.target.value)}
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Merchant country" hint="ISO-3166 alpha-2. IR, KP, SY, CU, RU and BY are blocked.">
                                        <input
                                            value={country}
                                            maxLength={2}
                                            onChange={(event) => setCountry(event.target.value.toUpperCase())}
                                            className={cn(inputClass, 'uppercase')}
                                        />
                                    </Field>
                                </>
                            )}

                            {scenario === 'CARD_PAYMENT_DECLINED' && (
                                <Field
                                    label="Force decline code"
                                    className="sm:col-span-2"
                                    hint="Injected even if every check would otherwise pass."
                                >
                                    <select
                                        value={declineCode}
                                        onChange={(event) => setDeclineCode(event.target.value as DeclineCode)}
                                        className={cn(inputClass, 'cursor-pointer')}
                                    >
                                        {DECLINE_CODES.map((code) => (
                                            <option key={code} value={code}>
                                                {declines.data?.catalogue?.[code]?.title ?? code}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}
                        </div>

                        {/* Dry run switch — the safety boundary of this whole screen. */}
                        <div
                            className={cn(
                                'flex items-start gap-3 rounded-2xl border p-3.5 transition-colors',
                                dryRun
                                    ? 'border-black/[0.06] bg-[#fafafb] dark:border-white/[0.08] dark:bg-white/[0.03]'
                                    : 'border-[#e0293c]/25 bg-[#fff8f8] dark:border-[#e0293c]/25 dark:bg-[#e0293c]/[0.05]'
                            )}
                        >
                            <button
                                type="button"
                                role="switch"
                                aria-checked={!dryRun}
                                onClick={() => setDryRun(!dryRun)}
                                className={cn(
                                    'mt-0.5 h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors',
                                    dryRun ? 'bg-[#c9cbd2] dark:bg-white/20' : 'bg-[#e0293c]'
                                )}
                            >
                                <span
                                    className={cn(
                                        'block h-4 w-4 rounded-full bg-white transition-transform',
                                        dryRun ? 'translate-x-0' : 'translate-x-4'
                                    )}
                                />
                            </button>
                            <div>
                                <p className="text-[13px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
                                    {dryRun ? 'Dry run — nothing is written' : 'Live run — this moves real money'}
                                </p>
                                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#81858c]">
                                    {dryRun
                                        ? 'Every check runs and the trace shows where a real charge would stop, but no ledger row is created.'
                                        : 'The wallet, the card counters and the ledger all move for real. Rows are tagged as simulated so they can be told apart later.'}
                                </p>
                            </div>
                        </div>

                        {!dryRun && (
                            <Field label="Reason" hint="Required for a live run. Written to the audit log.">
                                <input
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder="e.g. Reproducing the decline reported in ticket 412"
                                    className={inputClass}
                                />
                            </Field>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={dryRun ? 'primary' : 'danger'}
                                disabled={!canRun}
                                loading={simulate.isPending}
                                onClick={() =>
                                    simulate.mutate({
                                        scenario,
                                        userRef,
                                        cardId: cardId || undefined,
                                        amount,
                                        merchant,
                                        merchantCountry: country,
                                        declineCode: scenario === 'CARD_PAYMENT_DECLINED' ? declineCode : undefined,
                                        dryRun,
                                        reason,
                                    })
                                }
                            >
                                <Play size={14} />
                                {dryRun ? 'Run dry' : 'Run live'}
                            </Button>
                            {result && (
                                <Button variant="ghost" onClick={() => simulate.reset()}>
                                    <RotateCcw size={14} />
                                    Clear
                                </Button>
                            )}
                        </div>

                        {simulate.isError && (
                            <p className="rounded-xl bg-[#ffebeb] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#c81f30] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                                {(simulate.error as Error).message}
                            </p>
                        )}
                    </Panel>

                    {/* Result. */}
                    {result && (
                        <Panel
                            title="Result"
                            action={
                                <div className="flex items-center gap-2">
                                    <Pill tone={result.dryRun ? 'neutral' : 'brand'}>
                                        {result.dryRun ? 'Dry run' : 'Live'}
                                    </Pill>
                                    <Pill
                                        tone={
                                            result.outcome === 'DECLINED' || result.outcome === 'FAILED'
                                                ? 'danger'
                                                : result.outcome === 'PENDING'
                                                  ? 'warning'
                                                  : 'success'
                                        }
                                    >
                                        {result.outcome}
                                    </Pill>
                                </div>
                            }
                            bodyClassName="p-4 space-y-4"
                        >
                            <p className="text-[13.5px] leading-relaxed text-[#1c1c24] dark:text-[#e4e5eb]">
                                {result.message}
                            </p>

                            {result.balanceBefore !== null && result.balanceAfter !== null && (
                                <div className="flex items-center gap-3 rounded-xl bg-[#fafafb] px-3.5 py-2.5 text-[12.5px] dark:bg-white/[0.03]">
                                    <span className="text-[#81858c]">Wallet</span>
                                    <span className="font-bold text-[#111116] dark:text-white">
                                        {formatMoney(result.balanceBefore)}
                                    </span>
                                    <span className="text-[#a8aab1]">→</span>
                                    <span className="font-bold text-[#111116] dark:text-white">
                                        {formatMoney(result.balanceAfter)}
                                    </span>
                                </div>
                            )}

                            {/* Processor trace. */}
                            <div>
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]">
                                    Processor trace
                                </p>
                                <ol className="space-y-1.5">
                                    {result.trace.map((step, index) => {
                                        const Icon = TRACE_ICONS[step.status]
                                        return (
                                            <li key={`${step.step}-${index}`} className="flex items-start gap-2.5">
                                                <span
                                                    className={cn(
                                                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                                        step.status === 'PASS'
                                                            ? 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                                            : step.status === 'FAIL'
                                                              ? 'bg-[#ffebeb] text-[#e0293c] dark:bg-[#3c151a] dark:text-[#ff7a87]'
                                                              : 'bg-[#f2f2f4] text-[#9a9ca4] dark:bg-white/[0.06]'
                                                    )}
                                                >
                                                    <Icon size={11} strokeWidth={3} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="text-[12.5px] font-bold text-[#1c1c24] dark:text-[#e4e5eb]">
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

                            {/* Diagnosis. */}
                            {result.diagnostic && (
                                <div className="rounded-2xl border border-[#e0293c]/25 bg-[#fff8f8] p-3.5 dark:border-[#e0293c]/25 dark:bg-[#e0293c]/[0.05]">
                                    <div className="flex items-center gap-2">
                                        <CircleSlash size={14} className="text-[#e0293c] dark:text-[#ff7a87]" />
                                        <p className="text-[13px] font-extrabold text-[#111116] dark:text-white">
                                            {result.diagnostic.title}
                                        </p>
                                        <span className="font-mono text-[10.5px] text-[#a8aab1]">
                                            {result.diagnostic.code}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-[12.5px] leading-relaxed text-[#4a4d55] dark:text-[#b9bbc2]">
                                        {result.diagnostic.explanation}
                                    </p>
                                    <p className="mt-2 text-[12px] leading-relaxed text-[#4b249f] dark:text-[#c8b3ff]">
                                        <span className="font-bold">Do this: </span>
                                        {result.diagnostic.remedy}
                                    </p>
                                </div>
                            )}

                            {/* Payload. */}
                            <details className="group">
                                <summary className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-[#81858c] transition-colors hover:text-[#1c1c24] dark:hover:text-white">
                                    <Terminal size={13} />
                                    Provider payload this scenario mimics
                                </summary>
                                <pre className="mt-2.5 overflow-x-auto rounded-xl bg-[#0d0d11] p-3.5 font-mono text-[11px] leading-relaxed text-[#b9bbc2]">
                                    {JSON.stringify(result.payloadPreview, null, 2)}
                                </pre>
                            </details>

                            {result.txId && (
                                <p className="font-mono text-[11px] text-[#a8aab1]">Ledger id {result.txId}</p>
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    )
}
