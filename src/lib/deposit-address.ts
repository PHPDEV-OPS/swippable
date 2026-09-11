import 'server-only'

import { randomUUID } from 'node:crypto'
import { mnemonicToAccount } from 'viem/accounts'
import { getDepositAddress, provisionDepositAddress } from '@/lib/db'
import { watchDepositAddress } from '@/lib/indexer'

/**
 * Per-user USDC deposit addresses on Base.
 *
 * Every user gets their own receiving address, derived deterministically from
 * one master mnemonic via BIP-44 (`m/44'/60'/0'/0/{index}`) with the user's row
 * id as the index. Deterministic derivation means we never store a private key
 * anywhere: the address can always be re-derived, and losing the database costs
 * us records but not custody.
 *
 * Why a dedicated address per user rather than one shared address: an incoming
 * USDC transfer carries no memo field, so a shared address makes it impossible
 * to tell whose money arrived. A distinct destination per user turns
 * attribution into a lookup, which is exactly what the crypto webhook already
 * does via `getWalletAddressOwner`.
 *
 * CUSTODY WARNING: whoever holds `DEPOSIT_MASTER_MNEMONIC` controls every
 * user's deposits. It must live in a secret manager (or a KMS-backed signer) -
 * never in the repository, and never in a client bundle. The `server-only`
 * import above enforces the second half of that.
 */

const MNEMONIC = process.env.DEPOSIT_MASTER_MNEMONIC?.trim()

/** Base mainnet. Override for Base Sepolia during testing. */
export const DEPOSIT_CHAIN_ID = Number(process.env.DEPOSIT_CHAIN_ID ?? 8453)

/**
 * USDC contract on the deposit chain. Defaults to canonical USDC on Base
 * mainnet; set DEPOSIT_USDC_ADDRESS when pointing at a testnet.
 */
export const USDC_CONTRACT =
    process.env.DEPOSIT_USDC_ADDRESS?.trim() || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/** USDC is a 6-decimal token, not 18. Getting this wrong misprices by 10^12. */
export const USDC_DECIMALS = 6

export function isDepositAddressConfigured(): boolean {
    return Boolean(MNEMONIC)
}

export class DepositAddressError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DepositAddressError'
    }
}

/**
 * Derives the deposit address for a user.
 *
 * The index is the user's primary key: unique, stable for the life of the
 * account, and never reused even after a deletion, so two users can never be
 * handed the same address.
 */
export function deriveDepositAddress(userId: number): { address: string; index: number } {
    if (!MNEMONIC) {
        throw new DepositAddressError('Deposit addresses are not configured')
    }
    if (!Number.isInteger(userId) || userId < 0) {
        throw new DepositAddressError(`Invalid derivation index: ${userId}`)
    }
    // BIP-44 indices must stay below 2^31 (the hardened boundary). Our ids will
    // not realistically get there, but deriving past it would silently produce
    // a different path than intended.
    if (userId >= 2 ** 31) {
        throw new DepositAddressError('Derivation index out of range')
    }

    const account = mnemonicToAccount(MNEMONIC, { addressIndex: userId })
    return { address: account.address, index: userId }
}

/**
 * Builds the EIP-681 payment URI that a wallet app reads from the QR code.
 *
 * Encoded as an ERC-20 `transfer` against the USDC contract rather than a plain
 * address, so a scanning wallet pre-fills the token, the chain and the
 * recipient. A bare address would leave the user to pick the asset themselves,
 * which is how people send the wrong token to the right address.
 *
 * `amount` is optional - omitted, the wallet asks the user how much to send.
 */
export function buildDepositUri(address: string, amount?: string | null): string {
    const base = `ethereum:${USDC_CONTRACT}@${DEPOSIT_CHAIN_ID}/transfer?address=${address}`
    if (!amount) return base

    const units = toUsdcUnits(amount)
    return units ? `${base}&uint256=${units}` : base
}

/** Converts a decimal USDC string to integer base units, without float error. */
export function toUsdcUnits(amount: string): string | null {
    const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim())
    if (!match) return null

    const whole = BigInt(match[1])
    const fraction = BigInt((match[2] ?? '').padEnd(USDC_DECIMALS, '0'))
    return (whole * 10n ** BigInt(USDC_DECIMALS) + fraction).toString()
}

/**
 * Derives, stores and starts watching a user's deposit address.
 *
 * Idempotent: safe to call on every authenticated request. Returns null rather
 * than throwing when deposit addresses are not configured, so callers can treat
 * the feature as simply unavailable instead of broken.
 */
export async function ensureDepositAddress(userId: number): Promise<string | null> {
    if (!isDepositAddressConfigured()) return null

    const existing = await getDepositAddress(userId)
    if (existing) return existing.base_account_address

    const { address, index } = deriveDepositAddress(userId)

    const row = await provisionDepositAddress({
        userId,
        walletId: `dep_${userId}_${randomUUID()}`,
        address,
        derivationIndex: index,
        chain: DEPOSIT_CHAIN_ID === 8453 ? 'base' : 'base-sepolia',
    })

    // Advisory: an unwatched address still receives funds, so a registration
    // failure must not undo the provisioning we just committed.
    await watchDepositAddress(row.base_account_address)

    return row.base_account_address
}
