import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { readJson, withRouteErrors } from '@/lib/http'
import { issueCard } from '@/lib/cards'
import type { IssueCardRequest } from '@/types/api'

export const dynamic = 'force-dynamic'

/**
 * Route A - card issuance.
 *
 * Authenticates via Clerk, verifies the wallet can cover the requested
 * allocation, calls Flutterwave's virtual-card endpoint, then writes the card
 * row with the returned provider id as `flutterwave_card_id` and the allocated
 * amount as `card_spending_limit`. The balance check and the insert happen in
 * one guarded statement, so concurrent requests cannot over-allocate.
 */
export const POST = withRouteErrors('cards:issue', async (request: Request) => {
    const user = await requireUser()
    const body = await readJson<IssueCardRequest>(request)

    const result = await issueCard(user, {
        amount: body.amount ?? 0,
        currency: (body.currency ?? 'USD').toUpperCase(),
        holder: body.holder,
        color: body.color,
        type: body.type,
    })

    return NextResponse.json(result, { status: 201 })
})
