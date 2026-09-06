import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, HttpError, readJson, withRouteErrors } from '@/lib/http'
import { creditWallet, findUserById, recordTransaction } from '@/lib/db'
import { convertToUsd } from '@/lib/fx'
import { decimal, formatMoney, isPositive } from '@/lib/money'
import { initiateStkPush, isMpesaConfigured, MpesaError, normalisePhone } from '@/lib/mpesa'
import { getAccountStatus } from '@/lib/admin-db'
import { assertRailOpen } from '@/lib/platform'
import type { DepositRequest } from '@/types/api'

export const dynamic = 'force-dynamic'

/**
 * Tops the shared wallet up.
 *
 * M-Pesa: fires an STK push and writes a PENDING ledger row keyed by the
 * Daraja CheckoutRequestID. The wallet balance only moves when the Daraja
 * callback confirms the payment, so an abandoned prompt never credits anyone.
 *
 * Crypto: records the declared on-chain deposit as PENDING and waits for the
 * confirmation webhook, for the same reason.
 */
export const POST = withRouteErrors('wallet:deposit', async (request: Request) => {
    const user = await requireUser()
    const body = await readJson<DepositRequest>(request)

    const amount = decimal(body.amount)
    if (!isPositive(amount)) {
        badRequest('Deposit amount must be greater than zero', 'INVALID_AMOUNT')
    }

    // A frozen or banned account may not move money on any rail.
    const accountStatus = await getAccountStatus(user.id)
    if (accountStatus !== 'ACTIVE') {
        throw new HttpError(
            403,
            accountStatus === 'FROZEN'
                ? 'Your account is frozen, so deposits are paused. Please contact support.'
                : 'This account is closed and can no longer receive deposits.',
            'ACCOUNT_RESTRICTED'
        )
    }

    if (body.channel === 'MPESA') {
        // Throws a 503 if the founders have halted this rail from the command center.
        await assertRailOpen('MPESA_DEPOSITS')
        return handleMpesa(user.id, amount, body)
    }
    if (body.channel === 'CRYPTO') {
        await assertRailOpen('CRYPTO_DEPOSITS')
        return handleCrypto(user.id, amount, body)
    }

    return badRequest('Unsupported deposit channel', 'INVALID_CHANNEL')
})

async function handleMpesa(userId: number, amount: string, body: DepositRequest) {
    const phone = body.phone ? normalisePhone(body.phone) : null
    if (!phone) {
        badRequest('A valid Kenyan phone number is required for M-Pesa deposits', 'INVALID_PHONE')
    }

    // The user enters shillings; the wallet is held in USD.
    const currency = (body.currency ?? 'KES').toUpperCase()
    const { amount: usdAmount, rate } = await convertToUsd(amount, currency)

    if (!isMpesaConfigured()) {
        throw new HttpError(
            503,
            'M-Pesa deposits are not available yet - Daraja credentials are not configured.',
            'MPESA_UNCONFIGURED'
        )
    }

    const reference = `swp${Date.now().toString(36)}`
    const callbackUrl =
        process.env.MPESA_CALLBACK_URL ??
        `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/mpesa`

    if (!callbackUrl.startsWith('http')) {
        throw new HttpError(
            503,
            'M-Pesa deposits are not available yet - no public callback URL is configured.',
            'MPESA_NO_CALLBACK'
        )
    }

    let push
    try {
        push = await initiateStkPush({
            phone,
            amount,
            reference,
            description: 'Wallet top up',
            callbackUrl,
        })
    } catch (error) {
        if (error instanceof MpesaError) {
            throw new HttpError(502, `M-Pesa could not start the payment: ${error.message}`, 'MPESA_FAILED')
        }
        throw error
    }

    // Keyed by CheckoutRequestID so the callback can find this exact row.
    await recordTransaction({
        txId: `mpesa_${push.checkoutRequestId}`,
        userId,
        amount: usdAmount,
        currency: 'USD',
        type: 'CREDIT',
        channel: 'MPESA',
        status: 'PENDING',
        merchant: `M-Pesa top up • ${phone.slice(-4)}`,
        category: 'M-Pesa Deposit',
        metadata: {
            phone,
            reference,
            requestedAmount: amount,
            requestedCurrency: currency,
            fxRateKesPerUsd: rate,
            merchantRequestId: push.merchantRequestId,
            checkoutRequestId: push.checkoutRequestId,
        },
    })

    return NextResponse.json({
        status: 'PENDING',
        channel: 'MPESA',
        message: push.customerMessage,
        checkoutRequestId: push.checkoutRequestId,
        creditedAmount: usdAmount,
        fxRateKesPerUsd: rate,
    })
}

async function handleCrypto(userId: number, amount: string, body: DepositRequest) {
    const txHash = body.txHash?.trim()
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        badRequest('A valid on-chain transaction hash is required', 'INVALID_TX_HASH')
    }

    const txId = `crypto_${txHash.toLowerCase()}`

    const recorded = await recordTransaction({
        txId,
        userId,
        amount,
        currency: 'USD',
        type: 'CREDIT',
        channel: 'CRYPTO',
        status: 'PENDING',
        merchant: 'USDC deposit • Base',
        category: 'Crypto Deposit',
        metadata: { txHash, address: body.address ?? null, asset: 'USDC', network: 'base' },
        txHash,
    })

    if (!recorded) {
        // Already submitted - report the settled state rather than duplicating.
        return NextResponse.json(
            { status: 'DUPLICATE', message: 'That transaction hash has already been submitted.' },
            { status: 409 }
        )
    }

    // Without a confirmation service configured we leave the row PENDING; the
    // crypto webhook settles it once the transfer has enough confirmations.
    return NextResponse.json({
        status: 'PENDING',
        channel: 'CRYPTO',
        message: 'Deposit recorded. Your balance updates once the transfer is confirmed on Base.',
        creditedAmount: amount,
    })
}

/**
 * Development-only manual settlement, so the full ledger can be exercised
 * without a public webhook tunnel. Disabled outside development.
 */
export const PUT = withRouteErrors('wallet:deposit:simulate', async (request: Request) => {
    if (process.env.NODE_ENV === 'production') {
        throw new HttpError(404, 'Not found')
    }

    const user = await requireUser()
    const { amount, channel } = await readJson<{ amount?: string; channel?: string }>(request)

    const value = decimal(amount)
    if (!isPositive(value)) badRequest('Amount must be greater than zero', 'INVALID_AMOUNT')

    const result = await creditWallet({
        txId: `devcredit_${randomUUID()}`,
        userId: user.id,
        amount: value,
        currency: 'USD',
        type: 'CREDIT',
        channel: channel === 'CRYPTO' ? 'CRYPTO' : 'MPESA',
        status: 'SUCCESS',
        merchant: 'Sandbox top up',
        category: channel === 'CRYPTO' ? 'Crypto Deposit' : 'M-Pesa Deposit',
        metadata: { simulated: true },
    })

    const updated = await findUserById(user.id)

    return NextResponse.json({
        status: 'SUCCESS',
        credited: value,
        balance: decimal(updated?.wallet_balance ?? 0),
        message: `Credited ${formatMoney(value)} to your wallet.`,
        ledgerId: result?.id ?? null,
    })
})
