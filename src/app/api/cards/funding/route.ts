import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { badRequest, readJson, withRouteErrors } from '@/lib/http'
import { adjustCardFunding } from '@/lib/cards'
import { getCardForUser } from '@/lib/db'
import { decimal, subtract } from '@/lib/money'
import type { FundCardRequest } from '@/types/api'

export const dynamic = 'force-dynamic'

/**
 * Route B - wallet funding and card allocation.
 *
 * Moves capital between the shared wallet and a card's spending limit, or sets
 * that limit outright. The guard, the provider call and the ledger write are
 * wrapped so the limit can never exceed what the wallet has left unallocated,
 * and can never fall below what the card has already spent.
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

    const result = await adjustCardFunding(user, {
        cardId: body.cardId,
        delta,
        currency: 'USD',
    })

    return NextResponse.json(result)
})
