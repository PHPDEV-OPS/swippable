import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { findAdminCard, findAdminUser, recordDecline, writeAudit } from '@/lib/admin-db'
import {
    authoriseCardDebit,
    findTransactionByTxId,
    pushNotification,
    recordTransaction,
    reverseCardDebit,
    settlePendingDeposit,
} from '@/lib/db'
import { BLOCKED_MERCHANT_COUNTRIES, diagnose } from '@/lib/decline'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney, gte, isPositive, subtract } from '@/lib/money'
import { getLiquidity, isRailHalted } from '@/lib/platform'
import type { DeclineCode, SimulationRequest, SimulationResult } from '@/types/admin'
import type { Decimal } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Trace = SimulationResult['trace']

/**
 * The simulation environment.
 *
 * Rehearsing a payment is only useful if the rehearsal is honest, so this
 * route does not model the authorisation - it runs the *real* one. An approved
 * card payment goes through `authoriseCardDebit`, the same single guarded
 * statement the live Flutterwave webhook calls; a settled deposit goes through
 * `settlePendingDeposit`, the same statement the Daraja and crypto callbacks
 * call. A simulated success therefore moves money exactly as a real one does,
 * and a simulated decline fails at exactly the same check.
 *
 * Two safeguards make that safe to expose:
 *
 *   - `dryRun` (the default) walks every check and reports where it would have
 *     stopped, without writing anything. Nothing in the ledger moves.
 *   - Every live run is tagged `simulated: true` in the transaction metadata
 *     and in `card_declines`, and is written to the audit log, so a rehearsal
 *     can always be told apart from real traffic after the fact.
 */
export const POST = withRouteErrors('admin:simulator', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<SimulationRequest & { reason?: string }>(request)

    const dryRun = body.dryRun !== false
    // A live run writes to the ledger, so it carries the same justification
    // requirement as any other override. A dry run needs none.
    const reason = dryRun ? 'Dry run' : requireReason(body.reason)

    if (!body.userRef) badRequest('Select a user to simulate against', 'USER_REQUIRED')

    const amount = decimal(body.amount)
    if (!isPositive(amount)) badRequest('Simulation amount must be greater than zero', 'INVALID_AMOUNT')

    const user = await findAdminUser(body.userRef)
    if (!user) notFound('User not found')

    const currency = (body.currency ?? 'USD').toUpperCase()
    const merchant = body.merchant?.trim() || 'Simulated Merchant'
    const merchantCountry = (body.merchantCountry ?? 'KE').toUpperCase()

    let result: SimulationResult

    switch (body.scenario) {
        case 'CARD_PAYMENT_APPROVED':
        case 'CARD_PAYMENT_DECLINED':
            result = await simulateCardPayment({
                user,
                cardRef: body.cardId,
                amount,
                currency,
                merchant,
                merchantCountry,
                forcedCode: body.scenario === 'CARD_PAYMENT_DECLINED' ? (body.declineCode ?? null) : null,
                dryRun,
                actor: admin.email,
                reason,
            })
            break
        case 'CARD_REFUND':
            result = await simulateRefund({
                user,
                cardRef: body.cardId,
                amount,
                currency,
                merchant,
                dryRun,
                actor: admin.email,
            })
            break
        case 'MPESA_STK_SUCCESS':
        case 'MPESA_STK_FAILURE':
        case 'MPESA_CALLBACK_TIMEOUT':
            result = await simulateMpesa({
                user,
                amount,
                scenario: body.scenario,
                dryRun,
                actor: admin.email,
            })
            break
        case 'CRYPTO_DEPOSIT_CONFIRMED':
        case 'CRYPTO_WEBHOOK_MISSED':
            result = await simulateCrypto({
                user,
                amount,
                scenario: body.scenario,
                dryRun,
                actor: admin.email,
            })
            break
        default:
            return badRequest('Unknown simulation scenario', 'INVALID_SCENARIO')
    }

    await writeAudit({
        action: 'SIMULATION_RUN',
        actorEmail: admin.email,
        actorClerkId: admin.clerkUserId,
        targetType: 'USER',
        targetId: String(user.id),
        reason: `${dryRun ? '[dry run] ' : '[live] '}${body.scenario} — ${reason}`,
        after: {
            scenario: body.scenario,
            outcome: result.outcome,
            declineCode: result.declineCode,
            amount,
            dryRun,
            txId: result.txId,
        },
        ip: clientIp(request),
    })

    return NextResponse.json(result)
})

