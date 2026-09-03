import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'swippable.db');
const db = new Database(dbPath);

// Initialize database with tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    image TEXT,
    kyc_status TEXT DEFAULT 'PENDING',
    bridgecard_holder_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crypto_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT UNIQUE,
    user_id INTEGER,
    base_account_address TEXT,
    usdc_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    card_id TEXT UNIQUE, -- Swippable UUID or Bridgecard ID
    bridgecard_ref_id TEXT,
    masked_pan TEXT,
    card_number TEXT,
    card_holder TEXT,
    expiry_date TEXT,
    cvv TEXT,
    type TEXT,
    color TEXT,
    balance REAL DEFAULT 0,
    spending_limit REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT UNIQUE,
    user_id INTEGER,
    card_id TEXT,
    amount REAL, -- Fiat amount
    currency TEXT, -- Fiat currency
    usdc_amount_debited REAL,
    merchant TEXT,
    status TEXT,
    type TEXT, -- 'debit', 'credit'
    tx_hash TEXT, -- Blockchain transaction hash
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (card_id) REFERENCES cards(card_id)
  );

  CREATE TABLE IF NOT EXISTS conversion_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate_id TEXT UNIQUE,
    fiat_currency TEXT,
    usdc_rate REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations for existing tables (idempotent-ish)
try { db.exec("ALTER TABLE users ADD COLUMN kyc_status TEXT DEFAULT 'PENDING'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN bridgecard_holder_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN uuid TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE cards ADD COLUMN bridgecard_ref_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE cards ADD COLUMN masked_pan TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN tx_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN usdc_amount_debited REAL"); } catch (e) {}

// Prepared statements
export const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
export const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
export const insertUser = db.prepare('INSERT INTO users (uuid, name, email, password, image, kyc_status) VALUES (?, ?, ?, ?, ?, ?)');
export const updateUserBridgecardId = db.prepare('UPDATE users SET bridgecard_holder_id = ? WHERE id = ?');
export const updateUserKycStatus = db.prepare('UPDATE users SET kyc_status = ? WHERE id = ?');

export const getWalletByUserId = db.prepare('SELECT * FROM crypto_wallets WHERE user_id = ?');
export const insertWallet = db.prepare('INSERT INTO crypto_wallets (wallet_id, user_id, base_account_address, usdc_balance) VALUES (?, ?, ?, ?)');
export const updateWalletBalance = db.prepare('UPDATE crypto_wallets SET usdc_balance = ? WHERE user_id = ?');
export const updateWalletAddress = db.prepare('UPDATE crypto_wallets SET base_account_address = ? WHERE user_id = ?');

export const getCardsByUserId = db.prepare('SELECT * FROM cards WHERE user_id = ?');
export const getCardByCardId = db.prepare('SELECT * FROM cards WHERE card_id = ?');
export const insertCard = db.prepare(`
  INSERT INTO cards (user_id, card_id, bridgecard_ref_id, masked_pan, card_number, card_holder, expiry_date, cvv, type, color, balance, spending_limit, currency)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
export const updateCardBalance = db.prepare('UPDATE cards SET balance = ? WHERE card_id = ?');
export const updateCardStatus = db.prepare('UPDATE cards SET status = ? WHERE id = ? AND user_id = ?');
export const deleteCard = db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?');

export const getTransactionsByUserId = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC');
export const insertTransaction = db.prepare(`
  INSERT INTO transactions (tx_id, user_id, card_id, amount, currency, usdc_amount_debited, merchant, status, type, tx_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const insertConversionRate = db.prepare('INSERT INTO conversion_history (rate_id, fiat_currency, usdc_rate) VALUES (?, ?, ?)');

export default db;
