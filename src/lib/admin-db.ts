import { db, sql } from '@/lib/db'
import { decimal, type Decimal } from '@/lib/money'
import type {
    AccountStatus,
    AuditAction,
    AuditEntry,
    DeclineCode,
    DeclineRecord,
    UserLimits,
} from '@/types/admin'

/**
 * Data layer for the superadmin command center.
 *
 * Kept apart from `@/lib/db` on purpose: everything in this module reads or
 * writes *across* users, which is precisely what the user-facing layer must
 * never do. Nothing here is reachable without `requireAdmin`.
 *
 * The schema additions below are additive and idempotent, so an existing
 * database picks them up on the first admin request without a migration step.
 */

let adminSchemaPromise: Promise<void> | undefined

export async function ensureAdminSchema() {
    adminSchemaPromise ??= (async () => {
        // Guarantees the base tables exist before we alter them.
        await db()

        // Override surface on the user row. Defaults are deliberately generous
        // enough not to change behaviour for existing users on migration.
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE'`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_funding_limit NUMERIC(20,2) NOT NULL DEFAULT 5000.00`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_funding_limit NUMERIC(20,2) NOT NULL DEFAULT 50000.00`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_spending_limit NUMERIC(20,2) NOT NULL DEFAULT 5000.00`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_spending_limit NUMERIC(20,2) NOT NULL DEFAULT 50000.00`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ`
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_reviewed_by TEXT`
        await sql`CREATE INDEX IF NOT EXISTS users_account_status_idx ON users(account_status)`
        await sql`CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users(is_admin) WHERE is_admin`

        // Every override lands here before it takes effect. Append-only by
        // convention: nothing in the app updates or deletes a row.
        await sql`CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      actor_clerk_id TEXT,
      target_type TEXT NOT NULL DEFAULT 'PLATFORM',
      target_id TEXT,
      reason TEXT,
      before JSONB,
      after JSONB,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
        await sql`CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(created_at DESC)`
        await sql`CREATE INDEX IF NOT EXISTS admin_audit_target_idx ON admin_audit_log(target_type, target_id)`

        // Kill switch, fee schedule and declared treasury figures.
        await sql`CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`

        // Decline diagnostics. Written by the live authorisation path and by
        // the simulator; `simulated` is the only thing that separates them.
        await sql`CREATE TABLE IF NOT EXISTS card_declines (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      processor_message TEXT,
      card_id TEXT,
      card_last_4 TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      amount NUMERIC(20,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      merchant TEXT NOT NULL DEFAULT 'Unknown merchant',
      merchant_country TEXT,
      simulated BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
        await sql`CREATE INDEX IF NOT EXISTS card_declines_created_idx ON card_declines(created_at DESC)`
        await sql`CREATE INDEX IF NOT EXISTS card_declines_card_idx ON card_declines(card_id)`
    })()
    return adminSchemaPromise
}

/* ------------------------------------------------------- platform settings */

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
    await ensureAdminSchema()
    const rows = await sql`SELECT value FROM platform_settings WHERE key = ${key} LIMIT 1`
    const row = rows[0] as { value: T } | undefined
    return row?.value ?? fallback
}

export async function readSettingRow(key: string) {
    await ensureAdminSchema()
    const rows = await sql`SELECT value, updated_by, updated_at FROM platform_settings WHERE key = ${key} LIMIT 1`
    return rows[0] as { value: Record<string, unknown>; updated_by: string | null; updated_at: string } | undefined
}

export async function writeSetting(key: string, value: unknown, actorEmail: string) {
    await ensureAdminSchema()
    await sql`
    INSERT INTO platform_settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${actorEmail}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`
}

/* -------------------------------------------------------------- audit log */

export async function writeAudit(input: {
    action: AuditAction
    actorEmail: string
    actorClerkId?: string | null
    targetType?: AuditEntry['targetType']
    targetId?: string | null
    reason?: string | null
    before?: unknown
    after?: unknown
    ip?: string | null
}) {
    await ensureAdminSchema()
    const rows = await sql`
    INSERT INTO admin_audit_log
      (action, actor_email, actor_clerk_id, target_type, target_id, reason, before, after, ip)
    VALUES (${input.action}, ${input.actorEmail}, ${input.actorClerkId ?? null},
            ${input.targetType ?? 'PLATFORM'}, ${input.targetId ?? null}, ${input.reason ?? null},
            ${input.before === undefined ? null : JSON.stringify(input.before)}::jsonb,
            ${input.after === undefined ? null : JSON.stringify(input.after)}::jsonb,
            ${input.ip ?? null})
    RETURNING id`
    return (rows[0] as { id: number }).id
}

function serializeAudit(row: Record<string, any>): AuditEntry {
    return {
        id: Number(row.id),
        action: row.action as AuditAction,
        actorEmail: String(row.actor_email),
        actorClerkId: row.actor_clerk_id ?? null,
        targetType: (row.target_type ?? 'PLATFORM') as AuditEntry['targetType'],
        targetId: row.target_id ?? null,
        reason: row.reason ?? null,
        before: (row.before as Record<string, unknown>) ?? null,
        after: (row.after as Record<string, unknown>) ?? null,
        ip: row.ip ?? null,
        createdAt: new Date(row.created_at).toISOString(),
    }
}

export async function listAudit(limit = 100, targetType?: string, targetId?: string) {
    await ensureAdminSchema()
    const rows =
        targetType && targetId
            ? await sql`
        SELECT * FROM admin_audit_log
         WHERE target_type = ${targetType} AND target_id = ${targetId}
         ORDER BY created_at DESC LIMIT ${limit}`
            : await sql`SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ${limit}`
    return (rows as unknown as Array<Record<string, any>>).map(serializeAudit)
}

/* ------------------------------------------------------------- admin users */

/** Emails that may bootstrap themselves into the admin table on first sign-in. */
export function bootstrapAdminEmails(): string[] {
    const configured = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    // The founding account. Present even with no env configured, so a fresh
    // deployment always has exactly one way in.
    return Array.from(new Set(['swippable@gmail.com', ...configured]))
}

export interface AdminUserRow {
    id: number
    uuid: string
    clerk_user_id: string | null
    name: string
    email: string
    image: string | null
    is_admin: boolean
    account_status: AccountStatus
}

/**
 * Resolves a Clerk identity to its admin row, promoting a bootstrap email on
 * first sight and back-filling the identifiers that were unknown until then.
 *
 * The row is matched on email as well as Clerk id: the founder account is
 * created in Clerk and in Postgres independently, so the very first sign-in is
 * the moment the two identities get stitched together.
 */
export async function resolveAdmin(input: {
    clerkUserId: string
    email: string
    name: string
    imageUrl: string | null
}): Promise<{ row: AdminUserRow; bootstrapped: boolean } | null> {
    await ensureAdminSchema()
    const email = input.email.toLowerCase()
    const eligible = bootstrapAdminEmails().includes(email)

    const existing = (
        await sql`SELECT * FROM users WHERE clerk_user_id = ${input.clerkUserId} OR LOWER(email) = ${email} LIMIT 1`
    )[0] as (AdminUserRow & Record<string, any>) | undefined

    if (!existing) {
        if (!eligible) return null
        // Bootstrap email with no row at all - create it fully linked.
        const created = (
            await sql`
        INSERT INTO users (uuid, clerk_user_id, name, email, image, kyc_status, wallet_balance,
                           is_admin, account_status)
        VALUES (${input.clerkUserId}, ${input.clerkUserId}, ${input.name}, ${email}, ${input.imageUrl},
                'VERIFIED', 0.00, TRUE, 'ACTIVE')
        RETURNING *`
        )[0] as AdminUserRow
        return { row: created, bootstrapped: true }
    }

    if (!existing.is_admin && !eligible) return null

    // First sign-in reconciliation.
    //
    // The founder row is seeded by hand in Postgres before the Clerk account
    // exists, so its `uuid` is a placeholder and `clerk_user_id` is null - the
    // real identifiers are only knowable at this exact moment. Every other user
    // row carries `uuid = clerk_user_id` (see `upsertUser`), so the row is
    // brought into that same shape here: both identifiers are set together,
    // and only while the row has never been linked. Once linked, the uuid is
    // stable and is left alone even if the Clerk id later changes.
    const neverLinked = !existing.clerk_user_id
    const needsLink = neverLinked || existing.clerk_user_id !== input.clerkUserId || !existing.is_admin
    if (!needsLink) return { row: existing, bootstrapped: false }

    const updated = (
        await sql`
    UPDATE users
       SET clerk_user_id = ${input.clerkUserId},
           uuid = CASE WHEN ${neverLinked} THEN ${input.clerkUserId} ELSE uuid END,
           is_admin = TRUE,
           account_status = CASE WHEN account_status = 'BANNED' THEN account_status ELSE 'ACTIVE' END,
           kyc_status = 'VERIFIED',
           name = CASE WHEN COALESCE(NULLIF(name, ''), '') = '' THEN ${input.name} ELSE name END,
           image = COALESCE(image, ${input.imageUrl})
     WHERE id = ${existing.id}
    RETURNING *`
    )[0] as AdminUserRow

    return { row: updated, bootstrapped: true }
}

/* --------------------------------------------------------- platform stats */

export async function getPlatformStats() {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE NOT is_admin)::int AS total_users,
      (SELECT COUNT(*) FROM users WHERE NOT is_admin AND account_status = 'ACTIVE')::int AS active_users,
      (SELECT COUNT(*) FROM users WHERE account_status = 'FROZEN')::int AS frozen_users,
      (SELECT COUNT(*) FROM users WHERE account_status = 'BANNED')::int AS banned_users,
      (SELECT COUNT(*) FROM users WHERE UPPER(kyc_status) = 'PENDING' AND NOT is_admin)::int AS pending_kyc,
      (SELECT COUNT(*) FROM cards)::int AS total_cards,
      (SELECT COUNT(*) FROM cards WHERE status = 'ACTIVE')::int AS active_cards,
      (SELECT COALESCE(SUM(wallet_balance), 0)::text FROM users) AS user_liability,
      (SELECT COALESCE(SUM(amount), 0)::text FROM transactions
        WHERE status = 'PENDING' AND type = 'CREDIT') AS pending_deposits,
      (SELECT COUNT(*) FROM transactions
        WHERE status = 'PENDING' AND type = 'CREDIT'
          AND created_at < NOW() - INTERVAL '30 minutes')::int AS stuck_deposits,
      (SELECT COUNT(*) FROM card_declines
        WHERE created_at > NOW() - INTERVAL '24 hours' AND NOT simulated)::int AS declines_24h`
    const row = rows[0] as Record<string, any>
    return {
        totalUsers: Number(row.total_users),
        activeUsers: Number(row.active_users),
        frozenUsers: Number(row.frozen_users),
        bannedUsers: Number(row.banned_users),
        pendingKyc: Number(row.pending_kyc),
        totalCards: Number(row.total_cards),
        activeCards: Number(row.active_cards),
        userLiability: decimal(row.user_liability),
        pendingDeposits: decimal(row.pending_deposits),
        stuckDeposits: Number(row.stuck_deposits),
        declines24h: Number(row.declines_24h),
    }
}

/** Settled deposit and spend volume per day, oldest first. */
export async function getVolumeSeries(days = 14) {
    await ensureAdminSchema()
    const rows = await sql`
    WITH span AS (
      SELECT generate_series(CURRENT_DATE - (${days}::int - 1), CURRENT_DATE, '1 day')::date AS day
    )
    SELECT span.day::text AS day,
           COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'CREDIT'), 0)::text AS deposits,
           COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEBIT'), 0)::text AS spend
      FROM span
      LEFT JOIN transactions t
        ON t.created_at::date = span.day AND t.status = 'SUCCESS'
     GROUP BY span.day
     ORDER BY span.day`
    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        date: String(row.day),
        label: new Date(`${row.day}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        deposits: Number(decimal(row.deposits)),
        spend: Number(decimal(row.spend)),
    }))
}

/** Settled volume per revenue-bearing channel, over a window. */
export async function getChannelVolume(sinceInterval: string | null) {
    await ensureAdminSchema()
    const rows = sinceInterval
        ? await sql`
        SELECT channel,
               COALESCE(SUM(amount), 0)::text AS volume,
               COUNT(*)::int AS count
          FROM transactions
         WHERE status = 'SUCCESS' AND created_at > NOW() - ${sinceInterval}::interval
         GROUP BY channel`
        : await sql`
        SELECT channel,
               COALESCE(SUM(amount), 0)::text AS volume,
               COUNT(*)::int AS count
          FROM transactions
         WHERE status = 'SUCCESS'
         GROUP BY channel`

    const totals: Record<string, { volume: Decimal; count: number }> = {}
    for (const row of rows as unknown as Array<Record<string, any>>) {
        totals[String(row.channel)] = { volume: decimal(row.volume), count: Number(row.count) }
    }
    return totals
}

/** Same shape as getChannelVolume, for the window immediately before it. */
export async function getPreviousChannelVolume(sinceInterval: string) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT channel,
           COALESCE(SUM(amount), 0)::text AS volume,
           COUNT(*)::int AS count
      FROM transactions
     WHERE status = 'SUCCESS'
       AND created_at > NOW() - (${sinceInterval}::interval * 2)
       AND created_at <= NOW() - ${sinceInterval}::interval
     GROUP BY channel`
    const totals: Record<string, { volume: Decimal; count: number }> = {}
    for (const row of rows as unknown as Array<Record<string, any>>) {
        totals[String(row.channel)] = { volume: decimal(row.volume), count: Number(row.count) }
    }
    return totals
}

/* --------------------------------------------------------------- users */

export async function listAdminUsers(input: {
    search?: string
    status?: AccountStatus | 'ALL'
    kyc?: string
    limit?: number
}) {
    await ensureAdminSchema()
    const search = input.search?.trim() ? `%${input.search.trim().toLowerCase()}%` : null
    const status = input.status && input.status !== 'ALL' ? input.status : null
    const kyc = input.kyc && input.kyc !== 'ALL' ? input.kyc.toUpperCase() : null
    const limit = input.limit ?? 100

    const rows = await sql`
    SELECT u.id, u.uuid, u.clerk_user_id, u.name, u.email, u.image, u.kyc_status,
           u.account_status, u.is_admin, u.wallet_balance::text AS wallet_balance, u.currency,
           u.created_at,
           COALESCE(c.card_count, 0)::int AS card_count,
           COALESCE(c.active_count, 0)::int AS active_card_count,
           COALESCE(d.deposits, 0)::text AS lifetime_deposits,
           COALESCE(d.spend, 0)::text AS lifetime_spend,
           s.last_seen_at
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS card_count,
               COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count
          FROM cards GROUP BY user_id
      ) c ON c.user_id = u.id
      LEFT JOIN (
        SELECT user_id,
               SUM(amount) FILTER (WHERE type = 'CREDIT' AND channel IN ('MPESA','CRYPTO')) AS deposits,
               SUM(amount) FILTER (WHERE type = 'DEBIT' AND channel = 'CARD_TRANSACTION') AS spend
          FROM transactions WHERE status = 'SUCCESS' GROUP BY user_id
      ) d ON d.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(last_seen_at) AS last_seen_at FROM app_sessions GROUP BY user_id
      ) s ON s.user_id = u.id
     WHERE (${search}::text IS NULL
            OR LOWER(u.name) LIKE ${search} OR LOWER(u.email) LIKE ${search}
            OR u.uuid = ${input.search ?? ''} OR u.clerk_user_id = ${input.search ?? ''})
       AND (${status}::text IS NULL OR u.account_status = ${status})
       AND (${kyc}::text IS NULL OR UPPER(u.kyc_status) = ${kyc})
     ORDER BY u.created_at DESC
     LIMIT ${limit}`

    return rows as unknown as Array<Record<string, any>>
}

/** Accepts a numeric id, uuid, Clerk id or email. */
export async function findAdminUser(ref: string) {
    await ensureAdminSchema()
    const numeric = /^\d+$/.test(ref) ? Number(ref) : null
    const rows = await sql`
    SELECT u.*, u.wallet_balance::text AS wallet_balance,
           w.base_account_address,
           s.last_seen_at,
           COALESCE(c.card_count, 0)::int AS card_count,
           COALESCE(c.active_count, 0)::int AS active_card_count,
           COALESCE(d.deposits, 0)::text AS lifetime_deposits,
           COALESCE(d.spend, 0)::text AS lifetime_spend
      FROM users u
      LEFT JOIN crypto_wallets w ON w.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(last_seen_at) AS last_seen_at FROM app_sessions GROUP BY user_id
      ) s ON s.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS card_count,
               COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count
          FROM cards GROUP BY user_id
      ) c ON c.user_id = u.id
      LEFT JOIN (
        SELECT user_id,
               SUM(amount) FILTER (WHERE type = 'CREDIT' AND channel IN ('MPESA','CRYPTO')) AS deposits,
               SUM(amount) FILTER (WHERE type = 'DEBIT' AND channel = 'CARD_TRANSACTION') AS spend
          FROM transactions WHERE status = 'SUCCESS' GROUP BY user_id
      ) d ON d.user_id = u.id
     WHERE u.id = ${numeric} OR u.uuid = ${ref} OR u.clerk_user_id = ${ref} OR LOWER(u.email) = ${ref.toLowerCase()}
     LIMIT 1`
    return rows[0] as Record<string, any> | undefined
}

/** What the user has consumed against each cap, in the current day and month. */
export async function getLimitUsage(userId: number) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'CREDIT' AND channel IN ('MPESA','CRYPTO')
          AND created_at >= date_trunc('day', NOW())), 0)::text AS daily_funding,
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'CREDIT' AND channel IN ('MPESA','CRYPTO')
          AND created_at >= date_trunc('month', NOW())), 0)::text AS monthly_funding,
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'DEBIT' AND channel = 'CARD_TRANSACTION'
          AND created_at >= date_trunc('day', NOW())), 0)::text AS daily_spending,
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'DEBIT' AND channel = 'CARD_TRANSACTION'
          AND created_at >= date_trunc('month', NOW())), 0)::text AS monthly_spending
      FROM transactions
     WHERE user_id = ${userId} AND status = 'SUCCESS'`
    const row = rows[0] as Record<string, any>
    return {
        dailyFunding: decimal(row.daily_funding),
        monthlyFunding: decimal(row.monthly_funding),
        dailySpending: decimal(row.daily_spending),
        monthlySpending: decimal(row.monthly_spending),
    }
}

export async function overrideKycStatus(userId: number, status: string, actorEmail: string) {
    await ensureAdminSchema()
    const rows = await sql`
    UPDATE users
       SET kyc_status = ${status}, kyc_reviewed_at = NOW(), kyc_reviewed_by = ${actorEmail}
     WHERE id = ${userId}
    RETURNING id, kyc_status`
    return rows[0] as { id: number; kyc_status: string } | undefined
}

export async function overrideAccountStatus(userId: number, status: AccountStatus) {
    await ensureAdminSchema()
    const rows = await sql`
    UPDATE users SET account_status = ${status} WHERE id = ${userId}
    RETURNING id, account_status`
    return rows[0] as { id: number; account_status: AccountStatus } | undefined
}

export async function overrideUserLimits(userId: number, limits: Partial<UserLimits>) {
    await ensureAdminSchema()
    // COALESCE keeps any field the operator left blank at its current value.
    const rows = await sql`
    UPDATE users
       SET daily_funding_limit    = COALESCE(${limits.dailyFunding ?? null}::numeric, daily_funding_limit),
           monthly_funding_limit  = COALESCE(${limits.monthlyFunding ?? null}::numeric, monthly_funding_limit),
           daily_spending_limit   = COALESCE(${limits.dailySpending ?? null}::numeric, daily_spending_limit),
           monthly_spending_limit = COALESCE(${limits.monthlySpending ?? null}::numeric, monthly_spending_limit)
     WHERE id = ${userId}
    RETURNING daily_funding_limit::text, monthly_funding_limit::text,
              daily_spending_limit::text, monthly_spending_limit::text`
    return rows[0] as Record<string, string> | undefined
}

export async function setAdminNotes(userId: number, notes: string) {
    await ensureAdminSchema()
    await sql`UPDATE users SET admin_notes = ${notes} WHERE id = ${userId}`
}

export function readLimits(row: Record<string, any>): UserLimits {
    return {
        dailyFunding: decimal(row.daily_funding_limit),
        monthlyFunding: decimal(row.monthly_funding_limit),
        dailySpending: decimal(row.daily_spending_limit),
        monthlySpending: decimal(row.monthly_spending_limit),
    }
}

/** True when the account may not transact at all. */
export async function getAccountStatus(userId: number): Promise<AccountStatus> {
    await ensureAdminSchema()
    const rows = await sql`SELECT account_status FROM users WHERE id = ${userId} LIMIT 1`
    return ((rows[0] as { account_status?: string } | undefined)?.account_status ?? 'ACTIVE') as AccountStatus
}

/* -------------------------------------------------------- transactions */

export async function listAdminTransactions(input: {
    channel?: string
    status?: string
    search?: string
    userId?: number
    limit?: number
}) {
    await ensureAdminSchema()
    const channel = input.channel && input.channel !== 'ALL' ? input.channel : null
    const status = input.status && input.status !== 'ALL' ? input.status : null
    const search = input.search?.trim() ? `%${input.search.trim().toLowerCase()}%` : null

    const rows = await sql`
    SELECT t.*, t.amount::text AS amount, t.balance_after::text AS balance_after,
           u.name AS user_name, u.email AS user_email,
           c.last_4,
           CASE WHEN t.status = 'PENDING'
                THEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 60
                ELSE NULL END AS stuck_minutes
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN cards c ON c.card_id = t.card_id
     WHERE (${channel}::text IS NULL OR t.channel = ${channel})
       AND (${status}::text IS NULL OR t.status = ${status})
       AND (${input.userId ?? null}::int IS NULL OR t.user_id = ${input.userId ?? null})
       AND (${search}::text IS NULL
            OR LOWER(t.tx_id) LIKE ${search}
            OR LOWER(t.merchant) LIKE ${search}
            OR LOWER(COALESCE(t.tx_hash, '')) LIKE ${search}
            OR LOWER(u.email) LIKE ${search}
            OR LOWER(COALESCE(t.metadata->>'checkoutRequestId', '')) LIKE ${search}
            OR LOWER(COALESCE(t.metadata->>'mpesaReceipt', '')) LIKE ${search})
     ORDER BY
       CASE WHEN t.status = 'PENDING' THEN 0 ELSE 1 END,
       t.created_at DESC
     LIMIT ${input.limit ?? 150}`
    return rows as unknown as Array<Record<string, any>>
}

export async function findAdminTransaction(txId: string) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT t.*, t.amount::text AS amount, u.name AS user_name, u.email AS user_email
      FROM transactions t JOIN users u ON u.id = t.user_id
     WHERE t.tx_id = ${txId}
        OR t.tx_hash = ${txId}
        OR t.metadata->>'checkoutRequestId' = ${txId}
        OR t.metadata->>'mpesaReceipt' = ${txId}
     LIMIT 1`
    return rows[0] as Record<string, any> | undefined
}

