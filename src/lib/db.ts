import { neon } from '@neondatabase/serverless'
import { decimal, type Decimal } from '@/lib/money'

export const sql = neon(process.env.DATABASE_URL!)

let schemaPromise: Promise<void> | undefined

/**
 * Idempotent schema bootstrap. Mirrors the applied migration so a fresh Neon
 * branch (preview / CI) comes up with the exact production shape.
 */
async function ensureSchema() {
    schemaPromise ??= (async () => {
        await sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE NOT NULL,
      clerk_user_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      image TEXT,
      kyc_status TEXT DEFAULT 'PENDING',
      bridgecard_holder_id TEXT,
      wallet_balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
      currency TEXT NOT NULL DEFAULT 'USD',
      account_status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key ON users(clerk_user_id)`
        // Lives here rather than in the admin schema because `authoriseCardDebit`
        // reads it on the core authorisation path, which must work before an
        // admin request has ever touched this database.
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE'`

        await sql`CREATE TABLE IF NOT EXISTS crypto_wallets (
      id SERIAL PRIMARY KEY,
      wallet_id TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      base_account_address TEXT,
      usdc_balance NUMERIC(20,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
        // A user can link more than one address - a Base account proved at
        // sign-in through Clerk, and a wallet connected in-app - so each address
        // is its own row rather than a single overwritable column.
        await sql`ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`
        await sql`ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE`
        await sql`ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS label TEXT`
        await sql`ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'base'`
        await sql`ALTER TABLE crypto_wallets ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE`
        // An address may only ever belong to one account. Without this, two
        // users could claim the same address and an incoming transfer would
        // credit whichever row the lookup happened to find first.
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS crypto_wallets_address_key
                    ON crypto_wallets (LOWER(base_account_address))
                 WHERE base_account_address IS NOT NULL`
        await sql`CREATE INDEX IF NOT EXISTS crypto_wallets_user_idx ON crypto_wallets(user_id)`

        // No raw PAN or CVV is ever persisted - only the masked pan and last 4.
        await sql`CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      card_id TEXT UNIQUE NOT NULL,
      flutterwave_card_id TEXT,
      bridgecard_ref_id TEXT,
      provider TEXT NOT NULL DEFAULT 'flutterwave',
      brand TEXT NOT NULL DEFAULT 'MASTERCARD',
      masked_pan TEXT,
      last_4 TEXT,
      card_holder TEXT,
      billing_name TEXT,
      expiry_date TEXT,
      type TEXT,
      color TEXT,
      balance NUMERIC(20,2) DEFAULT 0,
      spending_limit NUMERIC(20,2) DEFAULT 0,
      card_spending_limit NUMERIC(20,2) NOT NULL DEFAULT 0.00,
      total_spent_by_card NUMERIC(20,2) NOT NULL DEFAULT 0.00,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS cards_flutterwave_card_id_key ON cards(flutterwave_card_id)`
        await sql`CREATE INDEX IF NOT EXISTS cards_user_id_idx ON cards(user_id)`

        await sql`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      tx_id TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      card_id TEXT,
      amount NUMERIC(20,2),
      currency TEXT DEFAULT 'USD',
      usdc_amount_debited NUMERIC(20,2),
      merchant TEXT,
      status TEXT,
      type TEXT,
      channel TEXT NOT NULL DEFAULT 'CARD_TRANSACTION',
      category TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      balance_after NUMERIC(20,2),
      tx_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
        await sql`CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at DESC)`
        await sql`CREATE INDEX IF NOT EXISTS transactions_channel_idx ON transactions(channel)`

        await sql`CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'PROCESSED',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_key ON webhook_events(provider, event_id)`

        await sql`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'INFO',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
        await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC)`

        await sql`CREATE TABLE IF NOT EXISTS balance_snapshots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(20,2) NOT NULL,
      captured_on DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS balance_snapshots_user_day_key ON balance_snapshots(user_id, captured_on)`

        await sql`CREATE TABLE IF NOT EXISTS conversion_history (
      id SERIAL PRIMARY KEY,
      rate_id TEXT UNIQUE NOT NULL,
      fiat_currency TEXT,
      usdc_rate NUMERIC,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )`

        await sql`CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT DEFAULT 'system',
      currency TEXT DEFAULT 'USD',
      notifications_enabled BOOLEAN DEFAULT TRUE,
      preferences JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`

        await sql`CREATE TABLE IF NOT EXISTS app_sessions (
      id SERIAL PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    })()
    return schemaPromise
}

