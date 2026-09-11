import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, HttpError, readJson, withRouteErrors } from '@/lib/http'
import { adjustCardFunding } from '@/lib/cards'
import { getCardForUser } from '@/lib/db'
import { decimal, isPositive, subtract } from '@/lib/money'
import { isKycVerified, type FundCardRequest } from '@/types/api'

export const dynamic = 'force-dynamic'

/**
 * Route B - wallet funding and card allocation.
 *
 * Moves capital between the shared wallet and a card's spending limit, or sets
 * that limit outright. The guard, the provider call and the ledger write are
 * wrapped so the limit can never exceed what the wallet has left unallocated,
 * and can never fall below what the card has already spent.
 *
 * KYC applies asymmetrically here, by direction rather than by endpoint.
 * Increasing an allocation puts more spendable money behind an unverified
 * identity, so it is gated. Withdrawing pulls money back to the wallet and
 * lowers exposure, so it is always allowed - gating it would strand the funds
 * of anyone who holds a card issued before verification was introduced, which
 * punishes the user for our change rather than protecting anyone.
 */
export const POST = withRouteErrors('cards:funding', async (request: Request) => {
    const user = await requireUser()
    const body = await readJson<FundCardRequest>(request)

    if (!body.cardId) badRequest('cardId is required', 'MISSING_CARD_ID')

    const action = body.action ?? 'FUND'
    const amount = decimal(body.amount)

    let delta: string
    if (action === 'SET_LIMIT') {
        // Translate an absolute target into the delta the allocation guard wants.
        const card = await getCardForUser(user.id, body.cardId)
        if (!card) badRequest('Card not found', 'CARD_NOT_FOUND')
        delta = subtract(amount, card.card_spending_limit)
    } else if (action === 'WITHDRAW') {
        delta = subtract('0', amount)
    } else {
        delta = amount
    }

    // `delta` is now the signed change to the card's allocation, whichever
    // action produced it - so one check covers FUND, and the SET_LIMIT case
    // that happens to be a raise.
    if (isPositive(delta) && !isKycVerified(user.kyc_status)) {
        throw new HttpError(403, messageForStatus(), 'KYC_REQUIRED')
    }

    const result = await adjustCardFunding(user, {
        cardId: body.cardId,
        delta,
        currency: 'USD',
    })

    return NextResponse.json(result)
})

/** Explains the block, and names withdrawal as the thing they can still do. */
function messageForStatus(): string {
    return 'Verify your identity before adding money to a card. You can still withdraw from a card back to your wallet.'
}
