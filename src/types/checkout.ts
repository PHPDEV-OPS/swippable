/**
 * The test merchant checkout contract.
 *
 * A checkout is a real charge against a real card, so its result carries the
 * same processor decline code and diagnosis the command center shows - the two
 * surfaces read the same catalogue.
 */
import type { Decimal } from '@/lib/money'
import type { DeclineCode, DeclineDiagnostic } from '@/types/admin'
import type { Currency } from '@/types/api'

export interface CheckoutRequest {
    cardNumber: string
    expiry?: string
    cvv?: string
    amount: Decimal | number
    currency?: Currency
    merchant?: string
    /** ISO-3166 alpha-2. Some are blocked by the issuer. */
    merchantCountry?: string
}

export interface CheckoutResponse {
    outcome: 'APPROVED' | 'DECLINED'
    txId: string
    amount: Decimal
    currency: string
    merchant: string
    last4: string
    message: string
    declineCode: DeclineCode | null
    diagnostic: DeclineDiagnostic | null
    /** The cardholder's wallet balance after the attempt. */
    balanceAfter: Decimal
    /** What is left on the card's allocation after the attempt. */
    cardAvailableAfter: Decimal
    trace: Array<{ step: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail: string }>
    authorisedAt: string
}

/** A card the signed-in caller is allowed to charge. */
export interface CheckoutCard {
    cardId: string
    last4: string
    maskedPan: string
    brand: string
    holder: string
    expiry: string
    status: string
    expired: boolean
    available: Decimal
    limit: Decimal
}