export async function db() {
    await ensureSchema()
    return sql
}

/* ------------------------------------------------------------------ users */

export interface UserRow {
    id: number
    uuid: string
    clerk_user_id: string | null
    name: string
    email: string
    image: string | null
    kyc_status: string
    wallet_balance: string
    currency: string
    account_status: string
    created_at: string
}

export async function findUserByClerkId(clerkUserId: string) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} OR uuid = ${clerkUserId} LIMIT 1`
    return rows[0] as UserRow | undefined
}

export async function findUserByEmail(email: string) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
    return rows[0] as UserRow | undefined
}

export async function findUserById(id: number) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
    return rows[0] as UserRow | undefined
}

/**
 * Creates the local mirror of a Clerk identity, or returns the existing row.
 * Safe to call concurrently - conflicts on email resolve to the stored row.
 */
export async function upsertUser(input: {
    clerkUserId: string
    name: string
    email: string
    image: string | null
}) {
    await ensureSchema()
    const rows = await sql`
    INSERT INTO users (uuid, clerk_user_id, name, email, image, kyc_status, wallet_balance)
    VALUES (${input.clerkUserId}, ${input.clerkUserId}, ${input.name}, ${input.email}, ${input.image}, 'PENDING', 0.00)
    ON CONFLICT (email) DO UPDATE
      SET clerk_user_id = COALESCE(users.clerk_user_id, EXCLUDED.clerk_user_id),
          name = EXCLUDED.name,
          image = EXCLUDED.image
    RETURNING *`
    return rows[0] as UserRow
}

export async function updateUserKycStatus(status: string, userId: number) {
    await ensureSchema()
    await sql`UPDATE users SET kyc_status = ${status} WHERE id = ${userId}`
}

/** Records today's closing balance so period-over-period deltas are real. */
export async function snapshotBalance(userId: number, balance: Decimal) {
    await ensureSchema()
    await sql`
    INSERT INTO balance_snapshots (user_id, balance)
    VALUES (${userId}, ${balance})
    ON CONFLICT (user_id, captured_on) DO UPDATE SET balance = EXCLUDED.balance`
}

/** Closing balance on the most recent snapshot strictly before today. */
export async function getPreviousBalance(userId: number) {
    await ensureSchema()
    const rows = await sql`
    SELECT balance::text AS balance
      FROM balance_snapshots
     WHERE user_id = ${userId} AND captured_on < CURRENT_DATE
     ORDER BY captured_on DESC
     LIMIT 1`
    const row = rows[0] as { balance: string } | undefined
    return row ? decimal(row.balance) : null
}

/* ------------------------------------------------------------- ledger ops */

interface LedgerInput {
    txId: string
    userId: number
    cardId?: string | null
    amount: Decimal
    currency: string
    type: 'CREDIT' | 'DEBIT'
    channel: string
    status: 'PENDING' | 'SUCCESS' | 'FAILED'
    merchant: string
    category?: string | null
    metadata?: Record<string, unknown>
    txHash?: string | null
}

/**
 * Credits the shared wallet and writes the matching ledger row in a single
 * statement, so the balance and its ledger entry can never diverge.
 * Returns null if `txId` was already recorded (webhook replay).
 */
export async function creditWallet(input: LedgerInput) {
    await ensureSchema()
    const rows = await sql`
    WITH moved AS (
      UPDATE users
         SET wallet_balance = wallet_balance + ${input.amount}::numeric
       WHERE id = ${input.userId}
         -- Replay guard: without this the balance would move again even though
         -- the INSERT below is skipped by ON CONFLICT.
         AND NOT EXISTS (SELECT 1 FROM transactions WHERE tx_id = ${input.txId})
       RETURNING id, wallet_balance
    )
    INSERT INTO transactions
      (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant,
       status, type, channel, category, metadata, balance_after, tx_hash)
    SELECT ${input.txId}, moved.id, ${input.cardId ?? null}, ${input.amount}::numeric,
           ${input.currency}, 0, ${input.merchant}, ${input.status}, ${input.type},
           ${input.channel}, ${input.category ?? null},
           ${JSON.stringify(input.metadata ?? {})}::jsonb, moved.wallet_balance, ${input.txHash ?? null}
      FROM moved
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING id, balance_after`
    return (rows[0] as { id: number; balance_after: string } | undefined) ?? null
}

/** Writes a ledger row without touching the balance (pending deposits). */
export async function recordTransaction(input: LedgerInput) {
    await ensureSchema()
    const rows = await sql`
    INSERT INTO transactions
      (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant,
       status, type, channel, category, metadata, tx_hash)
    VALUES (${input.txId}, ${input.userId}, ${input.cardId ?? null}, ${input.amount}::numeric,
            ${input.currency}, 0, ${input.merchant}, ${input.status}, ${input.type},
            ${input.channel}, ${input.category ?? null},
            ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.txHash ?? null})
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING id`
    return (rows[0] as { id: number } | undefined) ?? null
}

export async function findTransactionByTxId(txId: string) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM transactions WHERE tx_id = ${txId} LIMIT 1`
    return rows[0] as Record<string, any> | undefined
}

