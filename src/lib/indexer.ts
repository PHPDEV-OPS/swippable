import 'server-only'

/**
 * Registers deposit addresses with a hosted chain indexer.
 *
 * A derived address is invisible until something is watching it. Rather than
 * run our own node or poll Base on a cron, we hand each new address to a hosted
 * "address activity" webhook - the provider watches the chain and POSTs
 * /api/webhooks/crypto when USDC arrives.
 *
 * Alchemy Notify is the default because its free tier covers this shape of use
 * and its webhook payload is already one of the formats the crypto webhook
 * normalises. The whole module is optional: with no credentials configured it
 * reports "skipped" and provisioning still succeeds, because an address is
 * valid and receivable whether or not anyone is listening yet. What you lose is
 * automatic crediting, not the deposit itself - an unwatched transfer can still
 * be settled later by the user declaring the tx hash, or by an admin.
 */

const ALCHEMY_TOKEN = process.env.ALCHEMY_NOTIFY_TOKEN?.trim()
const ALCHEMY_WEBHOOK_ID = process.env.ALCHEMY_WEBHOOK_ID?.trim()
const ALCHEMY_API = 'https://dashboard.alchemy.com/api/update-webhook-addresses'

export function isIndexerConfigured(): boolean {
    return Boolean(ALCHEMY_TOKEN && ALCHEMY_WEBHOOK_ID)
}

export type IndexerResult = { status: 'registered' | 'skipped' | 'failed'; detail?: string }

/**
 * Adds one address to the watched set.
 *
 * Never throws: a failure to register is logged and reported, but must not
 * prevent the address from being issued to the user. Callers treat the result
 * as advisory.
 */
export async function watchDepositAddress(address: string): Promise<IndexerResult> {
    if (!isIndexerConfigured()) return { status: 'skipped', detail: 'indexer not configured' }

    try {
        const response = await fetch(ALCHEMY_API, {
            method: 'PATCH',
            headers: {
                'X-Alchemy-Token': ALCHEMY_TOKEN!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                webhook_id: ALCHEMY_WEBHOOK_ID,
                addresses_to_add: [address],
                addresses_to_remove: [],
            }),
            cache: 'no-store',
        })

        if (!response.ok) {
            const detail = `alchemy responded ${response.status}`
            console.error('[indexer] could not register address', address, detail)
            return { status: 'failed', detail }
        }

        return { status: 'registered' }
    } catch (error) {
        const detail = (error as Error).message
        console.error('[indexer] registration request failed', address, detail)
        return { status: 'failed', detail }
    }
}
