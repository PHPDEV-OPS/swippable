import QRCode from 'qrcode'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { HttpError, withRouteErrors } from '@/lib/http'
import { listCryptoWallets } from '@/lib/db'
import {
    buildDepositUri,
    DEPOSIT_CHAIN_ID,
    ensureDepositAddress,
    isDepositAddressConfigured,
    USDC_CONTRACT,
} from '@/lib/deposit-address'
import { isIndexerConfigured } from '@/lib/indexer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The user's USDC deposit destination, plus a scannable QR code.
 *
 * The QR is rendered server-side as an inline SVG rather than shipping a QR
 * library to the browser: it is a few hundred bytes of markup, it scales
 * without blurring, and the address it encodes is produced by the same code
 * path that stored it - so what the user scans cannot drift from what the
 * webhook will credit.
 *
 * `?amount=` optionally pre-fills the transfer value in the wallet app.
 */
export const GET = withRouteErrors('wallet:deposit-address', async (request: Request) => {
    const user = await requireUser()

    if (!isDepositAddressConfigured()) {
        throw new HttpError(
            503,
            'Crypto deposits are not available yet - no deposit wallet is configured.',
            'DEPOSITS_UNCONFIGURED'
        )
    }

    const address = await ensureDepositAddress(user.id)
    if (!address) {
        throw new HttpError(503, 'Could not allocate a deposit address.', 'DEPOSITS_UNAVAILABLE')
    }

    const requested = new URL(request.url).searchParams.get('amount')
    const amount = requested && /^\d+(\.\d{1,6})?$/.test(requested) ? requested : null

    const uri = buildDepositUri(address, amount)

    const qrSvg = await QRCode.toString(uri, {
        type: 'svg',
        margin: 1,
        // Medium recovery: enough redundancy for a phone camera at an angle
        // without inflating the module count and making it hard to scan small.
        errorCorrectionLevel: 'M',
    })

    // Addresses the user linked themselves. Shown alongside so someone who
    // already connected a wallet can see they may simply send from it.
    const linked = await listCryptoWallets(user.id)

    return NextResponse.json({
        address,
        uri,
        qrSvg,
        network: DEPOSIT_CHAIN_ID === 8453 ? 'Base' : 'Base Sepolia',
        chainId: DEPOSIT_CHAIN_ID,
        asset: 'USDC',
        tokenContract: USDC_CONTRACT,
        /**
         * False means nothing is watching the chain for this address, so a
         * transfer will land on-chain but will not credit automatically. The UI
         * uses this to tell the user their deposit may need confirming rather
         * than letting them wonder why the balance never moved.
         */
        autoCrediting: isIndexerConfigured(),
        linkedWallets: linked
            .filter((wallet) => wallet.source !== 'deposit_address')
            .map((wallet) => ({
                address: wallet.base_account_address,
                verified: Boolean(wallet.verified),
                isPrimary: Boolean(wallet.is_primary),
            })),
    })
})
