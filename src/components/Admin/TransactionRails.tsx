'use client'

import {
    AlertTriangle,
    Bitcoin,
    CheckCircle2,
    Clock,
    Copy,
    Link2,
    Search,
    Smartphone,
    Wallet,
    XCircle,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAdminTransactions, useIntervene } from '@/lib/admin-client'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AdminTransaction, InterventionRequest } from '@/types/admin'
import {
    Button,
    EmptyState,
    Field,
    OverrideDialog,
    Panel,
    PanelLoader,
    Pill,
    StatusPill,
    TimeAgo,
    inputClass,
} from './primitives'

type Action = { tx: AdminTransaction; action: InterventionRequest['action'] }

function Mono({ children }: { children: React.ReactNode }) {
    return (
        <span className="break-all font-mono text-[11.5px] text-[#81858c]">{children}</span>
    )
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false)
    return (
        <button
            type="button"
            onClick={() => {
                navigator.clipboard?.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
            }}
            className="cursor-pointer rounded-md p-1 text-[#a8aab1] transition-colors hover:bg-[#f2f2f4] hover:text-[#1c1c24] dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Copy"
        >
            {copied ? <CheckCircle2 size={12} className="text-[#12b88f]" /> : <Copy size={12} />}
        </button>
    )
}

/**
 * One stuck deposit, with everything needed to decide about it.
 *
 * The rails differ in what evidence exists - Safaricom gives you a receipt
 * number, a chain gives you a hash and a confirmation count - so each side
 * surfaces its own, but both resolve through the same settlement statement.
 */
