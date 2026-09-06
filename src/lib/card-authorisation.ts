import { BLOCKED_MERCHANT_COUNTRIES } from '@/lib/decline'
import { formatMoney, gte, subtract, type Decimal } from '@/lib/money'
import { getLiquidity, isRailHalted } from '@/lib/platform'
import type { DeclineCode } from '@/types/admin'

/**
 * The authorisation checklist, in processor order.
 *
 * This exists so the checkout page and the simulation lab cannot drift apart.
 * Both run *this* function to decide whether a charge is approved, and both
 * then hand the approval to `authoriseCardDebit` - the single guarded statement
 * that actually moves the money. A decline raised at a merchant checkout is
 * therefore the same decline, with the same code and the same trace, that the
 * simulator produces for the same card.
 *
 * Nothing here writes. It decides, and it explains; the caller settles.
 */

export interface TraceStep {
    step: string
    status: 'PASS' | 'FAIL' | 'SKIP'
    detail: string
}

export interface AuthorisationSubject {
    /** Card row, as returned by `findAdminCard` or the user-scoped lookup. */
    cardStatus: string
    cardSpendingLimit: Decimal
    totalSpentByCard: Decimal
    /** "MM/YY" as stored on the card row. */
    expiry: string | null
    accountStatus: string
    walletBalance: Decimal
}

export interface AuthorisationRequest {
    amount: Decimal
    merchantCountry: string
    /** CVV typed at the checkout, when one was collected. */
    presentedCvv?: string | null
    /** Bypasses the natural outcome so a specific decline can be rehearsed. */
    forcedCode?: DeclineCode | null
}

export interface AuthorisationDecision {
    /** null means approved. */
    code: DeclineCode | null
    trace: TraceStep[]
    /** True when `code` came from `forcedCode` rather than a failed check. */
    forced: boolean
}

/**
 * A sandbox card has no issuer-side record, so its CVV cannot be verified
 * against anything. Rather than pretend, we honour one documented test value -
 * the same convention Stripe and Flutterwave sandboxes use - so a CVV decline
 * can still be exercised end to end. Surfaced in the checkout UI, never hidden.
 */
export const TEST_DECLINE_CVV = '000'

/** "MM/YY" -> true when the card is past its expiry month. */
export function isExpired(expiry: string | null | undefined, now = new Date()): boolean {
    if (!expiry) return false
    const match = /^(\d{2})\s*\/\s*(\d{2,4})$/.exec(expiry.trim())
    if (!match) return false

    const month = Number(match[1])
    if (month < 1 || month > 12) return false

    const rawYear = Number(match[2])
    const year = rawYear < 100 ? 2000 + rawYear : rawYear

    // A card is valid through the final day of its expiry month.
    const expiresAfter = new Date(Date.UTC(year, month, 1))
    return now.getTime() >= expiresAfter.getTime()
}