/**
 * Settles a PENDING deposit: flips it to SUCCESS and credits the wallet in one
 * statement. A no-op (returns null) if the row is already settled, which makes
 * duplicate provider callbacks harmless.
 */
export async function settlePendingDeposit(txId: string, metadata: Record<string, unknown>) {
    await ensureSchema()
    // The deposit row is claimed with SELECT ... FOR UPDATE and then written
    // exactly once. Postgres applies at most one UPDATE per row per statement,
    // so status and balance_after must be set together in the same UPDATE -
    // splitting them across two CTEs silently drops the second write.
    const rows = await sql`
    WITH pending AS (
      SELECT id, user_id, amount
        FROM transactions
       WHERE tx_id = ${txId} AND status = 'PENDING'
       FOR UPDATE
    ), moved AS (
      UPDATE users u
         SET wallet_balance = u.wallet_balance + pending.amount
        FROM pending
       WHERE u.id = pending.user_id
       RETURNING u.id AS user_id, u.wallet_balance
    )
    UPDATE transactions t
       SET status = 'SUCCESS',
           metadata = t.metadata || ${JSON.stringify(metadata)}::jsonb,
           balance_after = moved.wallet_balance
      FROM pending, moved
     WHERE t.id = pending.id
    RETURNING t.id, t.user_id, t.amount::text AS amount, t.balance_after::text AS balance_after`
    return (rows[0] as { id: number; user_id: number; amount: string; balance_after: string } | undefined) ?? null
}

/**
 * Ages out deposits that were never confirmed.
 *
 * An STK prompt the user ignored, or a declared crypto transfer that never
 * landed, would otherwise sit PENDING forever and keep showing in the UI as
 * if it were still in flight. Nothing is credited here - these rows never
 * moved the balance, so flipping them to FAILED is purely cosmetic bookkeeping.
 *
 * Called lazily on read, so no cron is required.
 */
export async function expireStalePendingDeposits(userId: number) {
    await ensureSchema()
    const rows = await sql`
    UPDATE transactions
       SET status = 'FAILED',
           metadata = metadata || jsonb_build_object(
             'expired', true,
             'expiredAt', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SSZ'),
             'expiryReason', 'No confirmation received before the deposit window closed'
           )
     WHERE user_id = ${userId}
       AND status = 'PENDING'
       AND (
         (channel = 'MPESA' AND created_at < NOW() - ${MPESA_PENDING_TTL}::interval)
         OR (channel = 'CRYPTO' AND created_at < NOW() - ${CRYPTO_PENDING_TTL}::interval)
       )
    RETURNING id, channel`
    return rows as unknown as Array<{ id: number; channel: string }>
}

// An STK prompt expires on the handset in about a minute; the callback follows
// within seconds of approval. Crypto gets far longer - a transfer can sit
// unconfirmed through congestion without being lost.
const MPESA_PENDING_TTL = process.env.MPESA_PENDING_TTL ?? '15 minutes'
const CRYPTO_PENDING_TTL = process.env.CRYPTO_PENDING_TTL ?? '6 hours'