function StuckRow({
    tx,
    onAct,
}: {
    tx: AdminTransaction
    onAct: (action: InterventionRequest['action']) => void
}) {
    const isMpesa = tx.channel === 'MPESA'
    const stuck = tx.stuckForMinutes ?? 0
    const urgent = stuck > 30

    const checkoutId = String(tx.metadata?.checkoutRequestId ?? '')
    const phone = String(tx.metadata?.phone ?? '')
    const confirmations = tx.metadata?.confirmations

    return (
        <div
            className={cn(
                'rounded-2xl border p-4 transition-colors',
                urgent
                    ? 'border-[#e0293c]/25 bg-[#fff8f8] dark:border-[#e0293c]/25 dark:bg-[#e0293c]/[0.05]'
                    : 'border-black/[0.06] dark:border-white/[0.08]'
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-extrabold text-[#111116] dark:text-white">
                            {formatMoney(tx.amount, tx.currency)}
                        </p>
                        <StatusPill status={tx.status} />
                        <Pill tone={urgent ? 'danger' : 'warning'}>
                            <Clock size={11} />
                            {stuck < 60 ? `${stuck}m` : `${Math.round(stuck / 60)}h`} pending
                        </Pill>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-[#4a4d55] dark:text-[#b9bbc2]">
                        <Link
                            href={`/admin/users/${tx.userId}`}
                            className="underline decoration-dotted underline-offset-2 hover:text-[#6330cf] dark:hover:text-[#b79bff]"
                        >
                            {tx.userName}
                        </Link>{' '}
                        · {tx.userEmail}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => onAct(isMpesa ? 'FORCE_RECONCILE' : 'COMPLETE_WEBHOOK')}>
                        {isMpesa ? <Wallet size={14} /> : <Link2 size={14} />}
                        {isMpesa ? 'Force manual reconciliation' : 'Complete missed webhook'}
                    </Button>
                    <Button variant="ghost" onClick={() => onAct('FORCE_FAIL')}>
                        <XCircle size={14} />
                        Mark failed
                    </Button>
                </div>
            </div>

            <dl className="mt-3.5 grid gap-x-6 gap-y-2 border-t border-black/[0.05] pt-3.5 text-[12px] sm:grid-cols-2 dark:border-white/[0.07]">
                <div className="flex items-center gap-1.5">
                    <dt className="shrink-0 font-bold text-[#81858c]">Ledger id</dt>
                    <dd className="min-w-0 flex-1">
                        <Mono>{tx.txId}</Mono>
                    </dd>
                    <CopyButton value={tx.txId} />
                </div>

                {isMpesa ? (
                    <>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">CheckoutRequestID</dt>
                            <dd className="min-w-0 flex-1">
                                <Mono>{checkoutId || '—'}</Mono>
                            </dd>
                            {checkoutId && <CopyButton value={checkoutId} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">Phone</dt>
                            <dd>
                                <Mono>{phone || '—'}</Mono>
                            </dd>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">Requested</dt>
                            <dd>
                                <Mono>
                                    {tx.metadata?.requestedAmount
                                        ? `${tx.metadata.requestedAmount} ${tx.metadata.requestedCurrency ?? 'KES'}`
                                        : '—'}
                                </Mono>
                            </dd>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">Tx hash</dt>
                            <dd className="min-w-0 flex-1">
                                <Mono>{tx.txHash ?? '—'}</Mono>
                            </dd>
                            {tx.txHash && <CopyButton value={tx.txHash} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">Confirmations</dt>
                            <dd>
                                <Mono>{confirmations !== undefined ? String(confirmations) : 'none observed'}</Mono>
                            </dd>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <dt className="shrink-0 font-bold text-[#81858c]">Network</dt>
                            <dd>
                                <Mono>
                                    {String(tx.metadata?.asset ?? 'USDC')} on {String(tx.metadata?.network ?? 'base')}
                                </Mono>
                            </dd>
                        </div>
                    </>
                )}

                <div className="flex items-center gap-1.5">
                    <dt className="shrink-0 font-bold text-[#81858c]">Declared</dt>
                    <dd>
                        <Mono>
                            <TimeAgo iso={tx.createdAt} />
                        </Mono>
                    </dd>
                </div>
            </dl>
        </div>
    )
}

function RailSection({
    icon,
    title,
    description,
    accent,
    rows,
    loading,
    onAct,
}: {
    icon: React.ReactNode
    title: string
    description: string
    accent: string
    rows: AdminTransaction[]
    loading: boolean
    onAct: (tx: AdminTransaction, action: InterventionRequest['action']) => void
}) {
    return (
        <Panel bodyClassName="p-4">
            <div className="mb-4 flex items-start gap-3">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white', accent)}>
                    {icon}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14px] font-extrabold text-[#111116] dark:text-white">{title}</h2>
                        <Pill tone={rows.length > 0 ? 'warning' : 'success'}>
                            {rows.length} awaiting action
                        </Pill>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[#81858c]">{description}</p>
                </div>
            </div>

            {loading ? (
                <PanelLoader label="Scanning the rail" />
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={<CheckCircle2 size={18} />}
                    title="Nothing stuck"
                    body="Every deposit on this rail settled through its callback. No intervention needed."
                />
            ) : (
                <div className="space-y-3">
                    {rows.map((tx) => (
                        <StuckRow key={tx.id} tx={tx} onAct={(action) => onAct(tx, action)} />
                    ))}
                </div>
            )}
        </Panel>
    )
}

/**
 * Two-rail intervention.
 *
 * Both rails fail in the same shape: the provider took the money and the
 * callback never arrived, leaving a PENDING row that would otherwise age out
 * and cost the user their deposit. Forcing settlement runs the *same* guarded
 * statement the webhook does, so a manual credit and an automatic one are
 * indistinguishable afterwards - and whichever lands second is a no-op rather
 * than a double credit.
 */
export function TransactionRails() {
    const params = useSearchParams()
    const [search, setSearch] = useState('')
    const [debounced, setDebounced] = useState('')
    const [pending, setPending] = useState<Action | null>(null)
    const [receipt, setReceipt] = useState('')
    const [confirmations, setConfirmations] = useState('')

    useEffect(() => {
        const tx = params?.get('tx')
        if (tx) {
            setSearch(tx)
            setDebounced(tx)
        }
    }, [params])

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search), 250)
        return () => clearTimeout(timer)
    }, [search])

    const stuck = useAdminTransactions({ status: 'PENDING', q: debounced })
    const recent = useAdminTransactions({ q: debounced })
    const intervene = useIntervene()

    const rows = stuck.data ?? []
    const mpesaRows = rows.filter((tx) => tx.channel === 'MPESA')
    const cryptoRows = rows.filter((tx) => tx.channel === 'CRYPTO')
    const settled = (recent.data ?? []).filter((tx) => tx.status !== 'PENDING').slice(0, 20)

    const isMpesa = pending?.tx.channel === 'MPESA'
    const isFail = pending?.action === 'FORCE_FAIL'

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-extrabold tracking-tight text-[#111116] dark:text-white">
                        Transaction rails
                    </h1>
                    <p className="mt-1 text-[13.5px] text-[#5c5f68] dark:text-[#9a9ca4]">
                        Deposits the provider callbacks never closed out.
                    </p>
                </div>

                <div className="relative min-w-[260px]">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8aab1]" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Ledger id, receipt, hash or email"
                        className={cn(inputClass, 'pl-10')}
                    />
                </div>
            </div>

            {rows.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#f5a524]/30 bg-[#fff9ee] p-4 dark:border-[#f5a524]/25 dark:bg-[#f5a524]/[0.06]">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#b06f00] dark:text-[#ffb84d]" />
                    <p className="text-[12.5px] leading-relaxed text-[#7a5200] dark:text-[#ffd08a]">
                        <span className="font-bold">{rows.length} deposit{rows.length === 1 ? '' : 's'} pending.</span>{' '}
                        M-Pesa rows are aged out after 15 minutes and crypto after 6 hours — reconcile before then, or
                        the user loses the deposit and has to be credited manually.
                    </p>
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
                <RailSection
                    icon={<Smartphone size={16} />}
                    title="M-Pesa · STK push callbacks"
                    description="Prompts the user paid but Daraja never confirmed. Reconciling credits the wallet immediately and claims the CheckoutRequestID, so a late genuine callback is dropped as a duplicate."
                    accent="bg-gradient-to-tr from-[#0d8f70] to-[#12b88f]"
                    rows={mpesaRows}
                    loading={stuck.isLoading}
                    onAct={(tx, action) => {
                        setReceipt('')
                        setPending({ tx, action })
                    }}
                />
                <RailSection
                    icon={<Bitcoin size={16} />}
                    title="Crypto · on-chain confirmations"
                    description="Transfers observed on Base whose indexer webhook never landed. Completing it settles against the recorded tx hash."
                    accent="bg-gradient-to-tr from-[#b06f00] to-[#f5a524]"
                    rows={cryptoRows}
                    loading={stuck.isLoading}
                    onAct={(tx, action) => {
                        setConfirmations('')
                        setPending({ tx, action })
                    }}
                />
            </div>

            <Panel title="Recently settled" subtitle="The last 20 closed deposits and card movements" bodyClassName="p-0">
                {recent.isLoading ? (
                    <PanelLoader />
                ) : settled.length === 0 ? (
                    <EmptyState icon={<Wallet size={18} />} title="Nothing settled yet" body="Closed transactions appear here." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse">
                            <thead>
                                <tr className="border-b border-black/[0.05] text-left dark:border-white/[0.07]">
                                    {['Transaction', 'User', 'Channel', 'Amount', 'Status', 'When'].map((heading) => (
                                        <th
                                            key={heading}
                                            className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#81858c]"
                                        >
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {settled.map((tx) => (
                                    <tr
                                        key={tx.id}
                                        className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.05]"
                                    >
                                        <td className="px-4 py-3">
                                            <p className="text-[13px] font-semibold text-[#1c1c24] dark:text-[#e4e5eb]">
                                                {tx.merchant}
                                            </p>
                                            <Mono>{tx.txId}</Mono>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/admin/users/${tx.userId}`}
                                                className="text-[12.5px] text-[#4a4d55] underline decoration-dotted underline-offset-2 hover:text-[#6330cf] dark:text-[#b9bbc2] dark:hover:text-[#b79bff]"
                                            >
                                                {tx.userEmail}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Pill tone="neutral">{tx.channel}</Pill>
                                        </td>
                                        <td
                                            className={cn(
                                                'px-4 py-3 text-[13px] font-bold',
                                                tx.type === 'CREDIT'
                                                    ? 'text-[#0d8f70] dark:text-[#28d6aa]'
                                                    : 'text-[#111116] dark:text-white'
                                            )}
                                        >
                                            {tx.type === 'CREDIT' ? '+' : '−'}
                                            {formatMoney(tx.amount, tx.currency)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={tx.status} />
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[#81858c]">
                                            <TimeAgo iso={tx.createdAt} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            <OverrideDialog
                open={pending !== null}
                onClose={() => setPending(null)}
                destructive={isFail}
                title={
                    isFail
                        ? 'Close this deposit as failed'
                        : isMpesa
                          ? 'Force manual reconciliation'
                          : 'Complete the missed webhook'
                }
                description={
                    isFail
                        ? 'Nothing is credited. Only do this once you have confirmed with the provider that the money never left the user.'
                        : `Credits ${pending ? formatMoney(pending.tx.amount, pending.tx.currency) : ''} to ${pending?.tx.userName}'s wallet through the same statement the webhook uses. If the real callback arrives afterwards it becomes a no-op, so this cannot double-credit.`
                }
                confirmLabel={isFail ? 'Mark failed' : 'Credit the wallet'}
                loading={intervene.isPending}
                error={intervene.error ? (intervene.error as Error).message : null}
                reasonPlaceholder={
                    isMpesa
                        ? 'e.g. Confirmed receipt SFK4H2J9QR in the Safaricom portal'
                        : 'e.g. 14 confirmations verified on Basescan'
                }
                onConfirm={(reason) =>
                    pending &&
                    intervene.mutate(
                        {
                            txId: pending.tx.txId,
                            action: pending.action,
                            reason,
                            ...(receipt ? { mpesaReceipt: receipt } : {}),
                            ...(confirmations ? { confirmations: Number(confirmations) } : {}),
                        },
                        { onSuccess: () => setPending(null) }
                    )
                }
            >
                {!isFail && isMpesa && (
                    <Field label="M-Pesa receipt number" hint="Optional. Stored on the ledger row as proof of payment.">
                        <input
                            value={receipt}
                            onChange={(event) => setReceipt(event.target.value.toUpperCase())}
                            placeholder="SFK4H2J9QR"
                            className={inputClass}
                        />
                    </Field>
                )}
                {!isFail && !isMpesa && (
                    <Field label="Confirmations observed" hint="Optional. Recorded alongside the settlement.">
                        <input
                            type="number"
                            min="0"
                            value={confirmations}
                            onChange={(event) => setConfirmations(event.target.value)}
                            placeholder="12"
                            className={inputClass}
                        />
                    </Field>
                )}
            </OverrideDialog>
        </div>
    )
}