export async function evaluateAuthorisation(
    subject: AuthorisationSubject,
    request: AuthorisationRequest
): Promise<AuthorisationDecision> {
    const trace: TraceStep[] = []

    const railHalted = await isRailHalted('CARD_AUTHORISATIONS')
    trace.push({
        step: 'Kill switch',
        status: railHalted ? 'FAIL' : 'PASS',
        detail: railHalted ? 'Card authorisations are halted platform-wide' : 'Authorisation rail is open',
    })

    const country = request.merchantCountry.toUpperCase()
    const countryBlocked = BLOCKED_MERCHANT_COUNTRIES.has(country)
    trace.push({
        step: 'Merchant country',
        status: countryBlocked ? 'FAIL' : 'PASS',
        detail: countryBlocked ? `${country} is on the issuer's blocked list` : `${country} is permitted`,
    })

    const accountStatus = String(subject.accountStatus ?? 'ACTIVE').toUpperCase()
    const accountOk = accountStatus === 'ACTIVE'
    trace.push({
        step: 'Account status',
        status: accountOk ? 'PASS' : 'FAIL',
        detail: accountOk ? 'Account is active' : `Account is ${accountStatus.toLowerCase()}`,
    })

    const cardActive = String(subject.cardStatus).toUpperCase() === 'ACTIVE'
    trace.push({
        step: 'Card status',
        status: cardActive ? 'PASS' : 'FAIL',
        detail: cardActive ? 'Card is active' : `Card is ${String(subject.cardStatus).toLowerCase()}`,
    })

    const expired = isExpired(subject.expiry)
    trace.push({
        step: 'Expiry',
        status: expired ? 'FAIL' : 'PASS',
        detail: subject.expiry ? `Valid through ${subject.expiry}` : 'No expiry recorded on this card',
    })

    // Only evaluated when a checkout actually collected one.
    const cvvPresented = typeof request.presentedCvv === 'string' && request.presentedCvv.length > 0
    const cvvBad = cvvPresented && request.presentedCvv === TEST_DECLINE_CVV
    if (cvvPresented) {
        trace.push({
            step: 'CVV',
            status: cvvBad ? 'FAIL' : 'PASS',
            detail: cvvBad
                ? `${TEST_DECLINE_CVV} is the reserved test CVV - the issuer rejected it`
                : 'CVV accepted (sandbox cards hold no issuer-side CVV to match against)',
        })
    }

    const remaining = subtract(subject.cardSpendingLimit, subject.totalSpentByCard)
    const withinCardLimit = gte(remaining, request.amount)
    trace.push({
        step: 'Card allocation',
        status: withinCardLimit ? 'PASS' : 'FAIL',
        detail: `${formatMoney(remaining)} remaining against a ${formatMoney(request.amount)} charge`,
    })

    const walletCovers = gte(subject.walletBalance, request.amount)
    trace.push({
        step: 'Wallet balance',
        status: walletCovers ? 'PASS' : 'FAIL',
        detail: `${formatMoney(subject.walletBalance)} available against a ${formatMoney(request.amount)} charge`,
    })

    // The settlement pool is an operator-declared figure, not something we can
    // read from the issuer. Until it has been declared at least once there is no
    // float number to check against - and treating "never set" as a hard zero
    // would decline every card on the platform on a fresh install. So the check
    // is skipped, visibly, until a founder declares the balance.
    const liquidity = await getLiquidity()
    const pool = liquidity.declared.issuerSettlementPoolUsd
    const poolDeclared = liquidity.updatedAt !== null
    const floatCovers = !poolDeclared || gte(pool, request.amount)
    trace.push({
        step: 'Issuer settlement pool',
        status: !poolDeclared ? 'SKIP' : floatCovers ? 'PASS' : 'FAIL',
        detail: !poolDeclared
            ? 'No settlement pool declared yet — float is not being enforced'
            : floatCovers
              ? `${formatMoney(pool)} of platform float available`
              : `Platform float is ${formatMoney(pool)} — below the charge`,
    })

    const naturalCode: DeclineCode | null = railHalted
        ? 'RAIL_HALTED'
        : countryBlocked
          ? 'BLOCKED_MERCHANT_COUNTRY'
          : !accountOk
            ? 'ACCOUNT_FROZEN'
            : !cardActive
              ? 'CARD_NOT_ACTIVE'
              : expired
                ? 'EXPIRED_CARD'
                : cvvBad
                  ? 'INVALID_CVV'
                  : !withinCardLimit
                    ? 'CARD_LIMIT_EXCEEDED'
                    : !walletCovers
                      ? 'INSUFFICIENT_WALLET_BALANCE'
                      : !floatCovers
                        ? 'INSUFFICIENT_PLATFORM_FLOAT'
                        : null

    if (request.forcedCode && !naturalCode) {
        trace.push({
            step: 'Forced decline',
            status: 'FAIL',
            detail: `Every check passed; ${request.forcedCode} was injected by the operator`,
        })
        return { code: request.forcedCode, trace, forced: true }
    }

    return { code: request.forcedCode ?? naturalCode, trace, forced: Boolean(request.forcedCode && naturalCode) }
}
