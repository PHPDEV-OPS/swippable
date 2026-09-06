import type { DeclineCode, DeclineDiagnostic } from '@/types/admin'

/**
 * The decline catalogue.
 *
 * A processor decline reaches us as a terse code. Sitting an operator in front
 * of "51" or "already recorded" costs minutes per incident, so every code is
 * paired here with what actually happened and the concrete next step. The live
 * authorisation path and the simulator both resolve through this table, which
 * is what makes a rehearsed failure indistinguishable from a real one.
 */
export const DECLINE_CATALOGUE: Record<DeclineCode, DeclineDiagnostic> = {
    CARD_NOT_ACTIVE: {
        code: 'CARD_NOT_ACTIVE',
        title: 'Card is not active',
        explanation: 'The card was paused or closed before the authorisation arrived, so no funds were reserved.',
        remedy: 'Open the card in Card Lifecycle and set its status back to ACTIVE, then ask the user to retry.',
        origin: 'CARD',
        severity: 'INFO',
    },
    CARD_LIMIT_EXCEEDED: {
        code: 'CARD_LIMIT_EXCEEDED',
        title: 'Amount exceeds the card allocation',
        explanation:
            'The charge is larger than what is left of this card’s allocation (limit minus lifetime spend). The wallet was never touched.',
        remedy: 'Raise the card limit from the card row, or move capital onto the card, then replay the charge.',
        origin: 'CARD',
        severity: 'INFO',
    },
    INSUFFICIENT_PLATFORM_FLOAT: {
        code: 'INSUFFICIENT_PLATFORM_FLOAT',
        title: 'Insufficient platform float',
        explanation:
            'The issuer settlement pool cannot cover the authorisation. This declines every user on the platform, not just this one.',
        remedy: 'Top up the issuer settlement pool immediately, then reconcile the declined window.',
        origin: 'PLATFORM',
        severity: 'CRITICAL',
    },
    INSUFFICIENT_WALLET_BALANCE: {
        code: 'INSUFFICIENT_WALLET_BALANCE',
        title: 'Wallet balance below the charge',
        explanation:
            'The card allocation was sufficient but the shared wallet behind it was not, so the debit could not be backed.',
        remedy: 'Ask the user to top up, or force-credit the wallet from the User 360 view if a deposit is stuck.',
        origin: 'USER',
        severity: 'INFO',
    },
    BLOCKED_MERCHANT_COUNTRY: {
        code: 'BLOCKED_MERCHANT_COUNTRY',
        title: 'Blocked merchant country',
        explanation:
            'The acquirer country is on the issuer’s blocked list. The charge never reached the balance checks.',
        remedy: 'Confirm the merchant is legitimate, then request a country exemption from the issuer for this BIN.',
        origin: 'PROCESSOR',
        severity: 'WARNING',
    },
    INVALID_CVV: {
        code: 'INVALID_CVV',
        title: 'Invalid CVV',
        explanation: 'The CVV presented at checkout did not match the one held by the issuer.',
        remedy: 'Reveal the card details for the user and have them re-enter the CVV. Repeated failures suggest card testing.',
        origin: 'USER',
        severity: 'WARNING',
    },
    EXPIRED_CARD: {
        code: 'EXPIRED_CARD',
        title: 'Card expired',
        explanation: 'The expiry date on the card has passed, so the issuer rejected the authorisation outright.',
        remedy: 'Issue a replacement card for the user and release the old allocation back to the wallet.',
        origin: 'CARD',
        severity: 'INFO',
    },
    ACCOUNT_FROZEN: {
        code: 'ACCOUNT_FROZEN',
        title: 'Account frozen',
        explanation: 'An operator froze this account, so every authorisation on its cards is refused.',
        remedy: 'If the freeze is resolved, set the account back to ACTIVE in the User 360 view with a reason.',
        origin: 'USER',
        severity: 'WARNING',
    },
    RAIL_HALTED: {
        code: 'RAIL_HALTED',
        title: 'Rail halted by kill switch',
        explanation: 'Card authorisations are currently halted platform-wide, so nothing was sent to the issuer.',
        remedy: 'Release the kill switch from the command header once the incident is closed.',
        origin: 'PLATFORM',
        severity: 'CRITICAL',
    },
    DUPLICATE_TRANSACTION: {
        code: 'DUPLICATE_TRANSACTION',
        title: 'Duplicate transaction id',
        explanation:
            'This transaction id was already settled, so the replay guard refused it. The user was not charged twice.',
        remedy: 'No action needed. This is the expected outcome of a webhook redelivery.',
        origin: 'PROCESSOR',
        severity: 'INFO',
    },
    UNKNOWN_CARD: {
        code: 'UNKNOWN_CARD',
        title: 'No local card for this identifier',
        explanation:
            'The processor referenced a card id that has no row on our side, so there was nothing to authorise against.',
        remedy: 'Check the provider console for an orphaned card and reconcile it, or ignore if it belongs to another tenant.',
        origin: 'PROCESSOR',
        severity: 'WARNING',
    },
}

export function diagnose(code: DeclineCode): DeclineDiagnostic {
    return DECLINE_CATALOGUE[code] ?? DECLINE_CATALOGUE.UNKNOWN_CARD
}

/**
 * Maps the free-text reason the live webhook already produces onto a code,
 * so declines recorded before the catalogue existed still classify.
 */
export function codeFromReason(reason: string): DeclineCode {
    const text = reason.toLowerCase()
    if (text.includes('not active')) return 'CARD_NOT_ACTIVE'
    if (text.includes('remaining card limit')) return 'CARD_LIMIT_EXCEEDED'
    if (text.includes('wallet balance')) return 'INSUFFICIENT_WALLET_BALANCE'
    if (text.includes('already recorded')) return 'DUPLICATE_TRANSACTION'
    if (text.includes('no local card')) return 'UNKNOWN_CARD'
    if (text.includes('frozen')) return 'ACCOUNT_FROZEN'
    if (text.includes('halted')) return 'RAIL_HALTED'
    return 'UNKNOWN_CARD'
}

/** ISO-3166 alpha-2 codes the issuer refuses outright. */
export const BLOCKED_MERCHANT_COUNTRIES = new Set(['IR', 'KP', 'SY', 'CU', 'RU', 'BY'])
