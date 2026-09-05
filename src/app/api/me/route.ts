import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withRouteErrors } from '@/lib/http'
import { snapshotBalance } from '@/lib/db'
import { decimal } from '@/lib/money'
import type { KycStatus, MeResponse } from '@/types/api'

export const dynamic = 'force-dynamic'

/** The signed-in user plus their live wallet balance. */
export const GET = withRouteErrors('me', async () => {
    const user = await requireUser()

    // Keep today's closing balance current so month-over-month deltas are real.
    await snapshotBalance(user.id, decimal(user.wallet_balance))

    const body: MeResponse = {
        id: user.id,
        clerkUserId: user.clerk_user_id ?? user.uuid,
        name: user.name,
        email: user.email,
        imageUrl: user.image,
        kycStatus: (String(user.kyc_status ?? 'PENDING').toUpperCase() as KycStatus) ?? 'PENDING',
        walletBalance: decimal(user.wallet_balance),
        currency: String(user.currency).toUpperCase() === 'KES' ? 'KES' : 'USD',
        createdAt: new Date(user.created_at).toISOString(),
    }

    return NextResponse.json(body)
})