export async function failPendingDeposit(txId: string, metadata: Record<string, unknown>) {
    await ensureSchema()
    const rows = await sql`
    UPDATE transactions
       SET status = 'FAILED', metadata = metadata || ${JSON.stringify(metadata)}::jsonb
     WHERE tx_id = ${txId} AND status = 'PENDING'
    RETURNING id, user_id`
    return (rows[0] as { id: number; user_id: number } | undefined) ?? null
}

/* --------------------------------------------------------------- card ops */

export interface CardRow {
    id: number
    user_id: number
    card_id: string
    flutterwave_card_id: string | null
    provider: string
    brand: string
    masked_pan: string | null
    last_4: string | null
    card_holder: string | null
    billing_name: string | null
    expiry_date: string | null
    type: string | null
    color: string | null
    currency: string
    status: string
    card_spending_limit: string
    total_spent_by_card: string
    created_at: string
}

export async function getCardsByUserId(userId: number) {
    await ensureSchema()
    const rows = await sql`
    SELECT c.*,
           COALESCE(t.tx_count, 0)::int AS transaction_count
      FROM cards c
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS tx_count
          FROM transactions
         WHERE user_id = ${userId} AND card_id IS NOT NULL
         GROUP BY card_id
      ) t ON t.card_id = c.card_id
     WHERE c.user_id = ${userId}
     ORDER BY c.created_at DESC`
    return rows as unknown as Array<CardRow & { transaction_count: number }>
}

export async function getCardByFlutterwaveId(flutterwaveCardId: string) {
    await ensureSchema()
    const rows = await sql`
    SELECT c.*, u.wallet_balance, u.currency AS user_currency, u.account_status
      FROM cards c
      JOIN users u ON u.id = c.user_id
     WHERE c.flutterwave_card_id = ${flutterwaveCardId} OR c.card_id = ${flutterwaveCardId}
     LIMIT 1`
    return rows[0] as
        | (CardRow & { wallet_balance: string; user_currency: string; account_status: string })
        | undefined
}

