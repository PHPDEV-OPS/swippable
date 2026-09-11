'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertTriangle,
    BadgeCheck,
    Check,
    Copy,
    Link2,
    Loader2,
    Plus,
    Star,
    Unlink,
    Wallet as WalletIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useLinkWallet, useSetPrimaryWallet, useUnlinkWallet } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import type { LinkedWallet } from '@/types/api'

/**
 * The addresses that can receive USDC for this account.
 *
 * A user reaches this list two ways, and the difference is worth showing rather
 * than flattening: signing in with a Base account or Coinbase Wallet means
 * Clerk made them sign a nonce, so the address is *proved*; connecting a wallet
 * in-app or typing one is a weaker claim. Both can receive, but only the first
 * is marked verified, because that is the honest description of what we know.
 */

const SOURCE_COPY: Record<LinkedWallet['source'], { label: string; hint: string }> = {
    clerk: { label: 'Signed in with this wallet', hint: 'Ownership proved by signature at sign-in' },
    wallet_connect: { label: 'Connected in-app', hint: 'Connected from this browser' },
    manual: { label: 'Added manually', hint: 'Entered by hand' },
    deposit_address: {
        label: 'Your Swippable deposit address',
        hint: 'Issued to you for receiving USDC — cannot be unlinked',
    },
}

