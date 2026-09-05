/**
 * Precision-safe money helpers.
 *
 * Every amount is carried across the app as a *string* in major units
 * ("125.40") and computed internally as a bigint of minor units (cents).
 * No value ever passes through a JS float, so 0.1 + 0.2 problems and
 * rounding drift are structurally impossible.
 */

const SCALE = 2n
const FACTOR = 100n // 10 ** SCALE

export type Decimal = string

/** Parses "12.5", 12.5, "$12.50", 1250n → minor units (bigint). */
export function toMinor(value: Decimal | number | bigint | null | undefined): bigint {
    if (value === null || value === undefined) return 0n
    if (typeof value === 'bigint') return value

    const raw = String(value).trim().replace(/[^0-9.\-]/g, '')
    if (!raw || raw === '-' || raw === '.') return 0n

    const negative = raw.startsWith('-')
    const [whole = '0', fraction = ''] = raw.replace('-', '').split('.')
    const cents = (fraction + '00').slice(0, Number(SCALE))
    const total = BigInt(whole || '0') * FACTOR + BigInt(cents || '0')

    return negative ? -total : total
}

/** minor units → canonical "0.00" string. */
export function toDecimal(minor: bigint): Decimal {
    const negative = minor < 0n
    const abs = negative ? -minor : minor
    const whole = abs / FACTOR
    const cents = abs % FACTOR
    return `${negative ? '-' : ''}${whole}.${cents.toString().padStart(Number(SCALE), '0')}`
}

/** Normalises any DB / API amount into the canonical decimal string. */
export function decimal(value: Decimal | number | null | undefined): Decimal {
    return toDecimal(toMinor(value))
}

export function add(a: Decimal | number, b: Decimal | number): Decimal {
    return toDecimal(toMinor(a) + toMinor(b))
}

export function subtract(a: Decimal | number, b: Decimal | number): Decimal {
    return toDecimal(toMinor(a) - toMinor(b))
}

/** Compares two amounts. Returns -1, 0 or 1. */
export function compare(a: Decimal | number, b: Decimal | number): -1 | 0 | 1 {
    const left = toMinor(a)
    const right = toMinor(b)
    return left < right ? -1 : left > right ? 1 : 0
}

export function isPositive(value: Decimal | number): boolean {
    return toMinor(value) > 0n
}

export function gte(a: Decimal | number, b: Decimal | number): boolean {
    return toMinor(a) >= toMinor(b)
}

export function sum(values: Array<Decimal | number | null | undefined>): Decimal {
    return toDecimal(values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n))
}

/**
 * Percentage change between two amounts, as a rounded integer.
 * Returns null when there is no prior value to compare against, so the UI
 * can render "—" instead of a fabricated "+100%".
 */
export function percentChange(current: Decimal | number, previous: Decimal | number): number | null {
    const prev = toMinor(previous)
    if (prev === 0n) return null
    const curr = toMinor(current)
    const delta = Number(curr - prev)
    return Math.round((delta / Number(prev)) * 100)
}

/** Share of `part` within `total`, as a number with one decimal place. */
export function percentOf(part: Decimal | number, total: Decimal | number): number {
    const whole = toMinor(total)
    if (whole === 0n) return 0
    return Math.round((Number(toMinor(part)) / Number(whole)) * 1000) / 10
}

/** Presentation helper — "$1,250.40". Amounts arrive as strings, never floats. */
export function formatMoney(value: Decimal | number | null | undefined, currency = 'USD'): string {
    const minor = toMinor(value)
    const negative = minor < 0n
    const abs = negative ? -minor : minor
    const whole = (abs / FACTOR).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const cents = (abs % FACTOR).toString().padStart(2, '0')
    const symbol = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh ' : `${currency} `
    return `${negative ? '-' : ''}${symbol}${whole}.${cents}`
}
