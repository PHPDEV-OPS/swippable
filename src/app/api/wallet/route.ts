import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getWalletByUserId, updateWalletAddress, insertWallet, findUserByEmail } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = findUserByEmail.get(session.user.email) as any
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const wallet = getWalletByUserId.get(user.id)
    return NextResponse.json(wallet || { message: 'No wallet found' })
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = findUserByEmail.get(session.user.email) as any
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
