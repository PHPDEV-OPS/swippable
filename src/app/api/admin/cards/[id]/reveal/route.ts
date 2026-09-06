import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { findAdminCard, writeAudit } from '@/lib/admin-db'
import { pushNotification } from '@/lib/db'
import { fetchSecretsFor, ProviderUnavailableError } from '@/lib/card-provider'
import { HttpError, notFound, readJson, withRouteErrors } from '@/lib/http'
import type { CardRevealResponse } from '@/types/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** How long the client is told to keep the PAN on screen before blanking it. */
const REVEAL_TTL_SECONDS = 30

/**
 * Superadmin PAN / CVV reveal.
 *
 * The strict rules the user-facing reveal follows apply here with one addition:
 * an operator revealing *someone else's* card is a materially different act, so
 * it requires a written reason, is written to the audit log, and notifies the
 * cardholder that their details were viewed by support.
 *
 * No PAN or CVV is ever persisted - the `cards` row holds only the masked pan
 * and last 4 - so this is a fresh authenticated call to the issuer each time
 * and the sensitive values exist only for the lifetime of this response.
 *
 * POST, not GET, so the reveal never lands in a history entry, proxy log or
 * prefetch, and the response is explicitly marked no-store.
 */
export const POST = withRouteErrors('admin:cards:reveal', async (request: Request, ctx: unknown) => {
    const admin = await requireAdmin()
    const { id } = await (ctx as Params).params
    const body = await readJson<{ reason?: string }>(request)
    const reason = requireReason(body.reason)

    const card = await findAdminCard(id)
    if (!card) notFound('Card not found')

    // Audited *before* the secrets are fetched: if the issuer call succeeds and
    // the audit write fails, the reveal would otherwise go unrecorded.
    await writeAudit({
        action: 'CARD_PAN_REVEALED',
        actorEmail: admin.email,
        actorClerkId: admin.clerkUserId,
        targetType: 'CARD',
        targetId: String(card.card_id),
        reason,
        after: {
            last4: card.last_4,
            cardholder: card.card_holder,
            userId: card.user_id,
            userEmail: card.user_email,
        },
        ip: clientIp(request),
    })

    // Routed to whichever issuer minted this card.
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

    // The cardholder sees that support looked, which is what makes the
    // capability accountable rather than merely logged.
    await pushNotification(
        Number(card.user_id),
        'Card details viewed by support',
        `Full details for card •••• ${card.last_4 ?? ''} were revealed by Swippable support.`,
        'SECURITY'
    )

    const payload: CardRevealResponse = {
        pan: secrets.pan,
        cvv: secrets.cvv,
        expiry: `${secrets.expiryMonth}/${secrets.expiryYear}`,
        holder: secrets.holder || card.card_holder || card.billing_name || '',
        last4: String(card.last_4 ?? ''),
        expiresInSeconds: REVEAL_TTL_SECONDS,
    }

    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
        },
    })
})
