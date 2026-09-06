import { NextResponse } from 'next/server'
import { clientIp, requireAdmin, requireReason } from '@/lib/admin-auth'
import {
    getChannelVolume,
    getPlatformStats,
    getPreviousChannelVolume,
    getVolumeSeries,
    writeAudit,
} from '@/lib/admin-db'
import { getKesPerUsd } from '@/lib/fx'
import { readJson, withRouteErrors } from '@/lib/http'
import { add, decimal, percentChange, percentOf, subtract, toDecimal, toMinor } from '@/lib/money'
import { getFeeSchedule, getKillSwitch, getLiquidity, setFeeSchedule, setLiquidity } from '@/lib/platform'
import type { CommandCenterOverview, LiquidityPosition, RevenueLine, RevenueWindow } from '@/types/admin'
import type { Decimal } from '@/lib/money'

export const dynamic = 'force-dynamic'

const WINDOW_INTERVALS: Record<RevenueWindow, string | null> = {
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    all: null,
}

/** amount x percent, kept in minor units so no float touches the money. */
function applyPercent(amount: Decimal, percent: number): Decimal {
    const basisPoints = BigInt(Math.round(percent * 100))
    return toDecimal((toMinor(amount) * basisPoints) / 10000n)
}

/** flat fee x count. */
function applyFlat(flat: number, count: number): Decimal {
    return toDecimal(BigInt(Math.round(flat * 100)) * BigInt(count))
}

/** amount x rate, where rate is itself a decimal string (e.g. an FX rate). */
function multiply(amount: Decimal, rate: Decimal): Decimal {
    return toDecimal((toMinor(amount) * toMinor(rate)) / 100n)
}

function position(input: {
    declared: Decimal
    currency: LiquidityPosition['currency']
    liability: Decimal
    updatedAt: string | null
    updatedBy: string | null
}): LiquidityPosition {
    return {
        declared: input.declared,
        currency: input.currency,
        liability: input.liability,
        headroom: subtract(input.declared, input.liability),
        utilisation: percentOf(input.liability, input.declared),
        updatedAt: input.updatedAt,
        updatedBy: input.updatedBy,
    }
}

/**
 * The landing screen's data: live liquidity across the three rails, the
 * revenue the fee schedule has earned over the selected window, and the
 * platform counters the founder needs at a glance.
 *
 * Revenue is *derived*, not stored: settled volume per channel is multiplied
 * by the configured fee schedule. That keeps the number honest - it can never
 * drift from the ledger it is computed from - and it moves the moment the
 * schedule is edited.
 */
