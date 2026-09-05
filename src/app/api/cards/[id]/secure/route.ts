import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { HttpError, notFound, withRouteErrors } from '@/lib/http'
import { getCardForUser, pushNotification } from '@/lib/db'
import { fetchCardSecrets, FlutterwaveError, isFlutterwaveConfigured } from '@/lib/flutterwave'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * One-off reveal of a card's full number and CVV.
 *
 * These values are never stored - the `cards` row holds only the masked pan and
 * last 4 - so each reveal is a fresh authenticated call to Flutterwave and the
 * sensitive data exists only for the lifetime of this response.
 *
 * POST rather than GET so the reveal never lands in a browser history entry,
 * a proxy log, or a prefetch. The response is explicitly marked no-store.
 */
export const POST = withRouteErrors('cards:secure', async (_request: Request, ctx: unknown) => {
    const user = await requireUser()
    const { id } = await (ctx as Params).params

    const card = await getCardForUser(user.id, id)
    if (!card) notFound('Card not found')

    // A sandbox card has no provider-side record, so there is nothing real to
    // reveal. Say so plainly rather than inventing a plausible-looking number.
    if (card.provider !== 'flutterwave' || !card.flutterwave_card_id) {
        throw new HttpError(
            409,
            'This is a sandbox card, so it has no real card number to reveal. Cards issued once Flutterwave is configured can be revealed here.',
            'SANDBOX_CARD'
        )
    }

    if (!isFlutterwaveConfigured()) {
        throw new HttpError(
            503,
            'Flutterwave credentials are not configured, so card details cannot be retrieved.',
            'PROVIDER_UNCONFIGURED'
        )
    }

    let secrets
    try {
        secrets = await fetchCardSecrets(card.flutterwave_card_id)
    } catch (error) {
        if (error instanceof FlutterwaveError) {
            throw new HttpError(502, `Flutterwave could not return the details: ${error.message}`, 'PROVIDER_ERROR')
        }
        throw error
    }

    // Reveals are security-relevant, so they leave a trail the user can see.
    await pushNotification(
        user.id,
        'Card details viewed',
        `Full details for card •••• ${card.last_4 ?? ''} were revealed.`,
        'SECURITY'
    )

    return NextResponse.json(
        {
            pan: secrets.pan,
            cvv: secrets.cvv,
            expiry: `${secrets.expiryMonth}/${secrets.expiryYear}`,
            holder: secrets.holder || card.card_holder || card.billing_name || '',
            last4: card.last_4,
        },
        {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                Pragma: 'no-cache',
            },
        }
    )
})
