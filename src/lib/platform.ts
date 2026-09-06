import { readSetting, readSettingRow, writeSetting } from '@/lib/admin-db'
import { HttpError } from '@/lib/http'
import { decimal, type Decimal } from '@/lib/money'
import { PLATFORM_RAILS, type KillSwitchState, type PlatformRail } from '@/types/admin'

/**
 * Platform-wide switches and treasury figures.
 *
 * The kill switch is enforced, not decorative: `assertRailOpen` is called by
 * the deposit, issuance and authorisation paths, so engaging it in the command
 * header genuinely stops money moving within one request.
 */

const KILL_SWITCH_KEY = 'kill_switch'
const LIQUIDITY_KEY = 'liquidity'
const FEE_SCHEDULE_KEY = 'fee_schedule'

interface StoredKillSwitch {
    engaged: boolean
    rails: Partial<Record<PlatformRail, boolean>>
    reason: string | null
    engagedBy: string | null
    engagedAt: string | null
}

const DEFAULT_KILL_SWITCH: StoredKillSwitch = {
    engaged: false,
    rails: {},
    reason: null,
    engagedBy: null,
    engagedAt: null,
}

function hydrate(stored: StoredKillSwitch): KillSwitchState {
    const rails = Object.fromEntries(
        PLATFORM_RAILS.map((rail) => [rail, Boolean(stored.rails?.[rail])])
    ) as Record<PlatformRail, boolean>

    return {
        engaged: Boolean(stored.engaged),
        rails,
        reason: stored.reason ?? null,
        engagedBy: stored.engagedBy ?? null,
        engagedAt: stored.engagedAt ?? null,
        // The master switch subsumes the individual flags.
        haltedRails: stored.engaged ? [...PLATFORM_RAILS] : PLATFORM_RAILS.filter((rail) => rails[rail]),
    }
}

export async function getKillSwitch(): Promise<KillSwitchState> {
    return hydrate(await readSetting<StoredKillSwitch>(KILL_SWITCH_KEY, DEFAULT_KILL_SWITCH))
}

export async function setKillSwitch(
    input: { engaged?: boolean; rails?: Partial<Record<PlatformRail, boolean>>; reason?: string | null },
    actorEmail: string
): Promise<{ before: KillSwitchState; after: KillSwitchState }> {
    const stored = await readSetting<StoredKillSwitch>(KILL_SWITCH_KEY, DEFAULT_KILL_SWITCH)
    const before = hydrate(stored)

    const engaged = input.engaged ?? stored.engaged
    const rails = { ...stored.rails, ...(input.rails ?? {}) }
    const nowEngaged = engaged || Object.values(rails).some(Boolean)

    const next: StoredKillSwitch = {
        engaged,
        rails,
        reason: input.reason ?? (nowEngaged ? stored.reason : null),
        // Attribution is cleared when everything is released, so a stale
        // "engaged by" never lingers next to a green header.
        engagedBy: nowEngaged ? actorEmail : null,
        engagedAt: nowEngaged ? (before.haltedRails.length ? stored.engagedAt : new Date().toISOString()) : null,
    }

    await writeSetting(KILL_SWITCH_KEY, next, actorEmail)
    return { before, after: hydrate(next) }
}

/**
 * Throws a 503 when the rail is halted. Called from the money paths, so the
 * switch takes effect on the very next request rather than at the next deploy.
 */
export async function assertRailOpen(rail: PlatformRail) {
    const state = await getKillSwitch()
    if (!state.haltedRails.includes(rail)) return

    throw new HttpError(
        503,
        state.reason
            ? `This is paused platform-wide right now: ${state.reason}`
            : 'This is paused platform-wide right now. Please try again shortly.',
        'RAIL_HALTED'
    )
}

/** Non-throwing variant, for the authorisation path which must decline, not error. */
export async function isRailHalted(rail: PlatformRail): Promise<boolean> {
    const state = await getKillSwitch()
    return state.haltedRails.includes(rail)
}

/* ---------------------------------------------------------- liquidity */

export interface StoredLiquidity {
    mpesaFloatKes: Decimal
    cryptoHotWalletUsd: Decimal
    issuerSettlementPoolUsd: Decimal
}

const DEFAULT_LIQUIDITY: StoredLiquidity = {
    mpesaFloatKes: '0.00',
    cryptoHotWalletUsd: '0.00',
    issuerSettlementPoolUsd: '0.00',
}

export async function getLiquidity() {
    const row = await readSettingRow(LIQUIDITY_KEY)
    const value = (row?.value as unknown as StoredLiquidity | undefined) ?? DEFAULT_LIQUIDITY
    return {
        declared: {
            mpesaFloatKes: decimal(value.mpesaFloatKes),
            cryptoHotWalletUsd: decimal(value.cryptoHotWalletUsd),
            issuerSettlementPoolUsd: decimal(value.issuerSettlementPoolUsd),
        },
        updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
        updatedBy: row?.updated_by ?? null,
    }
}

export async function setLiquidity(input: Partial<StoredLiquidity>, actorEmail: string) {
    const current = await getLiquidity()
    const next: StoredLiquidity = {
        mpesaFloatKes: decimal(input.mpesaFloatKes ?? current.declared.mpesaFloatKes),
        cryptoHotWalletUsd: decimal(input.cryptoHotWalletUsd ?? current.declared.cryptoHotWalletUsd),
        issuerSettlementPoolUsd: decimal(input.issuerSettlementPoolUsd ?? current.declared.issuerSettlementPoolUsd),
    }
    await writeSetting(LIQUIDITY_KEY, next, actorEmail)
    return { before: current.declared, after: next }
}

/* -------------------------------------------------------- fee schedule */

export interface FeeSchedule {
    /** Percentage taken on each settled M-Pesa deposit. */
    mpesaDepositPercent: number
    /** Spread, in percent, kept on each crypto deposit's FX conversion. */
    cryptoFxSpreadPercent: number
    /** Flat USD fee charged when a virtual card is minted. */
    cardCreationFlatUsd: number
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
    mpesaDepositPercent: 1.5,
    cryptoFxSpreadPercent: 0.8,
    cardCreationFlatUsd: 2,
}

export async function getFeeSchedule(): Promise<FeeSchedule> {
    const stored = await readSetting<Partial<FeeSchedule>>(FEE_SCHEDULE_KEY, {})
    return { ...DEFAULT_FEE_SCHEDULE, ...stored }
}

export async function setFeeSchedule(input: Partial<FeeSchedule>, actorEmail: string) {
    const before = await getFeeSchedule()
    const after = { ...before, ...input }
    await writeSetting(FEE_SCHEDULE_KEY, after, actorEmail)
    return { before, after }
}
