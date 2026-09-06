import { randomUUID } from 'crypto'
import { linkCryptoAddress } from '@/lib/db'

/**
 * Clerk Web3 identities -> linked deposit addresses.
 *
 * Clerk can sign a user in with a Base account or Coinbase Wallet. When it
 * does, it has already made them prove ownership by signing a nonce - which is
 * a far stronger claim than a user typing an address into a form, and it is
 * exactly the claim we need before crediting an inbound transfer to them.
 *
 * So a Web3 sign-in *is* the wallet link: the address is picked up on the first
 * authenticated request and recorded as verified, with no extra step for the
 * user. Connecting a wallet in-app remains available for anyone who signed in
 * by email.
 */

/** The shape Clerk returns on `user.web3Wallets`, narrowed to what we use. */
export interface ClerkWeb3Wallet {
    web3Wallet?: string | null
    verification?: { status?: string | null } | null
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

/**
 * Keeps a user's linked addresses in step with their Clerk Web3 identities.
 *
 * Only *verified* wallets are linked. An unverified entry means Clerk has the
 * address on file but the signature challenge was never completed, and an
 * unproven address must never receive credit.
 *
 * Returns the addresses that were newly linked, which is what the caller needs
 * to decide whether to tell the user anything.
 */
export async function syncClerkWeb3Wallets(input: {
    userId: number
    wallets: ClerkWeb3Wallet[] | undefined
}): Promise<{ linked: string[]; conflicted: string[] }> {
    const linked: string[] = []
    const conflicted: string[] = []

    for (const entry of input.wallets ?? []) {
        const address = entry.web3Wallet?.trim()
        if (!address || !EVM_ADDRESS.test(address)) continue
        if (entry.verification?.status !== 'verified') continue

        const result = await linkCryptoAddress({
            userId: input.userId,
            walletId: randomUUID(),
            address,
            source: 'clerk',
            verified: true,
            label: 'Signed in with this wallet',
        })

        if (result.status === 'LINKED') linked.push(address)
        // Somebody else already owns it. Not fatal to the sign-in, but it must
        // not be silent: an inbound deposit would credit the other account.
        if (result.status === 'TAKEN') {
            conflicted.push(address)
            console.warn(
                `[web3] ${address} is already linked to another account; not linking to user ${input.userId}`
            )
        }
    }

    return { linked, conflicted }
}
