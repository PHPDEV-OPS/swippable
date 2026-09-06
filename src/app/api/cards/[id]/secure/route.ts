import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { HttpError, notFound, withRouteErrors } from '@/lib/http'
import { getCardForUser, pushNotification } from '@/lib/db'
import { fetchSecretsFor, ProviderUnavailableError } from '@/lib/card-provider'

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

    // Routed to whichever issuer actually minted this card, so a Stripe card and
    // a Flutterwave one both reveal correctly. A sandbox card has no issuer-side
    // record at all, and says so plainly rather than inventing a number.
    let secrets
    try {
        secrets = await fetchSecretsFor(card)
    } catch (error) {
        if (error instanceof ProviderUnavailableError) {
            throw new HttpError(error.code === 'SANDBOX_CARD' ? 409 : 503, error.message, error.code)
        }
        throw new HttpError(
            502,
            `The issuer could not return the details: ${error instanceof Error ? error.message : 'unreachable'}`,
            'PROVIDER_ERROR'
        )
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
