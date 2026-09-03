import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { insertUser, findUserByEmail, insertCard, insertWallet } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = findUserByEmail.get(email)

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const userUuid = crypto.randomUUID();
    const result = insertUser.run(userUuid, name, email, hashedPassword, null, 'PENDING')
    const userId = result.lastInsertRowid

    // Create Wallet
    const walletId = crypto.randomUUID();
    // Mock Base Account Address
    const baseAccountAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
    insertWallet.run(walletId, userId, baseAccountAddress, 0);

    // Create a default card for the new user
    const cardNumber = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join(' ')
    const cardIdStr = `card_${Date.now()}`;
    const cvv = '123';
    const maskedPan = `**** **** **** ${cardNumber.split(' ')[3]}`;

    insertCard.run(
      userId,
      cardIdStr,
      `bc_ref_${Date.now()}`, // bridgecard_ref_id
      maskedPan,
      cardNumber,
      name,
      '12/30',
      cvv,
      'Virtual',
      'from-primary to-secondary',
      5000.00,
      5000.00,
      'USD'
    )

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
