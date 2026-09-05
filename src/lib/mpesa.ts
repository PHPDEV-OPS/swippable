import { decimal, toMinor, type Decimal } from '@/lib/money'

/**
 * Safaricom Daraja (M-Pesa) STK push client.
 *
 * Like the Flutterwave client this reports itself unconfigured instead of
 * throwing, so a deployment without Daraja keys still records the deposit
 * intent in the ledger and can be settled by the webhook or a manual credit.
 */

const BASE = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke'
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET
const SHORTCODE = process.env.MPESA_SHORTCODE
const PASSKEY = process.env.MPESA_PASSKEY

export function isMpesaConfigured(): boolean {
    return Boolean(CONSUMER_KEY && CONSUMER_SECRET && SHORTCODE && PASSKEY)
}

export class MpesaError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'MpesaError'
    }
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value

    const basic = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64')
    const response = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${basic}` },
        cache: 'no-store',
    })

    if (!response.ok) throw new MpesaError(`Daraja auth failed (${response.status})`)

    const data = (await response.json()) as { access_token: string; expires_in?: string }
    cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + Number(data.expires_in ?? 3599) * 1000,
    }
    return cachedToken.value
}

/** Daraja timestamps are `YYYYMMDDHHmmss` in East Africa Time. */
function darajaTimestamp(now = new Date()): string {
    const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
        `${eat.getUTCFullYear()}${pad(eat.getUTCMonth() + 1)}${pad(eat.getUTCDate())}` +
        `${pad(eat.getUTCHours())}${pad(eat.getUTCMinutes())}${pad(eat.getUTCSeconds())}`
    )
}

/** Normalises 07…, +2547…, 2547… to the 2547XXXXXXXX Daraja expects. */
export function normalisePhone(input: string): string | null {
    const digits = input.replace(/\D/g, '')
    if (digits.startsWith('254') && digits.length === 12) return digits
    if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
    if (digits.length === 9) return `254${digits}`
    return null
}

export interface StkPushResult {
    merchantRequestId: string
    checkoutRequestId: string
    customerMessage: string
}

export async function initiateStkPush(input: {
    phone: string
    amount: Decimal
    reference: string
    description: string
    callbackUrl: string
}): Promise<StkPushResult> {
    if (!isMpesaConfigured()) throw new MpesaError('M-Pesa credentials are not configured')

    const timestamp = darajaTimestamp()
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64')

    // Daraja only accepts whole shillings.
    const whole = (toMinor(input.amount) / 100n).toString()

    const response = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: whole,
            PartyA: input.phone,
            PartyB: SHORTCODE,
            PhoneNumber: input.phone,
            CallBackURL: input.callbackUrl,
            AccountReference: input.reference.slice(0, 12),
            TransactionDesc: input.description.slice(0, 13),
        }),
        cache: 'no-store',
    })

    const data = (await response.json().catch(() => null)) as
        | {
              MerchantRequestID?: string
              CheckoutRequestID?: string
              CustomerMessage?: string
              errorMessage?: string
              ResponseCode?: string
          }
        | null

    if (!response.ok || !data?.CheckoutRequestID) {
        throw new MpesaError(data?.errorMessage ?? `STK push failed (${response.status})`)
    }

    return {
        merchantRequestId: data.MerchantRequestID ?? '',
        checkoutRequestId: data.CheckoutRequestID,
        customerMessage: data.CustomerMessage ?? 'Check your phone to authorise the payment.',
    }
}

export interface StkCallback {
    checkoutRequestId: string
    merchantRequestId: string
    success: boolean
    resultCode: number
    resultDesc: string
    amount: Decimal | null
    receipt: string | null
    phone: string | null
}

interface CallbackItem {
    Name: string
    Value?: string | number
}

/** Flattens Daraja's nested `stkCallback` envelope into a flat result. */
export function parseStkCallback(body: unknown): StkCallback | null {
    const callback = (body as { Body?: { stkCallback?: Record<string, any> } })?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) return null

    const items: CallbackItem[] = callback.CallbackMetadata?.Item ?? []
    const pick = (name: string) => items.find((item) => item.Name === name)?.Value

    const amount = pick('Amount')
    const receipt = pick('MpesaReceiptNumber')
    const phone = pick('PhoneNumber')

    return {
        checkoutRequestId: String(callback.CheckoutRequestID),
        merchantRequestId: String(callback.MerchantRequestID ?? ''),
        resultCode: Number(callback.ResultCode),
        resultDesc: String(callback.ResultDesc ?? ''),
        success: Number(callback.ResultCode) === 0,
        amount: amount === undefined ? null : decimal(amount as number),
        receipt: receipt === undefined ? null : String(receipt),
        phone: phone === undefined ? null : String(phone),
    }
}
