import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getWalletByUserId, updateWalletAddress, insertWallet } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wallet = getWalletByUserId.get(user.id)
    return NextResponse.json(wallet || { message: 'No wallet found' })
}

export async function POST(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { address } = await request.json()

    if (!address) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    try {
        const existingWallet = getWalletByUserId.get(user.id)

        if (existingWallet) {
            updateWalletAddress.run(address, user.id)
        } else {
            const walletId = crypto.randomUUID()
            insertWallet.run(walletId, user.id, address, 0)
        }

        return NextResponse.json({ message: 'Wallet connected successfully', address })
    } catch (error) {
        console.error('Error connecting wallet:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
