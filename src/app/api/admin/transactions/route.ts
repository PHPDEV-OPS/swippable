import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import { findAdminTransaction, forceFailDeposit, listAdminTransactions, writeAudit } from '@/lib/admin-db'
import { serializeAdminTransaction } from '@/lib/admin-serialize'
import { claimWebhookEvent, finishWebhookEvent, pushNotification, settlePendingDeposit } from '@/lib/db'
import { badRequest, notFound, readJson, withRouteErrors } from '@/lib/http'
import { decimal, formatMoney } from '@/lib/money'
import type { InterventionRequest, InterventionResult } from '@/types/admin'

export const dynamic = 'force-dynamic'

export const GET = withRouteErrors('admin:transactions', async (request: Request) => {
    await requireAdmin()
    const params = new URL(request.url).searchParams

    const rows = await listAdminTransactions({
        channel: params.get('channel') ?? undefined,
        status: params.get('status') ?? undefined,
        search: params.get('q') ?? undefined,
        limit: Number(params.get('limit') ?? 150),
    })

    return NextResponse.json(rows.map(serializeAdminTransaction))
})

/**
 * Manual intervention on a stuck deposit - the two-rail module's action.
 *
 * Both rails fail the same way in practice: the money moved at the provider
 * but the callback never arrived, leaving a PENDING row that will age out to
 * FAILED and lose the user their deposit. Forcing reconciliation here settles
 * that row through *exactly* the same guarded statement the webhook uses
 * (`settlePendingDeposit`), so a manual credit and an automatic one are
 * indistinguishable afterwards and cannot double-credit each other: whichever
 * lands second finds nothing PENDING and becomes a no-op.
 *
 * The webhook event id is claimed too, so a late provider callback for the
 * same reference is dropped as a duplicate rather than reprocessed.
 */
export const POST = withRouteErrors('admin:transactions:intervene', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<InterventionRequest>(request)
    const reason = requireReason(body.reason)

    if (!body.txId) badRequest('A transaction id is required', 'TX_ID_REQUIRED')

    const row = await findAdminTransaction(body.txId)
    if (!row) notFound('Transaction not found')

    const txId = String(row.tx_id)
    const ip = clientIp(request)
    const isMpesa = String(row.channel).toUpperCase() === 'MPESA'

    if (body.action === 'FORCE_FAIL') {
        const failed = await forceFailDeposit(txId, {
            forcedFail: true,
            forcedBy: admin.email,
            forcedReason: reason,
            forcedAt: new Date().toISOString(),
        })

        await writeAudit({
            action: 'FORCE_FAIL',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'TRANSACTION',
            targetId: txId,
            reason,
            before: { status: row.status },
            after: { status: failed ? 'FAILED' : row.status },
            ip,
        })

        if (failed) {
            await pushNotification(
                failed.user_id,
                'Deposit could not be completed',
                `Your ${isMpesa ? 'M-Pesa' : 'crypto'} deposit of ${formatMoney(failed.amount)} was not received and has been closed.`,
                'WARNING'
            )
        }

        const result: InterventionResult = {
            status: failed ? 'FAILED' : 'NOOP',
            txId,
            creditedAmount: null,
            balanceAfter: null,
            message: failed
                ? 'Deposit marked failed. Nothing was credited.'
                : 'Nothing to do - this deposit was no longer pending.',
        }
        return NextResponse.json(result)
    }

    if (body.action !== 'FORCE_RECONCILE' && body.action !== 'COMPLETE_WEBHOOK') {
        badRequest('Unknown intervention', 'INVALID_ACTION')
    }

    if (String(row.status).toUpperCase() !== 'PENDING') {
        const result: InterventionResult = {
            status: 'NOOP',
            txId,
            creditedAmount: null,
            balanceAfter: null,
            message: `This deposit is already ${String(row.status).toLowerCase()} - no credit was applied.`,
        }
        return NextResponse.json(result)
    }

    // Claim the provider event id so a late genuine callback is deduplicated
    // against this manual settlement instead of reprocessing it.
    const providerEventId = isMpesa
        ? String(row.metadata?.checkoutRequestId ?? txId.replace(/^mpesa_/, ''))
        : String(row.tx_hash ?? txId.replace(/^crypto_/, '')).toLowerCase()

    const claim = await claimWebhookEvent(
        isMpesa ? 'mpesa' : 'crypto',
        providerEventId,
        'admin_manual_reconciliation',
        { adminOverride: true, actor: admin.email, reason }
    )

    const settled = await settlePendingDeposit(txId, {
        manualReconciliation: true,
        reconciledBy: admin.email,
        reconciledAt: new Date().toISOString(),
        reconciliationReason: reason,
        ...(body.mpesaReceipt ? { mpesaReceipt: body.mpesaReceipt } : {}),
        ...(body.confirmations !== undefined ? { confirmations: Number(body.confirmations) } : {}),
    })

    if (claim) {
        await finishWebhookEvent(claim.id, settled ? 'SETTLED' : 'ORPHANED', settled ? undefined : 'nothing pending')
    }

    await writeAudit({
        action: body.action === 'COMPLETE_WEBHOOK' ? 'WEBHOOK_COMPLETED' : 'FORCE_RECONCILE',
        actorEmail: admin.email,
        actorClerkId: admin.clerkUserId,
        targetType: 'TRANSACTION',
        targetId: txId,
        reason,
        before: { status: 'PENDING', balanceAfter: null },
        after: settled
            ? { status: 'SUCCESS', credited: settled.amount, balanceAfter: settled.balance_after }
            : { status: 'PENDING' },
        ip,
    })

    if (!settled) {
        const result: InterventionResult = {
            status: 'NOOP',
            txId,
            creditedAmount: null,
            balanceAfter: null,
            message: 'The deposit settled elsewhere before this ran. Nothing was double-credited.',
        }
        return NextResponse.json(result)
    }

    await pushNotification(
        settled.user_id,
        'Deposit credited',
        `${formatMoney(settled.amount)} from your ${isMpesa ? 'M-Pesa' : 'crypto'} deposit has been credited. Balance ${formatMoney(settled.balance_after)}.`,
        'SUCCESS'
    )

    const result: InterventionResult = {
        status: 'SETTLED',
        txId,
        creditedAmount: decimal(settled.amount),
        balanceAfter: decimal(settled.balance_after),
        message: `Credited ${formatMoney(settled.amount)}. Wallet is now ${formatMoney(settled.balance_after)}.`,
    }
    return NextResponse.json(result)
})