/* --------------------------------------------------------------- cards */

export async function listAdminCards(input: { search?: string; status?: string; userId?: number; limit?: number }) {
    await ensureAdminSchema()
    const search = input.search?.trim() ? `%${input.search.trim().toLowerCase()}%` : null
    const status = input.status && input.status !== 'ALL' ? input.status : null

    const rows = await sql`
    SELECT c.*, c.card_spending_limit::text AS card_spending_limit,
           c.total_spent_by_card::text AS total_spent_by_card,
           u.name AS user_name, u.email AS user_email,
           COALESCE(t.tx_count, 0)::int AS transaction_count,
           COALESCE(d.decline_count, 0)::int AS decline_count
      FROM cards c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS tx_count FROM transactions
         WHERE card_id IS NOT NULL GROUP BY card_id
      ) t ON t.card_id = c.card_id
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS decline_count FROM card_declines
         WHERE card_id IS NOT NULL GROUP BY card_id
      ) d ON d.card_id = c.card_id
     WHERE (${status}::text IS NULL OR c.status = ${status})
       AND (${input.userId ?? null}::int IS NULL OR c.user_id = ${input.userId ?? null})
       AND (${search}::text IS NULL
            OR c.last_4 = ${input.search ?? ''}
            OR LOWER(c.card_id) LIKE ${search}
            OR LOWER(COALESCE(c.flutterwave_card_id, '')) LIKE ${search}
            OR LOWER(u.email) LIKE ${search}
            OR LOWER(COALESCE(c.card_holder, '')) LIKE ${search})
     ORDER BY c.created_at DESC
     LIMIT ${input.limit ?? 150}`
    return rows as unknown as Array<Record<string, any>>
}

