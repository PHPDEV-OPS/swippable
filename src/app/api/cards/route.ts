import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getCardsByUserId, insertCard } from '@/lib/db'
// @ts-ignore
import aes from 'aes-everywhere'

export async function GET() {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cards = getCardsByUserId.all(user.id)
    return NextResponse.json(cards)
}

export async function POST(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, color, balance, currency, holder: customHolder, spendingLimit, pin } = await request.json()

    // Bridgecard Integration
    const BRIDGECARD_SECRET_KEY = process.env.BRIDGECARD_SECRET_KEY || 'test_secret';
    const BRIDGECARD_TOKEN = process.env.BRIDGECARD_TOKEN || 'test_token';
    
    // Encrypt PIN
    const encryptedPin = aes.encrypt(pin || '1234', BRIDGECARD_SECRET_KEY);

    let cardData: any = null;

    try {
        // Only attempt API call if we have a token (simulated for now if not)
        if (process.env.BRIDGECARD_TOKEN) {
            const response = await fetch('https://issuecards.api.bridgecard.co/v1/issuing/cards/create_card', {
                method: 'POST',
                headers: {
                    'token': `Bearer ${BRIDGECARD_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cardholder_id: user.bridgecard_holder_id || 'test_holder_id', 
                    card_type: 'virtual',
                    card_currency: 'USD',
                    card_limit: spendingLimit ? String(spendingLimit) : "5000",
                    funding_amount: balance ? String(balance) : "10",
                    pin: encryptedPin,
                    meta_data: {
                        user_id: user.id
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    cardData = data.data;
                }
            }
        }
    } catch (e) {
        console.error('Bridgecard API error', e);
    }

    // Fallback to mock data if API fails or not configured
    if (!cardData) {
        cardData = {
            card_id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            card_number: Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join(' '),
            expiry_month: '12',
            expiry_year: '30',
            cvv: Math.floor(100 + Math.random() * 900).toString()
        }
    }

    const holder = customHolder || user.name
    const expiry = `${cardData.expiry_month}/${cardData.expiry_year}`
    const maskedPan = `**** **** **** ${cardData.card_number.split(' ')[3] || cardData.card_number.slice(-4)}`;

    try {
        const result = insertCard.run(
            user.id,
            cardData.card_id,
            cardData.card_id, // bridgecard_ref_id
            maskedPan,
            cardData.card_number,
            holder,
            expiry,
            cardData.cvv,
            type || 'Virtual',
            color || 'from-primary to-secondary',
            balance || 0,
            spendingLimit || 0,
            currency || 'USD'
        )

        return NextResponse.json({
            id: result.lastInsertRowid,
            card_id: cardData.card_id,
            number: cardData.card_number,
            holder,
            expiry,
            type: type || 'Virtual',
            color: color || 'from-primary to-secondary',
            balance: balance || 0,
            spendingLimit: spendingLimit || 0,
            currency: currency || 'USD',
            status: 'Active'
        }, { status: 201 })
    } catch (error) {
        console.error('Error creating card:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
