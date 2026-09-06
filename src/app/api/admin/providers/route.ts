import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { writeAudit } from '@/lib/admin-db'
import {
    CARD_PROVIDERS,
    getProviderSettings,
    providerHealth,
    setProviderSettings,
    type CardProvider,
} from '@/lib/card-provider'
import { badRequest, readJson, withRouteErrors } from '@/lib/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Issuer configuration and live health.
 *
 * Health is probed rather than assumed: a valid Stripe key with Issuing
 * switched off passes every credential check and fails every card call, so the
 * Stripe probe actually hits the Issuing API.
 */
export const GET = withRouteErrors('admin:providers', async () => {
    await requireAdmin()
    const [settings, health] = await Promise.all([getProviderSettings(), providerHealth()])
    return NextResponse.json({ settings, health })
})

export const PATCH = withRouteErrors('admin:providers:set', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<{
        reason?: string
        primary?: CardProvider
        failoverEnabled?: boolean
        sandboxFallback?: boolean
    }>(request)

    const reason = requireReason(body.reason)

    if (body.primary && !CARD_PROVIDERS.includes(body.primary)) {
        badRequest('Unknown card provider', 'INVALID_PROVIDER')
    }

    const { before, after } = await setProviderSettings(
        {
            primary: body.primary,
            failoverEnabled: body.failoverEnabled,
            sandboxFallback: body.sandboxFallback,
        },
        admin.email
    )

    await writeAudit({
        action: 'PROVIDER_SETTINGS_UPDATED',
        actorEmail: admin.email,
        actorClerkId: admin.clerkUserId,
        targetType: 'PLATFORM',
        targetId: 'CARD_PROVIDERS',
        reason,
        before,
        after,
        ip: clientIp(request),
    })

    return NextResponse.json({ settings: after, health: await providerHealth() })
})