export async function findAdminCard(cardRef: string) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT c.*, c.card_spending_limit::text AS card_spending_limit,
           c.total_spent_by_card::text AS total_spent_by_card,
           u.name AS user_name, u.email AS user_email, u.account_status,
           u.wallet_balance::text AS wallet_balance
      FROM cards c JOIN users u ON u.id = c.user_id
     WHERE c.card_id = ${cardRef} OR c.flutterwave_card_id = ${cardRef} OR c.last_4 = ${cardRef}
     LIMIT 1`
    return rows[0] as Record<string, any> | undefined
}

/** Superadmin card override - no per-user scoping, unlike the user-facing path. */
export async function overrideCardStatus(cardId: string, status: string) {
    await ensureAdminSchema()
    const rows = await sql`UPDATE cards SET status = ${status} WHERE card_id = ${cardId} RETURNING *`
    return rows[0] as Record<string, any> | undefined
}

/**
 * Sets a card's allocation outright, bypassing the wallet-backing guard the
 * user-facing path enforces. Refuses only to drop the limit below what has
 * already been spent, which would corrupt the spend counter.
 */
export async function overrideCardLimit(cardId: string, limit: Decimal) {
    await ensureAdminSchema()
    const rows = await sql`
    UPDATE cards
       SET card_spending_limit = ${limit}::numeric, spending_limit = ${limit}::numeric
     WHERE card_id = ${cardId} AND ${limit}::numeric >= total_spent_by_card
    RETURNING *`
    return rows[0] as Record<string, any> | undefined
}

/* ------------------------------------------------------------- declines */

export async function recordDecline(input: {
    code: DeclineCode
    processorMessage?: string | null
    cardId?: string | null
    cardLast4?: string | null
    userId?: number | null
    amount: Decimal
    currency: string
    merchant: string
    merchantCountry?: string | null
    simulated?: boolean
    metadata?: Record<string, unknown>
}) {
    await ensureAdminSchema()
    const rows = await sql`
    INSERT INTO card_declines
      (code, processor_message, card_id, card_last_4, user_id, amount, currency,
       merchant, merchant_country, simulated, metadata)
    VALUES (${input.code}, ${input.processorMessage ?? null}, ${input.cardId ?? null},
            ${input.cardLast4 ?? null}, ${input.userId ?? null}, ${input.amount}::numeric,
            ${input.currency}, ${input.merchant}, ${input.merchantCountry ?? null},
            ${input.simulated ?? false}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
    RETURNING id`
    return (rows[0] as { id: number }).id
}

export async function listDeclines(input: { cardId?: string; limit?: number; includeSimulated?: boolean }) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT d.*, d.amount::text AS amount, u.name AS user_name
      FROM card_declines d
      LEFT JOIN users u ON u.id = d.user_id
     WHERE (${input.cardId ?? null}::text IS NULL OR d.card_id = ${input.cardId ?? null})
       AND (${input.includeSimulated ?? true}::boolean OR NOT d.simulated)
     ORDER BY d.created_at DESC
     LIMIT ${input.limit ?? 60}`
    return (rows as unknown as Array<Record<string, any>>).map(
        (row): DeclineRecord => ({
            id: Number(row.id),
            code: row.code as DeclineCode,
            processorMessage: row.processor_message ?? null,
            cardId: row.card_id ?? null,
            cardLast4: row.card_last_4 ?? null,
            userId: row.user_id ? Number(row.user_id) : null,
            userName: row.user_name ?? null,
            amount: decimal(row.amount),
            currency: String(row.currency).toUpperCase() === 'KES' ? 'KES' : 'USD',
            merchant: String(row.merchant),
            merchantCountry: row.merchant_country ?? null,
            simulated: Boolean(row.simulated),
            metadata: (row.metadata as Record<string, unknown>) ?? {},
            createdAt: new Date(row.created_at).toISOString(),
        })
    )
}