export const GET = withRouteErrors('admin:overview', async (request: Request) => {
    await requireAdmin()

    const url = new URL(request.url)
    const windowParam = (url.searchParams.get('window') ?? '30d') as RevenueWindow
    const revenueWindow: RevenueWindow = windowParam in WINDOW_INTERVALS ? windowParam : '30d'
    const interval = WINDOW_INTERVALS[revenueWindow]

    const [killSwitch, liquidity, fees, stats, volume, previousVolume, series, kesPerUsd] = await Promise.all([
        getKillSwitch(),
        getLiquidity(),
        getFeeSchedule(),
        getPlatformStats(),
        getChannelVolume(interval),
        interval
            ? getPreviousChannelVolume(interval)
            : Promise.resolve({} as Awaited<ReturnType<typeof getChannelVolume>>),
        getVolumeSeries(14),
        getKesPerUsd(),
    ])

    const mpesa = volume.MPESA ?? { volume: '0.00', count: 0 }
    const crypto = volume.CRYPTO ?? { volume: '0.00', count: 0 }
    const cardFunding = volume.CARD_FUNDING ?? { volume: '0.00', count: 0 }

    const lines: RevenueLine[] = [
        {
            key: 'MPESA_DEPOSIT_FEE',
            label: 'M-Pesa deposit fees',
            volume: mpesa.volume,
            rate: fees.mpesaDepositPercent,
            rateKind: 'PERCENT',
            earned: applyPercent(mpesa.volume, fees.mpesaDepositPercent),
            count: mpesa.count,
        },
        {
            key: 'CRYPTO_FX_SPREAD',
            label: 'Crypto FX conversion spread',
            volume: crypto.volume,
            rate: fees.cryptoFxSpreadPercent,
            rateKind: 'PERCENT',
            earned: applyPercent(crypto.volume, fees.cryptoFxSpreadPercent),
            count: crypto.count,
        },
        {
            key: 'CARD_CREATION_FEE',
            label: 'Card creation fees',
            volume: cardFunding.volume,
            rate: fees.cardCreationFlatUsd,
            rateKind: 'FLAT',
            earned: applyFlat(fees.cardCreationFlatUsd, cardFunding.count),
            count: cardFunding.count,
        },
    ]

    const total = lines.reduce<Decimal>((acc, line) => add(acc, line.earned), '0.00')

    const prevMpesa = previousVolume.MPESA ?? { volume: '0.00', count: 0 }
    const prevCrypto = previousVolume.CRYPTO ?? { volume: '0.00', count: 0 }
    const prevCards = previousVolume.CARD_FUNDING ?? { volume: '0.00', count: 0 }
    const previousTotal = add(
        add(
            applyPercent(prevMpesa.volume, fees.mpesaDepositPercent),
            applyPercent(prevCrypto.volume, fees.cryptoFxSpreadPercent)
        ),
        applyFlat(fees.cardCreationFlatUsd, prevCards.count)
    )

    // Liabilities per rail. The wallet balance is a single USD pool, so the
    // M-Pesa float is measured against pending shilling settlements while the
    // issuer pool is measured against everything committed to live cards.
    const mpesaPendingUsd = decimal(volume.MPESA?.volume ?? 0)
    const cardCommitment = decimal(stats.userLiability)

    const body: CommandCenterOverview = {
        killSwitch,
        liquidity: {
            mpesaFloat: position({
                declared: liquidity.declared.mpesaFloatKes,
                currency: 'KES',
                // Settled M-Pesa volume is held in USD; show the KES it represents.
                liability: multiply(mpesaPendingUsd, kesPerUsd.rate),
                updatedAt: liquidity.updatedAt,
                updatedBy: liquidity.updatedBy,
            }),
            cryptoHotWallet: position({
                declared: liquidity.declared.cryptoHotWalletUsd,
                currency: 'USDT',
                liability: decimal(crypto.volume),
                updatedAt: liquidity.updatedAt,
                updatedBy: liquidity.updatedBy,
            }),
            issuerSettlementPool: position({
                declared: liquidity.declared.issuerSettlementPoolUsd,
                currency: 'USD',
                liability: cardCommitment,
                updatedAt: liquidity.updatedAt,
                updatedBy: liquidity.updatedBy,
            }),
        },
        revenue: {
            lines,
            total,
            previousTotal,
            changePercent: interval ? percentChange(total, previousTotal) : null,
            window: revenueWindow,
        },
        platform: stats,
        volumeSeries: series,
    }

    return NextResponse.json(body)
})

/**
 * Direct treasury override. The three float figures live in provider consoles
 * we cannot read, so the founder declares them here and every edit is audited.
 */
export const PATCH = withRouteErrors('admin:overview:treasury', async (request: Request) => {
    const admin = await requireAdmin()
    const body = await readJson<{
        reason?: string
        mpesaFloatKes?: string
        cryptoHotWalletUsd?: string
        issuerSettlementPoolUsd?: string
        fees?: { mpesaDepositPercent?: number; cryptoFxSpreadPercent?: number; cardCreationFlatUsd?: number }
    }>(request)

    const reason = requireReason(body.reason)

    const liquidityChanged =
        body.mpesaFloatKes !== undefined ||
        body.cryptoHotWalletUsd !== undefined ||
        body.issuerSettlementPoolUsd !== undefined

    if (liquidityChanged) {
        const { before, after } = await setLiquidity(
            {
                mpesaFloatKes: body.mpesaFloatKes,
                cryptoHotWalletUsd: body.cryptoHotWalletUsd,
                issuerSettlementPoolUsd: body.issuerSettlementPoolUsd,
            },
            admin.email
        )
        await writeAudit({
            action: 'LIQUIDITY_UPDATED',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'PLATFORM',
            targetId: 'TREASURY',
            reason,
            before,
            after,
            ip: clientIp(request),
        })
    }

    if (body.fees) {
        const { before, after } = await setFeeSchedule(body.fees, admin.email)
        await writeAudit({
            action: 'LIQUIDITY_UPDATED',
            actorEmail: admin.email,
            actorClerkId: admin.clerkUserId,
            targetType: 'PLATFORM',
            targetId: 'FEE_SCHEDULE',
            reason,
            before,
            after,
            ip: clientIp(request),
        })
    }

    return NextResponse.json({ status: 'ok' })
})