export async function getCardForUser(userId: number, cardId: string) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM cards WHERE user_id = ${userId} AND card_id = ${cardId} LIMIT 1`
    return rows[0] as CardRow | undefined
}

/**
 * Issues a card only if the wallet can back the requested allocation, and only
 * if that allocation does not exceed what is still unallocated across the
 * user's other cards. The guard and the insert are one statement, so two
 * concurrent issuances cannot both pass the check.
 */
export async function insertCardIfFunded(input: {
    userId: number
    cardId: string
    flutterwaveCardId: string | null
    provider: string
    brand: string
    maskedPan: string
    last4: string
    holder: string
    billingName: string
    expiry: string
    type: string
    color: string
    currency: string
    limit: Decimal
}) {
    await ensureSchema()
    const rows = await sql`
    WITH available AS (
      SELECT u.id,
             u.wallet_balance - COALESCE((
               SELECT SUM(c.card_spending_limit - c.total_spent_by_card)
                 FROM cards c
                WHERE c.user_id = u.id AND c.status <> 'CLOSED'
             ), 0) AS unallocated
        FROM users u
       WHERE u.id = ${input.userId}
    )
    INSERT INTO cards
      (user_id, card_id, flutterwave_card_id, provider, brand, masked_pan, last_4,
       card_holder, billing_name, expiry_date, type, color, currency, status,
       card_spending_limit, total_spent_by_card, spending_limit, balance)
    SELECT ${input.userId}, ${input.cardId}, ${input.flutterwaveCardId}, ${input.provider},
           ${input.brand}, ${input.maskedPan}, ${input.last4}, ${input.holder},
           ${input.billingName}, ${input.expiry}, ${input.type}, ${input.color},
           ${input.currency}, 'ACTIVE', ${input.limit}::numeric, 0.00,
           ${input.limit}::numeric, 0.00
      FROM available
     WHERE available.unallocated >= ${input.limit}::numeric
    RETURNING *`
    return (rows[0] as CardRow | undefined) ?? null
}

/**
 * Moves capital onto (or back off) a card's allocation. Rejects - by returning
 * null - any change that would push total allocations past the wallet balance,
 * or that would drop a card's limit below what it has already spent.
 */
export async function adjustCardAllocation(input: {
    userId: number
    cardId: string
    delta: Decimal
}) {
    await ensureSchema()
    const rows = await sql`
    WITH available AS (
      SELECT u.id,
             u.wallet_balance,
             u.wallet_balance - COALESCE((
               SELECT SUM(c.card_spending_limit - c.total_spent_by_card)
                 FROM cards c
                WHERE c.user_id = u.id AND c.status <> 'CLOSED'
             ), 0) AS unallocated
        FROM users u
       WHERE u.id = ${input.userId}
    )
    UPDATE cards c
       SET card_spending_limit = c.card_spending_limit + ${input.delta}::numeric,
           spending_limit = c.card_spending_limit + ${input.delta}::numeric
      FROM available
     WHERE c.user_id = ${input.userId}
       AND c.card_id = ${input.cardId}
       AND available.unallocated >= ${input.delta}::numeric
       AND c.card_spending_limit + ${input.delta}::numeric >= c.total_spent_by_card
    RETURNING c.*`
    return (rows[0] as CardRow | undefined) ?? null
}

export async function updateCardStatusForUser(userId: number, cardId: string, status: 'ACTIVE' | 'PAUSED') {
    await ensureSchema()
    const rows = await sql`
    UPDATE cards SET status = ${status}
     WHERE user_id = ${userId} AND card_id = ${cardId}
    RETURNING *`
    return (rows[0] as CardRow | undefined) ?? null
}

export async function deleteCardForUser(userId: number, cardId: string) {
    await ensureSchema()
    const rows = await sql`DELETE FROM cards WHERE user_id = ${userId} AND card_id = ${cardId} RETURNING id`
    return (rows[0] as { id: number } | undefined) ?? null
}

/**
 * The real-time authorisation path.
 *
 * One statement performs every check and every mutation together:
 *   - the card exists, belongs to a user, and is ACTIVE
 *   - the owning account is not frozen or banned
 *   - amount <= remaining card allocation (limit - spent)
 *   - wallet_balance >= amount
 * and only then debits the wallet, advances the card's spend counter, and
 * writes the DEBIT ledger row. Any failed check leaves the database untouched
 * and returns null, so the caller can log the decline.
 */
export async function authoriseCardDebit(input: {
    flutterwaveCardId: string
    txId: string
    amount: Decimal
    currency: string
    merchant: string
    category: string
    metadata: Record<string, unknown>
}) {
    await ensureSchema()
    const rows = await sql`
    WITH target AS (
      SELECT c.id AS card_pk, c.card_id, c.user_id, c.last_4
        FROM cards c
        JOIN users u ON u.id = c.user_id
       WHERE (c.flutterwave_card_id = ${input.flutterwaveCardId} OR c.card_id = ${input.flutterwaveCardId})
         AND c.status = 'ACTIVE'
         -- A frozen or banned account declines every authorisation. Checked here
         -- rather than in the caller so it holds for the webhook and the
         -- simulator alike, and cannot race an operator freezing mid-charge.
         AND COALESCE(u.account_status, 'ACTIVE') = 'ACTIVE'
         AND c.card_spending_limit - c.total_spent_by_card >= ${input.amount}::numeric
         AND u.wallet_balance >= ${input.amount}::numeric
         -- Replay guard: an already-settled tx_id yields no target row, so
         -- neither UPDATE below fires. ON CONFLICT alone would not undo them.
         AND NOT EXISTS (SELECT 1 FROM transactions WHERE tx_id = ${input.txId})
    ), debited AS (
      UPDATE users u
         SET wallet_balance = u.wallet_balance - ${input.amount}::numeric
        FROM target
       WHERE u.id = target.user_id
       RETURNING u.id AS user_id, u.wallet_balance
    ), spent AS (
      UPDATE cards c
         SET total_spent_by_card = c.total_spent_by_card + ${input.amount}::numeric,
             balance = c.total_spent_by_card + ${input.amount}::numeric
        FROM target
       WHERE c.id = target.card_pk
       RETURNING c.card_id
    )
    INSERT INTO transactions
      (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant,
       status, type, channel, category, metadata, balance_after)
    SELECT ${input.txId}, debited.user_id, spent.card_id, ${input.amount}::numeric,
           ${input.currency}, ${input.amount}::numeric, ${input.merchant},
           'SUCCESS', 'DEBIT', 'CARD_TRANSACTION', ${input.category},
           ${JSON.stringify(input.metadata)}::jsonb, debited.wallet_balance
      FROM debited, spent
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING id, user_id, card_id, balance_after::text AS balance_after`
    return (rows[0] as { id: number; user_id: number; card_id: string; balance_after: string } | undefined) ?? null
}

/** Reverses a settled card debit (refund / chargeback). */
export async function reverseCardDebit(input: {
    flutterwaveCardId: string
    txId: string
    amount: Decimal
    currency: string
    merchant: string
    metadata: Record<string, unknown>
}) {
    await ensureSchema()
    const rows = await sql`
    WITH target AS (
      SELECT c.id AS card_pk, c.card_id, c.user_id
        FROM cards c
       WHERE (c.flutterwave_card_id = ${input.flutterwaveCardId} OR c.card_id = ${input.flutterwaveCardId})
         -- Replay guard, as in authoriseCardDebit.
         AND NOT EXISTS (SELECT 1 FROM transactions WHERE tx_id = ${input.txId})
       LIMIT 1
    ), credited AS (
      UPDATE users u
         SET wallet_balance = u.wallet_balance + ${input.amount}::numeric
        FROM target
       WHERE u.id = target.user_id
       RETURNING u.id AS user_id, u.wallet_balance
    ), restored AS (
      UPDATE cards c
         SET total_spent_by_card = GREATEST(c.total_spent_by_card - ${input.amount}::numeric, 0),
             balance = GREATEST(c.total_spent_by_card - ${input.amount}::numeric, 0)
        FROM target
       WHERE c.id = target.card_pk
       RETURNING c.card_id
    )
    INSERT INTO transactions
      (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant,
       status, type, channel, category, metadata, balance_after)
    SELECT ${input.txId}, credited.user_id, restored.card_id, ${input.amount}::numeric,
           ${input.currency}, 0, ${input.merchant}, 'SUCCESS', 'CREDIT',
           'CARD_TRANSACTION', 'Refund', ${JSON.stringify(input.metadata)}::jsonb,
           credited.wallet_balance
      FROM credited, restored
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING id, user_id, balance_after::text AS balance_after`
    return (rows[0] as { id: number; user_id: number; balance_after: string } | undefined) ?? null
}

/* ------------------------------------------------------------ webhook log */

/** Claims a webhook id. Returns null when this event was already handled. */
export async function claimWebhookEvent(provider: string, eventId: string, eventType: string, payload: unknown) {
    await ensureSchema()
    const rows = await sql`
    INSERT INTO webhook_events (provider, event_id, event_type, payload, status)
    VALUES (${provider}, ${eventId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, 'RECEIVED')
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id`
    return (rows[0] as { id: number } | undefined) ?? null
}

export async function finishWebhookEvent(id: number, status: string, error?: string) {
    await ensureSchema()
    await sql`UPDATE webhook_events SET status = ${status}, error = ${error ?? null} WHERE id = ${id}`
}

/* ----------------------------------------------------------- notifications */

export async function pushNotification(userId: number, title: string, body: string, kind = 'INFO') {
    await ensureSchema()
    await sql`INSERT INTO notifications (user_id, title, body, kind) VALUES (${userId}, ${title}, ${body}, ${kind})`
}

export async function getNotifications(userId: number, limit = 20) {
    await ensureSchema()
    const rows = await sql`
    SELECT id, title, body, kind, read_at, created_at
      FROM notifications
     WHERE user_id = ${userId}
     ORDER BY created_at DESC
     LIMIT ${limit}`
    return rows as unknown as Array<{
        id: number
        title: string
        body: string
        kind: string
        read_at: string | null
        created_at: string
    }>
}

export async function markNotificationsRead(userId: number) {
    await ensureSchema()
    const rows = await sql`
    UPDATE notifications SET read_at = NOW()
     WHERE user_id = ${userId} AND read_at IS NULL
    RETURNING id`
    return (rows as unknown as Array<{ id: number }>).length
}

/** Dismisses notifications outright. `onlyRead` keeps anything still unread. */
export async function deleteNotifications(userId: number, onlyRead: boolean) {
    await ensureSchema()
    const rows = onlyRead
        ? await sql`DELETE FROM notifications WHERE user_id = ${userId} AND read_at IS NOT NULL RETURNING id`
        : await sql`DELETE FROM notifications WHERE user_id = ${userId} RETURNING id`
    return (rows as unknown as Array<{ id: number }>).length
}

export async function deleteNotification(userId: number, id: number) {
    await ensureSchema()
    const rows = await sql`DELETE FROM notifications WHERE user_id = ${userId} AND id = ${id} RETURNING id`
    return (rows as unknown as Array<{ id: number }>).length > 0
}

/* ------------------------------------------------------------ transactions */

export async function getTransactionsByUserId(userId: number, limit = 200) {
    await ensureSchema()
    const rows = await sql`
    SELECT t.*, c.last_4
      FROM transactions t
      LEFT JOIN cards c ON c.card_id = t.card_id
     WHERE t.user_id = ${userId}
     ORDER BY t.created_at DESC
     LIMIT ${limit}`
    return rows as unknown as Array<Record<string, any>>
}

/* ---------------------------------------------------------------- wallets */

/** The user's primary receive address, or the oldest link if none is flagged. */
export async function getWalletByUserId(userId: number) {
    await ensureSchema()
    const rows = await sql`
    SELECT * FROM crypto_wallets
     WHERE user_id = ${userId}
     ORDER BY is_primary DESC, verified DESC, created_at ASC
     LIMIT 1`
    return rows[0] as
        | { id: number; wallet_id: string; base_account_address: string | null; usdc_balance: string }
        | undefined
}

export interface LinkedWalletRow {
    id: number
    wallet_id: string
    user_id: number
    base_account_address: string
    usdc_balance: string
    source: string
    verified: boolean
    label: string | null
    chain: string
    is_primary: boolean
    created_at: string
}

export type LinkResult =
    | { status: 'LINKED' | 'ALREADY_LINKED'; wallet: LinkedWalletRow }
    | { status: 'TAKEN'; wallet: null }

/**
 * Links an address to a user.
 *
 * Idempotent for the same owner, and refuses outright when the address already
 * belongs to somebody else - which is the whole reason for the unique index.
 * Deposits are matched to a user *by destination address*, so letting two
 * accounts claim one address would mean crediting the wrong person.
 */
export async function linkCryptoAddress(input: {
    userId: number
    walletId: string
    address: string
    source: 'clerk' | 'wallet_connect' | 'manual'
    verified: boolean
    label?: string | null
    chain?: string
}): Promise<LinkResult> {
    await ensureSchema()
    const address = input.address.trim()

    const existing = (
        await sql`SELECT * FROM crypto_wallets WHERE LOWER(base_account_address) = LOWER(${address}) LIMIT 1`
    )[0] as LinkedWalletRow | undefined

    if (existing) {
        if (Number(existing.user_id) !== input.userId) return { status: 'TAKEN', wallet: null }

        // Re-linking through a stronger route upgrades the record: an address
        // typed by hand and later proved at sign-in becomes verified.
        const updated = (
            await sql`
      UPDATE crypto_wallets
         SET verified = crypto_wallets.verified OR ${input.verified},
             source = CASE WHEN ${input.verified} THEN ${input.source} ELSE crypto_wallets.source END,
             label = COALESCE(${input.label ?? null}, crypto_wallets.label)
       WHERE id = ${existing.id}
      RETURNING *`
        )[0] as LinkedWalletRow
        return { status: 'ALREADY_LINKED', wallet: updated }
    }

    // The first address a user links becomes their primary receive address.
    const rows = await sql`
    INSERT INTO crypto_wallets
      (wallet_id, user_id, base_account_address, usdc_balance, source, verified, label, chain, is_primary)
    VALUES (${input.walletId}, ${input.userId}, ${address}, 0, ${input.source}, ${input.verified},
            ${input.label ?? null}, ${input.chain ?? 'base'},
            NOT EXISTS (SELECT 1 FROM crypto_wallets WHERE user_id = ${input.userId}))
    ON CONFLICT DO NOTHING
    RETURNING *`

    const wallet = rows[0] as LinkedWalletRow | undefined
    // A concurrent insert won the race; re-read to report the true owner.
    if (!wallet) {
        const raced = (
            await sql`SELECT * FROM crypto_wallets WHERE LOWER(base_account_address) = LOWER(${address}) LIMIT 1`
        )[0] as LinkedWalletRow | undefined
        if (raced && Number(raced.user_id) === input.userId) return { status: 'ALREADY_LINKED', wallet: raced }
        return { status: 'TAKEN', wallet: null }
    }

    return { status: 'LINKED', wallet }
}

export async function listCryptoWallets(userId: number) {
    await ensureSchema()
    const rows = await sql`
    SELECT * FROM crypto_wallets
     WHERE user_id = ${userId}
     ORDER BY is_primary DESC, verified DESC, created_at ASC`
    return rows as unknown as LinkedWalletRow[]
}

/** Unlinks an address. Promotes another to primary so one always remains. */
export async function unlinkCryptoAddress(userId: number, address: string) {
    await ensureSchema()
    const removed = (
        await sql`
    DELETE FROM crypto_wallets
     WHERE user_id = ${userId} AND LOWER(base_account_address) = LOWER(${address})
    RETURNING id, is_primary`
    )[0] as { id: number; is_primary: boolean } | undefined

    if (!removed) return false

    if (removed.is_primary) {
        await sql`
      UPDATE crypto_wallets SET is_primary = TRUE
       WHERE id = (
         SELECT id FROM crypto_wallets WHERE user_id = ${userId}
          ORDER BY verified DESC, created_at ASC LIMIT 1
       )`
    }
    return true
}

export async function setPrimaryCryptoAddress(userId: number, address: string) {
    await ensureSchema()
    const rows = await sql`
    UPDATE crypto_wallets
       SET is_primary = (LOWER(base_account_address) = LOWER(${address}))
     WHERE user_id = ${userId}
    RETURNING id, base_account_address, is_primary`
    return (rows as unknown as Array<{ is_primary: boolean }>).some((row) => row.is_primary)
}

export async function getWalletAddressOwner(address: string) {
    await ensureSchema()
    const rows = await sql`
    SELECT user_id FROM crypto_wallets WHERE LOWER(base_account_address) = LOWER(${address}) LIMIT 1`
    return (rows[0] as { user_id: number } | undefined) ?? null
}

/** Totals of what is still allocated to, and already spent on, the user's cards. */
export async function getCardAllocationTotals(userId: number) {
    await ensureSchema()
    const rows = await sql`
    SELECT COALESCE(SUM(card_spending_limit - total_spent_by_card), 0)::text AS allocated,
           COALESCE(SUM(total_spent_by_card), 0)::text AS spent,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
      FROM cards
     WHERE user_id = ${userId}`
    const row = rows[0] as { allocated: string; spent: string; total: number; active: number }
    return {
        allocated: decimal(row.allocated),
        spent: decimal(row.spent),
        total: row.total,
        active: row.active,
    }
}

/* --------------------------------------------------------- session upkeep */

export async function touchAppSession(clerkUserId: string, userId: number) {
    await ensureSchema()
    const rows = await sql`
    UPDATE app_sessions SET last_seen_at = NOW()
     WHERE clerk_user_id = ${clerkUserId} AND user_id = ${userId}
    RETURNING id`
    if (!rows[0]) {
        await sql`INSERT INTO app_sessions (clerk_user_id, user_id) VALUES (${clerkUserId}, ${userId})`
    }
}

export async function getUserPreferences(userId: number) {
    await ensureSchema()
    const rows = await sql`SELECT * FROM user_preferences WHERE user_id = ${userId} LIMIT 1`
    return rows[0] as Record<string, unknown> | undefined
}

export async function upsertUserPreferences(
    userId: number,
    theme: string,
    currency: string,
    notificationsEnabled: boolean,
    preferences: Record<string, unknown> = {}
) {
    await ensureSchema()
    const rows = await sql`
    INSERT INTO user_preferences (user_id, theme, currency, notifications_enabled, preferences)
    VALUES (${userId}, ${theme}, ${currency}, ${notificationsEnabled}, ${JSON.stringify(preferences)})
    ON CONFLICT (user_id) DO UPDATE
      SET theme = EXCLUDED.theme, currency = EXCLUDED.currency,
          notifications_enabled = EXCLUDED.notifications_enabled,
          preferences = EXCLUDED.preferences, updated_at = NOW()
    RETURNING *`
    return rows[0]
}
