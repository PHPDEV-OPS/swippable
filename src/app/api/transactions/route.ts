import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withRouteErrors } from '@/lib/http'
import { expireStalePendingDeposits, getTransactionsByUserId } from '@/lib/db'
import { serializeTransaction } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

/**
 * The user's ledger. Filtering happens client-side over this list, which keeps
 * the search box instant; the `limit` guards the payload size.
 */
export const GET = withRouteErrors('transactions:list', async (request: Request) => {
    const user = await requireUser()

    const limitParam = Number(new URL(request.url).searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200

    // Age out deposits that were never confirmed so the list does not show
    // an abandoned STK prompt as though it were still in flight.
    await expireStalePendingDeposits(user.id)

    const rows = await getTransactionsByUserId(user.id, limit)
    return NextResponse.json(rows.map(serializeTransaction))
})