/* ---------------------------------------------------------- card payment */

async function simulateCardPayment(input: {
    user: Record<string, any>
    cardRef?: string
    amount: Decimal
    currency: string
    merchant: string
    merchantCountry: string
    forcedCode: DeclineCode | null
    dryRun: boolean
    actor: string
    reason: string
}): Promise<SimulationResult> {
    const trace: Trace = []
    const balanceBefore = decimal(input.user.wallet_balance)

    const card = input.cardRef ? await findAdminCard(input.cardRef) : null
    if (input.cardRef && !card) notFound('Card not found')
    if (!card) badRequest('Select a card to simulate a payment against', 'CARD_REQUIRED')
    if (Number(card.user_id) !== Number(input.user.id)) {
        badRequest('That card does not belong to the selected user', 'CARD_USER_MISMATCH')
    }

    const last4 = String(card.last_4 ?? '')
    const payloadPreview = {
        event: 'charge.card.virtual',
        data: {
            card_id: card.flutterwave_card_id ?? card.card_id,
            amount: Number(input.amount),
            currency: input.currency,
            merchant_name: input.merchant,
            merchant_country: input.merchantCountry,
            type: 'DEBIT',
        },
    }

    // Run the checks in the same order the processor does, so the trace shows
    // the operator precisely where a real charge would have stopped.
    const railHalted = await isRailHalted('CARD_AUTHORISATIONS')
    trace.push({
        step: 'Kill switch',
        status: railHalted ? 'FAIL' : 'PASS',
        detail: railHalted ? 'Card authorisations are halted platform-wide' : 'Authorisation rail is open',
    })

    const countryBlocked = BLOCKED_MERCHANT_COUNTRIES.has(input.merchantCountry)
    trace.push({
        step: 'Merchant country',
        status: countryBlocked ? 'FAIL' : 'PASS',
        detail: countryBlocked
            ? `${input.merchantCountry} is on the issuer's blocked list`
            : `${input.merchantCountry} is permitted`,
    })

    const accountStatus = String(card.account_status ?? 'ACTIVE').toUpperCase()
    trace.push({
        step: 'Account status',
        status: accountStatus === 'ACTIVE' ? 'PASS' : 'FAIL',
        detail: accountStatus === 'ACTIVE' ? 'Account is active' : `Account is ${accountStatus.toLowerCase()}`,
    })

    const cardActive = String(card.status).toUpperCase() === 'ACTIVE'
    trace.push({
        step: 'Card status',
        status: cardActive ? 'PASS' : 'FAIL',
        detail: cardActive ? 'Card is active' : `Card is ${String(card.status).toLowerCase()}`,
    })

    const remaining = subtract(card.card_spending_limit, card.total_spent_by_card)
    const withinCardLimit = gte(remaining, input.amount)
    trace.push({
        step: 'Card allocation',
        status: withinCardLimit ? 'PASS' : 'FAIL',
        detail: `${formatMoney(remaining)} remaining against a ${formatMoney(input.amount)} charge`,
    })

    const walletCovers = gte(balanceBefore, input.amount)
    trace.push({
        step: 'Wallet balance',
        status: walletCovers ? 'PASS' : 'FAIL',
        detail: `${formatMoney(balanceBefore)} available against a ${formatMoney(input.amount)} charge`,
    })

    const liquidity = await getLiquidity()
    const floatCovers = gte(liquidity.declared.issuerSettlementPoolUsd, input.amount)
    trace.push({
        step: 'Issuer settlement pool',
        status: floatCovers ? 'PASS' : 'FAIL',
        detail: floatCovers
            ? `${formatMoney(liquidity.declared.issuerSettlementPoolUsd)} of platform float available`
            : `Platform float is ${formatMoney(liquidity.declared.issuerSettlementPoolUsd)} — below the charge`,
    })

    // The forced code lets an operator rehearse a decline the current state
    // would not otherwise produce (a bad CVV, an expired card).
    const naturalCode: DeclineCode | null = railHalted
        ? 'RAIL_HALTED'
        : countryBlocked
          ? 'BLOCKED_MERCHANT_COUNTRY'
          : accountStatus !== 'ACTIVE'
            ? 'ACCOUNT_FROZEN'
            : !cardActive
              ? 'CARD_NOT_ACTIVE'
              : !withinCardLimit
                ? 'CARD_LIMIT_EXCEEDED'
                : !walletCovers
                  ? 'INSUFFICIENT_WALLET_BALANCE'
                  : !floatCovers
                    ? 'INSUFFICIENT_PLATFORM_FLOAT'
                    : null

    const code = input.forcedCode ?? naturalCode

    if (input.forcedCode && !naturalCode) {
        trace.push({
            step: 'Forced decline',
            status: 'FAIL',
            detail: `Every check passed; ${input.forcedCode} was injected by the operator`,
        })
    }

    if (code) {
        const diagnostic = diagnose(code)
        const txId = `sim_${randomUUID().replace(/-/g, '').slice(0, 24)}`

        if (!input.dryRun) {
            // A live declined run leaves the same trail a real decline does:
            // a diagnostic row and a FAILED ledger entry, both marked simulated.
            await recordDecline({
                code,
                processorMessage: diagnostic.title,
                cardId: String(card.card_id),
                cardLast4: last4,
                userId: Number(input.user.id),
                amount: input.amount,
                currency: input.currency,
                merchant: input.merchant,
                merchantCountry: input.merchantCountry,
                simulated: true,
                metadata: { simulatedBy: input.actor, reason: input.reason, forced: Boolean(input.forcedCode) },
            })
            await recordTransaction({
                txId,
                userId: Number(input.user.id),
                cardId: String(card.card_id),
                amount: input.amount,
                currency: input.currency,
                type: 'DEBIT',
                channel: 'CARD_TRANSACTION',
                status: 'FAILED',
                merchant: input.merchant,
                category: 'Simulation',
                metadata: { simulated: true, declineCode: code, simulatedBy: input.actor },
            })
        }

        return {
            // Whether the code was forced or arose naturally, the operator asked
            // for a payment and got a decline - report it as such.
            scenario: 'CARD_PAYMENT_DECLINED',
            outcome: 'DECLINED',
            dryRun: input.dryRun,
            txId: input.dryRun ? null : txId,
            message: `Declined — ${diagnostic.title}. ${diagnostic.remedy}`,
            declineCode: code,
            diagnostic,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    if (input.dryRun) {
        trace.push({ step: 'Settlement', status: 'SKIP', detail: 'Dry run — no ledger row written' })
        return {
            scenario: 'CARD_PAYMENT_APPROVED',
            outcome: 'APPROVED',
            dryRun: true,
            txId: null,
            message: `Would approve ${formatMoney(input.amount)} at ${input.merchant}. Wallet would settle at ${formatMoney(subtract(balanceBefore, input.amount))}.`,
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: subtract(balanceBefore, input.amount),
            payloadPreview,
            trace,
        }
    }

    // Live: the identical statement the Flutterwave webhook calls.
    const txId = `sim_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const settled = await authoriseCardDebit({
        flutterwaveCardId: String(card.flutterwave_card_id ?? card.card_id),
        txId,
        amount: input.amount,
        currency: input.currency,
        merchant: input.merchant,
        category: 'Simulation',
        metadata: { simulated: true, simulatedBy: input.actor, reason: input.reason, merchantCountry: input.merchantCountry },
    })

    if (!settled) {
        // The pre-flight checks passed but the authorisation statement still
        // refused, which means the state moved underneath us.
        const diagnostic = diagnose('DUPLICATE_TRANSACTION')
        trace.push({ step: 'Settlement', status: 'FAIL', detail: 'Authorisation statement refused the debit' })
        return {
            scenario: 'CARD_PAYMENT_DECLINED',
            outcome: 'DECLINED',
            dryRun: false,
            txId,
            message: 'The authorisation was refused at settlement — the account state changed mid-simulation.',
            declineCode: 'DUPLICATE_TRANSACTION',
            diagnostic,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({
        step: 'Settlement',
        status: 'PASS',
        detail: `Wallet debited, card spend counter advanced, ledger row ${txId} written`,
    })

    await pushNotification(
        Number(input.user.id),
        'Card payment',
        `${formatMoney(input.amount, input.currency)} at ${input.merchant}. Balance ${formatMoney(settled.balance_after)}.`,
        'INFO'
    )

    return {
        scenario: 'CARD_PAYMENT_APPROVED',
        outcome: 'APPROVED',
        dryRun: false,
        txId,
        message: `Approved ${formatMoney(input.amount)} at ${input.merchant}. Wallet is now ${formatMoney(settled.balance_after)}.`,
        declineCode: null,
        diagnostic: null,
        balanceBefore,
        balanceAfter: decimal(settled.balance_after),
        payloadPreview,
        trace,
    }
}

/* --------------------------------------------------------------- refund */

async function simulateRefund(input: {
    user: Record<string, any>
    cardRef?: string
    amount: Decimal
    currency: string
    merchant: string
    dryRun: boolean
    actor: string
}): Promise<SimulationResult> {
    const trace: Trace = []
    const balanceBefore = decimal(input.user.wallet_balance)

    const card = input.cardRef ? await findAdminCard(input.cardRef) : null
    if (!card) badRequest('Select a card to simulate a refund against', 'CARD_REQUIRED')

    const payloadPreview = {
        event: 'card.refund',
        data: {
            card_id: card.flutterwave_card_id ?? card.card_id,
            amount: Number(input.amount),
            currency: input.currency,
            merchant_name: input.merchant,
            type: 'CREDIT',
        },
    }

    trace.push({ step: 'Card lookup', status: 'PASS', detail: `Card •••• ${card.last_4} resolved` })

    if (input.dryRun) {
        trace.push({ step: 'Reversal', status: 'SKIP', detail: 'Dry run — no ledger row written' })
        return {
            scenario: 'CARD_REFUND',
            outcome: 'APPROVED',
            dryRun: true,
            txId: null,
            message: `Would return ${formatMoney(input.amount)} to the wallet and release the card's spend counter.`,
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: null,
            payloadPreview,
            trace,
        }
    }

    const txId = `sim_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const reversed = await reverseCardDebit({
        flutterwaveCardId: String(card.flutterwave_card_id ?? card.card_id),
        txId,
        amount: input.amount,
        currency: input.currency,
        merchant: input.merchant,
        metadata: { simulated: true, simulatedBy: input.actor },
    })

    if (!reversed) {
        trace.push({ step: 'Reversal', status: 'FAIL', detail: 'The reversal statement found nothing to reverse' })
        return {
            scenario: 'CARD_REFUND',
            outcome: 'FAILED',
            dryRun: false,
            txId,
            message: 'The refund could not be applied — the card or transaction id did not resolve.',
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({ step: 'Reversal', status: 'PASS', detail: `Wallet credited, ledger row ${txId} written` })

    return {
        scenario: 'CARD_REFUND',
        outcome: 'APPROVED',
        dryRun: false,
        txId,
        message: `Refunded ${formatMoney(input.amount)}. Wallet is now ${formatMoney(reversed.balance_after)}.`,
        declineCode: null,
        diagnostic: null,
        balanceBefore,
        balanceAfter: decimal(reversed.balance_after),
        payloadPreview,
        trace,
    }
}

/* --------------------------------------------------------------- M-Pesa */

async function simulateMpesa(input: {
    user: Record<string, any>
    amount: Decimal
    scenario: 'MPESA_STK_SUCCESS' | 'MPESA_STK_FAILURE' | 'MPESA_CALLBACK_TIMEOUT'
    dryRun: boolean
    actor: string
}): Promise<SimulationResult> {
    const trace: Trace = []
    const balanceBefore = decimal(input.user.wallet_balance)
    const checkoutRequestId = `ws_CO_sim${Date.now()}`
    const txId = `mpesa_${checkoutRequestId}`
    const receipt = `SIM${Math.random().toString(36).slice(2, 9).toUpperCase()}`

    const success = input.scenario === 'MPESA_STK_SUCCESS'
    const payloadPreview = {
        Body: {
            stkCallback: {
                MerchantRequestID: `sim-${Date.now()}`,
                CheckoutRequestID: checkoutRequestId,
                ResultCode: success ? 0 : 1032,
                ResultDesc: success ? 'The service request is processed successfully.' : 'Request cancelled by user',
                ...(success
                    ? {
                          CallbackMetadata: {
                              Item: [
                                  { Name: 'Amount', Value: Number(input.amount) },
                                  { Name: 'MpesaReceiptNumber', Value: receipt },
                              ],
                          },
                      }
                    : {}),
            },
        },
    }

    const railHalted = await isRailHalted('MPESA_DEPOSITS')
    trace.push({
        step: 'Kill switch',
        status: railHalted ? 'FAIL' : 'PASS',
        detail: railHalted ? 'The M-Pesa deposit rail is halted' : 'M-Pesa rail is open',
    })

    if (railHalted) {
        return {
            scenario: input.scenario,
            outcome: 'FAILED',
            dryRun: input.dryRun,
            txId: null,
            message: 'The M-Pesa rail is halted, so the STK push would never have been sent.',
            declineCode: 'RAIL_HALTED',
            diagnostic: diagnose('RAIL_HALTED'),
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({ step: 'STK push', status: 'PASS', detail: `Prompt raised on the handset, ref ${checkoutRequestId}` })

    if (input.scenario === 'MPESA_CALLBACK_TIMEOUT') {
        // The failure the intervention module exists for: money taken at
        // Safaricom, callback never delivered, row stranded in PENDING.
        trace.push({ step: 'Daraja callback', status: 'FAIL', detail: 'No callback delivered — deposit left PENDING' })

        if (input.dryRun) {
            return {
                scenario: input.scenario,
                outcome: 'PENDING',
                dryRun: true,
                txId: null,
                message:
                    'Would leave a PENDING deposit with no callback. Run this live to produce a row for the intervention module.',
                declineCode: null,
                diagnostic: null,
                balanceBefore,
                balanceAfter: balanceBefore,
                payloadPreview,
                trace,
            }
        }

        await recordTransaction({
            txId,
            userId: Number(input.user.id),
            amount: input.amount,
            currency: 'USD',
            type: 'CREDIT',
            channel: 'MPESA',
            status: 'PENDING',
            merchant: 'M-Pesa top up • simulated',
            category: 'M-Pesa Deposit',
            metadata: {
                simulated: true,
                simulatedBy: input.actor,
                checkoutRequestId,
                stuckByDesign: 'Callback deliberately withheld to exercise manual reconciliation',
            },
        })

        return {
            scenario: input.scenario,
            outcome: 'PENDING',
            dryRun: false,
            txId,
            message: `Stranded deposit ${txId} created. It now appears in the M-Pesa intervention rail awaiting Force Manual Reconciliation.`,
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    if (!success) {
        trace.push({ step: 'Daraja callback', status: 'FAIL', detail: 'ResultCode 1032 — cancelled on the handset' })
        if (!input.dryRun) {
            await recordTransaction({
                txId,
                userId: Number(input.user.id),
                amount: input.amount,
                currency: 'USD',
                type: 'CREDIT',
                channel: 'MPESA',
                status: 'FAILED',
                merchant: 'M-Pesa top up • simulated',
                category: 'M-Pesa Deposit',
                metadata: { simulated: true, simulatedBy: input.actor, resultCode: 1032 },
            })
        }
        return {
            scenario: input.scenario,
            outcome: 'FAILED',
            dryRun: input.dryRun,
            txId: input.dryRun ? null : txId,
            message: 'The user cancelled the prompt. Nothing was credited, which is the correct outcome.',
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    if (input.dryRun) {
        trace.push({ step: 'Daraja callback', status: 'SKIP', detail: 'Dry run — nothing credited' })
        return {
            scenario: input.scenario,
            outcome: 'PENDING',
            dryRun: true,
            txId: null,
            message: `Would credit ${formatMoney(input.amount)} on callback. Run live to move the ledger.`,
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: null,
            payloadPreview,
            trace,
        }
    }

    // Record the PENDING row then settle it, so the simulation exercises both
    // halves of the real flow rather than crediting out of nowhere.
    await recordTransaction({
        txId,
        userId: Number(input.user.id),
        amount: input.amount,
        currency: 'USD',
        type: 'CREDIT',
        channel: 'MPESA',
        status: 'PENDING',
        merchant: 'M-Pesa top up • simulated',
        category: 'M-Pesa Deposit',
        metadata: { simulated: true, simulatedBy: input.actor, checkoutRequestId },
    })

    const settled = await settlePendingDeposit(txId, { simulated: true, mpesaReceipt: receipt })
    if (!settled) {
        trace.push({ step: 'Daraja callback', status: 'FAIL', detail: 'Settlement found nothing pending' })
        return {
            scenario: input.scenario,
            outcome: 'FAILED',
            dryRun: false,
            txId,
            message: 'The deposit could not be settled.',
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({ step: 'Daraja callback', status: 'PASS', detail: `Receipt ${receipt} — wallet credited` })

    await pushNotification(
        Number(input.user.id),
        'Wallet topped up',
        `${formatMoney(settled.amount)} received via M-Pesa. Balance ${formatMoney(settled.balance_after)}.`,
        'SUCCESS'
    )

    return {
        scenario: input.scenario,
        outcome: 'SETTLED',
        dryRun: false,
        txId,
        message: `Credited ${formatMoney(settled.amount)} against receipt ${receipt}. Wallet is now ${formatMoney(settled.balance_after)}.`,
        declineCode: null,
        diagnostic: null,
        balanceBefore,
        balanceAfter: decimal(settled.balance_after),
        payloadPreview,
        trace,
    }
}

/* --------------------------------------------------------------- crypto */

async function simulateCrypto(input: {
    user: Record<string, any>
    amount: Decimal
    scenario: 'CRYPTO_DEPOSIT_CONFIRMED' | 'CRYPTO_WEBHOOK_MISSED'
    dryRun: boolean
    actor: string
}): Promise<SimulationResult> {
    const trace: Trace = []
    const balanceBefore = decimal(input.user.wallet_balance)

    // A syntactically valid but obviously synthetic hash, so a simulated
    // deposit can never collide with a real on-chain one.
    const txHash = `0x${'5'.repeat(2)}${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`.slice(0, 66)
    const txId = `crypto_${txHash.toLowerCase()}`
    const confirmations = input.scenario === 'CRYPTO_DEPOSIT_CONFIRMED' ? 12 : 1

    const payloadPreview = {
        type: 'crypto.deposit',
        event: {
            activity: [
                {
                    hash: txHash,
                    value: Number(input.amount),
                    asset: 'USDC',
                    toAddress: input.user.base_account_address ?? '0x…unlinked',
                    confirmations,
                },
            ],
        },
    }

    const railHalted = await isRailHalted('CRYPTO_DEPOSITS')
    trace.push({
        step: 'Kill switch',
        status: railHalted ? 'FAIL' : 'PASS',
        detail: railHalted ? 'The crypto deposit rail is halted' : 'Crypto rail is open',
    })

    if (railHalted) {
        return {
            scenario: input.scenario,
            outcome: 'FAILED',
            dryRun: input.dryRun,
            txId: null,
            message: 'The crypto rail is halted, so the deposit would not have been accepted.',
            declineCode: 'RAIL_HALTED',
            diagnostic: diagnose('RAIL_HALTED'),
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({ step: 'Transfer broadcast', status: 'PASS', detail: `${txHash.slice(0, 18)}… seen in the mempool` })

    const confirmed = input.scenario === 'CRYPTO_DEPOSIT_CONFIRMED'
    trace.push({
        step: 'Confirmations',
        status: confirmed ? 'PASS' : 'FAIL',
        detail: `${confirmations} confirmation${confirmations === 1 ? '' : 's'} observed`,
    })

    if (input.dryRun) {
        trace.push({ step: 'Webhook', status: 'SKIP', detail: 'Dry run — nothing credited' })
        return {
            scenario: input.scenario,
            outcome: confirmed ? 'PENDING' : 'PENDING',
            dryRun: true,
            txId: null,
            message: confirmed
                ? `Would credit ${formatMoney(input.amount)} once the webhook lands.`
                : 'Would leave the deposit PENDING with the webhook never delivered.',
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: null,
            payloadPreview,
            trace,
        }
    }

    await recordTransaction({
        txId,
        userId: Number(input.user.id),
        amount: input.amount,
        currency: 'USD',
        type: 'CREDIT',
        channel: 'CRYPTO',
        status: 'PENDING',
        merchant: 'USDC deposit • Base (simulated)',
        category: 'Crypto Deposit',
        metadata: { simulated: true, simulatedBy: input.actor, txHash, asset: 'USDC', network: 'base', confirmations },
        txHash,
    })

    if (!confirmed) {
        trace.push({ step: 'Webhook', status: 'FAIL', detail: 'Webhook never delivered — deposit left PENDING' })
        return {
            scenario: input.scenario,
            outcome: 'PENDING',
            dryRun: false,
            txId,
            message: `Stranded deposit ${txId} created. It now appears in the crypto intervention rail awaiting a manual webhook completion.`,
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    const settled = await settlePendingDeposit(txId, { simulated: true, confirmations, txHash })
    const existing = settled ? null : await findTransactionByTxId(txId)

    if (!settled) {
        trace.push({
            step: 'Webhook',
            status: 'FAIL',
            detail: existing ? `Already ${existing.status}` : 'Settlement found nothing pending',
        })
        return {
            scenario: input.scenario,
            outcome: 'FAILED',
            dryRun: false,
            txId,
            message: 'The deposit could not be settled.',
            declineCode: null,
            diagnostic: null,
            balanceBefore,
            balanceAfter: balanceBefore,
            payloadPreview,
            trace,
        }
    }

    trace.push({ step: 'Webhook', status: 'PASS', detail: `${confirmations} confirmations — wallet credited` })

    await pushNotification(
        Number(input.user.id),
        'Crypto deposit confirmed',
        `${formatMoney(settled.amount)} USDC credited. Balance ${formatMoney(settled.balance_after)}.`,
        'SUCCESS'
    )

    return {
        scenario: input.scenario,
        outcome: 'SETTLED',
        dryRun: false,
        txId,
        message: `Credited ${formatMoney(settled.amount)} USDC. Wallet is now ${formatMoney(settled.balance_after)}.`,
        declineCode: null,
        diagnostic: null,
        balanceBefore,
        balanceAfter: decimal(settled.balance_after),
        payloadPreview,
        trace,
    }
}
