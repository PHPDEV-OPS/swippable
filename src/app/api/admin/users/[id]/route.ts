import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import {
    findAdminUser,
    forceWalletMovement,
    getLimitUsage,
    listAdminCards,
    listAdminTransactions,
    listAudit,
    overrideAccountStatus,
    overrideKycStatus,
    overrideUserLimits,
    readLimits,
    setAdminNotes,
    writeAudit,
} from '@/lib/admin-db'
import { serializeAdminCard, serializeAdminTransaction, serializeAdminUser } from '@/lib/admin-serialize'
import { listKycAttempts, pushNotification } from '@/lib/db'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney, toMinor } from '@/lib/money'
import type {
    AccountStatus,
    AdminUserDetail,
    KycIdentityRecord,
    UserOverrideRequest,
} from '@/types/admin'
import type { KycStatus } from '@/types/api'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Admins may also park an account back at UNVERIFIED (ask the user to redo
// the check) or mark it FAILED, so the override vocabulary matches the
// lifecycle the verification flow actually produces.
const KYC_VALUES: KycStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED', 'REJECTED']
const STATUS_VALUES: AccountStatus[] = ['ACTIVE', 'FROZEN', 'BANNED']

/** The 360° profile: identity, limits with live usage, cards, ledger, trail. */
export const GET = withRouteErrors('admin:user:get', async (_request: Request, ctx: unknown) => {
    await requireAdmin()
    const { id } = await (ctx as Params).params

    const row = await findAdminUser(id)
    if (!row) notFound('User not found')

    const [usage, cards, transactions, auditTrail, kycAttempts] = await Promise.all([
        getLimitUsage(row.id),
        listAdminCards({ userId: row.id, limit: 24 }),
        listAdminTransactions({ userId: row.id, limit: 30 }),
        listAudit(30, 'USER', String(row.id)),
        listKycAttempts(row.id, 20),
    ])

    const body: AdminUserDetail = {
        ...serializeAdminUser(row),
        limits: readLimits(row),
        usage,
        adminNotes: row.admin_notes ?? null,
        kycReviewedAt: row.kyc_reviewed_at ? new Date(row.kyc_reviewed_at).toISOString() : null,
        kycReviewedBy: row.kyc_reviewed_by ?? null,
        kycIdentity: serializeKycIdentity(row),
        kycAttempts: kycAttempts.map((attempt) => ({
            id: Number(attempt.id),
            provider: String(attempt.provider ?? 'dojah'),
            outcome: String(attempt.outcome),
            reference: attempt.reference ?? null,
            mismatchedFields: attempt.mismatched_fields ?? [],
            detail: attempt.detail ?? null,
            createdAt: new Date(attempt.created_at).toISOString(),
        })),
        onChainAddress: row.base_account_address ?? null,
        cards: cards.map(serializeAdminCard),
        recentTransactions: transactions.map(serializeAdminTransaction),
        auditTrail,
    }

    return NextResponse.json(body)
})

/**
 * Shapes the stored identity for review, masking the national ID to its last
 * four digits. Returns null when nothing has been verified yet, so the UI can
 * distinguish "no identity on file" from "identity with blank fields".
 */
function serializeKycIdentity(row: {
    first_name?: string | null
    last_name?: string | null
    national_id_number?: string | null
    date_of_birth?: string | null
    verified_at?: string | null
    dojah_reference?: string | null
}): KycIdentityRecord | null {
    const hasIdentity = row.first_name || row.last_name || row.national_id_number
    if (!hasIdentity) return null

    const id = row.national_id_number ?? null

    return {
        firstName: row.first_name ?? null,
        lastName: row.last_name ?? null,
        nationalIdMasked: id ? `${'•'.repeat(Math.max(0, id.length - 4))}${id.slice(-4)}` : null,
        dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : null,
        verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
        dojahReference: row.dojah_reference ?? null,
    }
}

/**
 * The override endpoint.
 *
 * Everything a founder can do to an account happens here, and every branch
 * writes to the audit log with the before/after pair *and* the operator's
 * stated reason. Nothing is a passive edit: a KYC flip is a deliberate bypass,
 * a limit change overrides the platform default, and a force-credit moves real
 * money outside the provider rails.
 */
export const PATCH = withRouteErrors('admin:user:override', async (request: Request, ctx: unknown) => {
    const admin = await requireAdmin()
    const { id } = await (ctx as Params).params
    const body = await readJson<UserOverrideRequest>(request)
    const reason = requireReason(body.reason)

    const row = await findAdminUser(id)
    if (!row) notFound('User not found')

    const ip = clientIp(request)
    const applied: string[] = []

    if (body.kycStatus) {
        const next = String(body.kycStatus).toUpperCase() as KycStatus
        if (!KYC_VALUES.includes(next)) badRequest('Unknown KYC status', 'INVALID_KYC_STATUS')

        await overrideKycStatus(row.id, next, admin.email)
        await writeAudit({
            action: 'KYC_OVERRIDE',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'USER',
            targetId: String(row.id),
            reason,
            before: { kycStatus: row.kyc_status },
            after: { kycStatus: next },
            ip,
        })
        await pushNotification(
            row.id,
            next === 'VERIFIED' ? 'Identity verified' : 'Identity review updated',
            next === 'VERIFIED'
                ? 'Your identity check was approved. Full deposit and card limits are now available.'
                : `Your identity review status is now ${next.toLowerCase()}.`,
            next === 'VERIFIED' ? 'SUCCESS' : 'INFO'
        )
        applied.push(`KYC → ${next}`)
    }

    if (body.accountStatus) {
        const next = String(body.accountStatus).toUpperCase() as AccountStatus
        if (!STATUS_VALUES.includes(next)) badRequest('Unknown account status', 'INVALID_ACCOUNT_STATUS')
        if (row.is_admin && next !== 'ACTIVE') {
            badRequest('A superadmin account cannot be frozen or banned', 'CANNOT_RESTRICT_ADMIN')
        }

        await overrideAccountStatus(row.id, next)
        await writeAudit({
            action: 'ACCOUNT_STATUS_OVERRIDE',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'USER',
            targetId: String(row.id),
            reason,
            before: { accountStatus: row.account_status },
            after: { accountStatus: next },
            ip,
        })
        await pushNotification(
            row.id,
            next === 'ACTIVE' ? 'Account restored' : next === 'FROZEN' ? 'Account frozen' : 'Account closed',
            next === 'ACTIVE'
                ? 'Your account is active again. Deposits and card payments have resumed.'
                : `Your account has been ${next.toLowerCase()}. Contact support for details.`,
            next === 'ACTIVE' ? 'SUCCESS' : 'SECURITY'
        )
        applied.push(`Status → ${next}`)
    }

    if (body.limits && Object.keys(body.limits).length > 0) {
        const limits = {
            dailyFunding: body.limits.dailyFunding === undefined ? undefined : decimal(body.limits.dailyFunding),
            monthlyFunding: body.limits.monthlyFunding === undefined ? undefined : decimal(body.limits.monthlyFunding),
            dailySpending: body.limits.dailySpending === undefined ? undefined : decimal(body.limits.dailySpending),
            monthlySpending:
                body.limits.monthlySpending === undefined ? undefined : decimal(body.limits.monthlySpending),
        }

        if (Object.values(limits).some((value) => value !== undefined && toMinor(value) < 0n)) {
            badRequest('Limits cannot be negative', 'INVALID_LIMIT')
        }

        const after = await overrideUserLimits(row.id, limits)
        await writeAudit({
            action: 'LIMITS_OVERRIDE',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'USER',
            targetId: String(row.id),
            reason,
            before: readLimits(row),
            after,
            ip,
        })
        applied.push('Limits updated')
    }

    if (body.adminNotes !== undefined) {
        await setAdminNotes(row.id, String(body.adminNotes).slice(0, 2000))
        applied.push('Notes updated')
    }

    if (body.forceCredit !== undefined && toMinor(decimal(body.forceCredit)) !== 0n) {
        const amount = decimal(body.forceCredit)
        const txId = `adminfix_${randomUUID().replace(/-/g, '').slice(0, 24)}`

        const moved = await forceWalletMovement({
            userId: row.id,
            txId,
            amount,
            reason,
            actorEmail: admin.email,
        })

        if (!moved) {
            badRequest(
                'The adjustment was refused - it would take the wallet below zero.',
                'ADJUSTMENT_REJECTED'
            )
        }

        await writeAudit({
            action: 'FORCE_CREDIT',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'USER',
            targetId: String(row.id),
            reason,
            before: { walletBalance: decimal(row.wallet_balance) },
            after: { walletBalance: moved.balance_after, amount, txId },
            ip,
        })

        await pushNotification(
            row.id,
            toMinor(amount) > 0n ? 'Wallet credited' : 'Wallet adjusted',
            `${formatMoney(amount)} was applied to your wallet by Swippable support. New balance ${formatMoney(moved.balance_after)}.`,
            'INFO'
        )
        applied.push(`Wallet ${toMinor(amount) > 0n ? 'credited' : 'debited'} ${formatMoney(amount)}`)
    }

    if (applied.length === 0) badRequest('No override was supplied', 'NOTHING_TO_APPLY')

    const refreshed = await findAdminUser(String(row.id))

    return NextResponse.json({
        status: 'ok',
        applied,
        user: refreshed ? serializeAdminUser(refreshed) : null,
    })
})