/** Decline counts by code over a window, for the diagnostics summary. */
export async function getDeclineBreakdown(hours = 24) {
    await ensureAdminSchema()
    const rows = await sql`
    SELECT code, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::text AS amount
      FROM card_declines
     WHERE created_at > NOW() - (${hours}::text || ' hours')::interval
     GROUP BY code
     ORDER BY count DESC`
    return (rows as unknown as Array<Record<string, any>>).map((row) => ({
        code: row.code as DeclineCode,
        count: Number(row.count),
        amount: decimal(row.amount),
    }))
}

/* ------------------------------------------------- direct wallet override */

/**
 * Moves a wallet balance directly, with the matching ledger row, bypassing
 * every provider rail. This is the founder's escape hatch for a deposit the
 * rails lost; the caller must have written an audit entry first.
 */
export async function forceWalletMovement(input: {
    userId: number
    txId: string
    amount: Decimal
    reason: string
    actorEmail: string
}) {
    await ensureAdminSchema()
    const rows = await sql`
    WITH moved AS (
      UPDATE users
         SET wallet_balance = wallet_balance + ${input.amount}::numeric
       WHERE id = ${input.userId}
         AND NOT EXISTS (SELECT 1 FROM transactions WHERE tx_id = ${input.txId})
         -- Never leave a wallet negative, even under an admin override.
         AND wallet_balance + ${input.amount}::numeric >= 0
       RETURNING id, wallet_balance
    )
    INSERT INTO transactions
      (tx_id, user_id, amount, currency, usdc_amount_debited, merchant, status, type,
       channel, category, metadata, balance_after)
    SELECT ${input.txId}, moved.id, ABS(${input.amount}::numeric), 'USD', 0,
           'Superadmin adjustment', 'SUCCESS',
           CASE WHEN ${input.amount}::numeric >= 0 THEN 'CREDIT' ELSE 'DEBIT' END,
           'TRANSFER', 'Admin Override',
           ${JSON.stringify({ adminOverride: true, reason: input.reason, actor: input.actorEmail })}::jsonb,
           moved.wallet_balance
      FROM moved
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING id, balance_after::text AS balance_after`
    return (rows[0] as { id: number; balance_after: string } | undefined) ?? null
}

/** Marks a PENDING deposit FAILED without crediting anything. */
export async function forceFailDeposit(txId: string, metadata: Record<string, unknown>) {
    await ensureAdminSchema()
    const rows = await sql`
    UPDATE transactions
       SET status = 'FAILED', metadata = metadata || ${JSON.stringify(metadata)}::jsonb
     WHERE tx_id = ${txId} AND status = 'PENDING'
    RETURNING id, user_id, amount::text AS amount`
    return (rows[0] as { id: number; user_id: number; amount: string } | undefined) ?? null
}