function shorten(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function WalletRow({
    wallet,
    onSetPrimary,
    onUnlink,
    busy,
}: {
    wallet: LinkedWallet
    onSetPrimary: () => void
    onUnlink: () => void
    busy: boolean
}) {
    const [copied, setCopied] = useState(false)
    const source = SOURCE_COPY[wallet.source]

    return (
        <div
            className={cn(
                'rounded-2xl border p-4 transition-colors',
                wallet.isPrimary
                    ? 'border-[#7042f4]/40 bg-[#f8f5ff] dark:border-[#7042f4]/40 dark:bg-[#7042f4]/[0.08]'
                    : 'border-black/[0.06] dark:border-white/[0.08]'
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            wallet.verified
                                ? 'bg-[#e7faf4] text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]'
                                : 'bg-[#f2f2f4] text-[#81858c] dark:bg-white/[0.07]'
                        )}
                    >
                        <WalletIcon size={16} />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[13px] font-bold text-[#1c1c24] dark:text-white">
                                {shorten(wallet.address)}
                            </span>
                            {wallet.isPrimary && (
                                <span className="rounded-full bg-[#7042f4] px-2 py-0.5 text-[10px] font-bold text-white">
                                    Receiving
                                </span>
                            )}
                            {wallet.verified && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e7faf4] px-2 py-0.5 text-[10px] font-bold text-[#0d8f70] dark:bg-[#0b3c32] dark:text-[#28d6aa]">
                                    <BadgeCheck size={10} />
                                    Verified
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-[#81858c]">
                            {source.label} · {wallet.chain === 'base' ? 'Base' : wallet.chain}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#a8aab1]">{source.hint}</p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard?.writeText(wallet.address)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1400)
                        }}
                        className="cursor-pointer rounded-lg p-2 text-[#81858c] transition-colors hover:bg-black/[0.04] hover:text-[#1c1c24] dark:hover:bg-white/[0.07] dark:hover:text-white"
                        aria-label="Copy address"
                    >
                        {copied ? <Check size={14} className="text-[#12b88f]" /> : <Copy size={14} />}
                    </button>

                    {!wallet.isPrimary && (
                        <button
                            type="button"
                            onClick={onSetPrimary}
                            disabled={busy}
                            className="cursor-pointer rounded-lg p-2 text-[#81858c] transition-colors hover:bg-black/[0.04] hover:text-[#7042f4] disabled:opacity-50 dark:hover:bg-white/[0.07]"
                            aria-label="Set as receiving address"
                            title="Set as receiving address"
                        >
                            <Star size={14} />
                        </button>
                    )}

                    {/*
                      The platform-derived deposit address has no unlink
                      control: it is the destination on the user's QR code, and
                      the API refuses to remove it. Showing a button that always
                      fails would be worse than showing none.
                    */}
                    {wallet.source !== 'deposit_address' && (
                        <button
                            type="button"
                            onClick={onUnlink}
                            disabled={busy}
                            className="cursor-pointer rounded-lg p-2 text-[#81858c] transition-colors hover:bg-[#ffebeb] hover:text-[#ef5362] disabled:opacity-50 dark:hover:bg-[#3c151a]"
                            aria-label="Unlink address"
                            title="Unlink"
                        >
                            <Unlink size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function LinkedWallets({ wallets, loading }: { wallets: LinkedWallet[]; loading: boolean }) {
    const { isConnected } = useAccount()
    const { connect, connectors, isPending: connecting } = useConnect()
    const linkWallet = useLinkWallet()
    const setPrimary = useSetPrimaryWallet()
    const unlink = useUnlinkWallet()

    const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null)
    const busy = setPrimary.isPending || unlink.isPending || linkWallet.isPending

    const error =
        (linkWallet.error as Error | null)?.message ??
        (unlink.error as Error | null)?.message ??
        (setPrimary.error as Error | null)?.message ??
        null

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[24px] border border-black/[0.04] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] dark:border-white/[0.06] dark:bg-[#121214] dark:shadow-none sm:p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold tracking-tight text-[#1c1c24] dark:text-white">
                        Crypto deposit addresses
                    </h2>
                    <p className="mt-1 text-xs text-[#81858c]">
                        USDC sent to any of these on Base is credited to your wallet automatically.
                    </p>
                </div>

                {!isConnected && (
                    <button
                        type="button"
                        disabled={connecting || connectors.length === 0}
                        onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-50"
                    >
                        {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Connect a wallet
                    </button>
                )}
            </div>

            {loading ? (
                <p className="flex items-center gap-2 py-8 text-xs text-[#81858c]">
                    <Loader2 size={14} className="animate-spin" />
                    Loading your addresses
                </p>
            ) : wallets.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-black/[0.1] p-5 text-center dark:border-white/[0.12]">
                    <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f4] text-[#81858c] dark:bg-white/[0.06]">
                        <Link2 size={17} />
                    </span>
                    <p className="text-[13px] font-bold text-[#1c1c24] dark:text-white">No address linked yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-[#81858c]">
                        Sign in with a Base account or Coinbase Wallet and your address is linked automatically — no
                        extra step. Or connect a wallet here if you signed in with email.
                    </p>
                </div>
            ) : (
                <div className="mt-5 space-y-2.5">
                    {wallets.map((wallet) => (
                        <WalletRow
                            key={wallet.address}
                            wallet={wallet}
                            busy={busy}
                            onSetPrimary={() => setPrimary.mutate(wallet.address)}
                            onUnlink={() => setConfirmUnlink(wallet.address)}
                        />
                    ))}
                </div>
            )}

            {error && (
                <p className="mt-4 rounded-xl bg-[#ffebeb] px-3.5 py-2.5 text-[12px] font-semibold text-[#c81f30] dark:bg-[#3c151a] dark:text-[#ff7a87]">
                    {error}
                </p>
            )}

            {wallets.length > 0 && (
                <p className="mt-4 text-[11px] leading-relaxed text-[#a8aab1]">
                    Only send USDC on <span className="font-bold">Base</span>. Transfers on other networks, or of other
                    tokens, cannot be credited automatically.
                </p>
            )}

            {/* Unlink confirmation. */}
            <AnimatePresence>
                {confirmUnlink && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                        onClick={() => setConfirmUnlink(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-2xl dark:bg-[#121214]"
                        >
                            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff4e5] text-[#b06f00] dark:bg-[#3a2a08] dark:text-[#ffb84d]">
                                <AlertTriangle size={22} />
                            </span>
                            <h3 className="text-base font-bold text-[#1c1c24] dark:text-white">Unlink this address?</h3>
                            <p className="mt-2 text-[12.5px] leading-relaxed text-[#81858c]">
                                Past deposits keep their history. But anything sent to{' '}
                                <span className="font-mono font-bold">{shorten(confirmUnlink)}</span> afterwards will
                                arrive unattributed and need support to reconcile it by hand.
                            </p>

                            <div className="mt-5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmUnlink(null)}
                                    className="flex-1 cursor-pointer rounded-full border border-black/[0.1] py-2.5 text-xs font-bold text-[#3f4149] transition-colors hover:bg-black/[0.03] dark:border-white/[0.12] dark:text-[#b9bbc2] dark:hover:bg-white/[0.05]"
                                >
                                    Keep it
                                </button>
                                <button
                                    type="button"
                                    disabled={unlink.isPending}
                                    onClick={() =>
                                        unlink.mutate(confirmUnlink, { onSuccess: () => setConfirmUnlink(null) })
                                    }
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#e0293c] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#c81f30] disabled:opacity-50"
                                >
                                    {unlink.isPending && <Loader2 size={13} className="animate-spin" />}
                                    Unlink
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
