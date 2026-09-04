import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
let schemaPromise: Promise<void> | undefined

async function ensureSchema() {
  schemaPromise ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      image TEXT,
      kyc_status TEXT DEFAULT 'PENDING',
      bridgecard_holder_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS crypto_wallets (
      id SERIAL PRIMARY KEY,
      wallet_id TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      base_account_address TEXT,
      usdc_balance NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      card_id TEXT UNIQUE NOT NULL,
      bridgecard_ref_id TEXT,
      masked_pan TEXT,
      card_number TEXT,
      card_holder TEXT,
      expiry_date TEXT,
      cvv TEXT,
      type TEXT,
      color TEXT,
      balance NUMERIC DEFAULT 0,
      spending_limit NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      tx_id TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      card_id TEXT,
      amount NUMERIC,
      currency TEXT,
      usdc_amount_debited NUMERIC,
      merchant TEXT,
      status TEXT,
      type TEXT,
      tx_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
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

export async function findUserByEmail(email: string) {
  await ensureSchema()
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  return rows[0]
}

export async function findUserById(id: number) {
  await ensureSchema()
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return rows[0]
}

export async function insertUser(uuid: string, name: string, email: string, password: string | null, image: string | null, kycStatus: string) {
  await ensureSchema()
  const rows = await sql`INSERT INTO users (uuid, name, email, password, image, kyc_status) VALUES (${uuid}, ${name}, ${email}, ${password}, ${image}, ${kycStatus}) RETURNING id`
  return { lastInsertRowid: rows[0].id }
}

export async function updateUserBridgecardId(value: string, userId: number) {
  await ensureSchema()
  await sql`UPDATE users SET bridgecard_holder_id = ${value} WHERE id = ${userId}`
}

export async function updateUserKycStatus(status: string, userId: number) {
  await ensureSchema()
  await sql`UPDATE users SET kyc_status = ${status} WHERE id = ${userId}`
}

export async function getWalletByUserId(userId: number) {
  await ensureSchema()
  const rows = await sql`SELECT * FROM crypto_wallets WHERE user_id = ${userId} LIMIT 1`
  return rows[0]
}

export async function insertWallet(walletId: string, userId: number, address: string, balance: number) {
  await ensureSchema()
  await sql`INSERT INTO crypto_wallets (wallet_id, user_id, base_account_address, usdc_balance) VALUES (${walletId}, ${userId}, ${address}, ${balance})`
}

export async function updateWalletBalance(balance: number, userId: number) {
  await ensureSchema()
  await sql`UPDATE crypto_wallets SET usdc_balance = ${balance} WHERE user_id = ${userId}`
}

export async function updateWalletAddress(address: string, userId: number) {
  await ensureSchema()
  await sql`UPDATE crypto_wallets SET base_account_address = ${address} WHERE user_id = ${userId}`
}

export async function getCardsByUserId(userId: number) {
  await ensureSchema()
  return sql`SELECT * FROM cards WHERE user_id = ${userId} ORDER BY created_at DESC`
}

export async function getCardByCardId(cardId: string) {
  await ensureSchema()
  const rows = await sql`SELECT * FROM cards WHERE card_id = ${cardId} LIMIT 1`
  return rows[0]
}

export async function insertCard(userId: number, cardId: string, bridgecardRefId: string, maskedPan: string, cardNumber: string, holder: string, expiry: string, cvv: string, type: string, color: string, balance: number, spendingLimit: number, currency: string) {
  await ensureSchema()
  const rows = await sql`INSERT INTO cards (user_id, card_id, bridgecard_ref_id, masked_pan, card_number, card_holder, expiry_date, cvv, type, color, balance, spending_limit, currency) VALUES (${userId}, ${cardId}, ${bridgecardRefId}, ${maskedPan}, ${cardNumber}, ${holder}, ${expiry}, ${cvv}, ${type}, ${color}, ${balance}, ${spendingLimit}, ${currency}) RETURNING id`
  return { lastInsertRowid: rows[0].id }
}

export async function updateCardBalance(balance: number, cardId: string) {
  await ensureSchema()
  await sql`UPDATE cards SET balance = ${balance} WHERE card_id = ${cardId}`
}

export async function updateCardStatus(status: string, id: number, userId: number) {
  await ensureSchema()
  await sql`UPDATE cards SET status = ${status} WHERE id = ${id} AND user_id = ${userId}`
}

export async function deleteCard(id: number, userId: number) {
  await ensureSchema()
  await sql`DELETE FROM cards WHERE id = ${id} AND user_id = ${userId}`
}

export async function getTransactionsByUserId(userId: number) {
  await ensureSchema()
  return sql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC`
}

export async function insertTransaction(txId: string, userId: number, cardId: string | null, amount: number, currency: string, usdcAmount: number, merchant: string, status: string, type: string, txHash: string | null) {
  await ensureSchema()
  const rows = await sql`INSERT INTO transactions (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant, status, type, tx_hash) VALUES (${txId}, ${userId}, ${cardId}, ${amount}, ${currency}, ${usdcAmount}, ${merchant}, ${status}, ${type}, ${txHash}) RETURNING id`
  return { lastInsertRowid: rows[0].id }
}

export async function insertConversionRate(rateId: string, currency: string, rate: number) {
  await ensureSchema()
  await sql`INSERT INTO conversion_history (rate_id, fiat_currency, usdc_rate) VALUES (${rateId}, ${currency}, ${rate})`
}

export async function getUserPreferences(userId: number) {
  await ensureSchema()
  const rows = await sql`SELECT * FROM user_preferences WHERE user_id = ${userId} LIMIT 1`
  return rows[0]
}

export async function upsertUserPreferences(userId: number, theme: string, currency: string, notificationsEnabled: boolean, preferences: Record<string, unknown> = {}) {
  await ensureSchema()
  const rows = await sql`INSERT INTO user_preferences (user_id, theme, currency, notifications_enabled, preferences)
    VALUES (${userId}, ${theme}, ${currency}, ${notificationsEnabled}, ${JSON.stringify(preferences)})
    ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, currency = EXCLUDED.currency,
      notifications_enabled = EXCLUDED.notifications_enabled, preferences = EXCLUDED.preferences, updated_at = NOW()
    RETURNING *`
  return rows[0]
}

export async function recordAppSession(clerkUserId: string, userId: number, metadata: Record<string, unknown> = {}) {
  await ensureSchema()
  await sql`INSERT INTO app_sessions (clerk_user_id, user_id, metadata) VALUES (${clerkUserId}, ${userId}, ${JSON.stringify(metadata)})`
}

export async function touchAppSession(clerkUserId: string, userId: number) {
  await ensureSchema()
  await sql`UPDATE app_sessions SET last_seen_at = NOW() WHERE clerk_user_id = ${clerkUserId} AND user_id = ${userId}`
}
