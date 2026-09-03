import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getTransactionsByUserId, insertTransaction } from '@/lib/db'

export async function GET() {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transactions = getTransactionsByUserId.all(user.id)
    return NextResponse.json(transactions)
}

export async function POST(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { cardId, amount, currency, type, merchant, status, txHash } = await request.json()
    const txId = `tx_${Date.now()}`;
    const usdcAmount = currency === 'USD' ? amount : 0;

    try {
        const result = insertTransaction.run(
            txId,
            user.id,
            cardId || null,
            amount,
            currency || 'USD',
            usdcAmount,
            merchant || 'Unknown',
            status || 'pending',
            type || 'debit',
            txHash || null
        )

        return NextResponse.json({
            id: result.lastInsertRowid,
            txId,
            userId: user.id,
            cardId,
            amount,
            currency: currency || 'USD',
            merchant: merchant || 'Unknown',
            status: status || 'pending',
            type: type || 'debit',
            txHash: txHash || null
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating transaction:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
