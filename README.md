# Swippable

Virtual dollar cards for Kenya. Top up in M-Pesa or USDC, spend online in USD.

Swippable gives users a single wallet they can fund in shillings or stablecoins,
then spin up virtual cards against it for online purchases — a card holds an
allocation of the shared balance rather than money of its own.

## Features

**Wallet**
- Top up over M-Pesa STK push, credited automatically once the prompt is approved
- Deposit USDC on Base; sign in with a Base account or Coinbase Wallet and your
  address is linked for you
- Live balance, spend history and analytics

**Virtual cards**
- Issue cards against the wallet balance, each with its own spending limit
- Move capital on and off a card, pause it, or close it
- Reveal the full number and CVV on demand — never stored, fetched fresh each time
- Issued through Flutterwave or Stripe Issuing, with automatic failover between them

**Payments**
- Real-time authorisation: every charge checks the card limit, the wallet balance
  and the account status in one atomic step
- Declines carry a readable reason, not just a processor code
- A test checkout for exercising card payments end to end

**Admin console** — an internal operations surface for the team: liquidity and
revenue, account management, stuck-deposit reconciliation, card diagnostics and a
payment simulator.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Auth | Clerk (email, OAuth, Base / Coinbase Wallet) |
| Database | Neon Postgres (serverless driver) |
| Data fetching | TanStack Query |
| Card issuing | Flutterwave · Stripe Issuing |
| Payments in | M-Pesa Daraja · USDC on Base · Stripe Checkout |
| Web3 | wagmi · viem · Coinbase OnchainKit |
| Charts | Recharts |
| Motion | Framer Motion |
| Monitoring | Sentry |
| Hosting | Vercel |

## Getting started

**Prerequisites:** Node 20+, pnpm, and a Neon Postgres database.

```bash
git clone https://github.com/PHPDEV-OPS/swippable.git
cd swippable
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`. Only `DATABASE_URL`, the two Clerk keys and
`NEXT_PUBLIC_APP_URL` are needed to boot — every provider client reports itself
*unconfigured* rather than throwing, so the app runs end to end on a partial
config and falls back to sandbox behaviour.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Database tables are created automatically on first run, so there is no migration
step: a fresh Neon branch comes up with the production shape on its own.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |

## Identity verification (KYC)

Card issuance is gated on a Kenyan National ID match performed by
[Dojah](https://docs.dojah.io). A user cannot reach `/dashboard/cards/create`
or succeed at `POST /api/cards/issue` until their Neon row reads
`kyc_status = 'VERIFIED'`.

### Configuration

Set these in `.env.local` (see `.env.example`). The secret key and AppId are
read only on the server — `src/lib/dojah.ts` imports `server-only`, so the build
fails if they are ever pulled into a client bundle.

| Variable | Notes |
| --- | --- |
| `DOJAH_BASE_URL` | `https://sandbox.dojah.io` for test keys, `https://api.dojah.io` for live. **Not** `https://dojah.io`, which is the marketing site and 404s on every API path. |
| `DOJAH_APP_ID` | From the Dojah dashboard. |
| `DOJAH_SECRET_KEY` | Sent raw in `Authorization`, with no `Bearer` prefix. |
| `DOJAH_WEBHOOK_SECRET` | Signing key for `x-dojah-signature`. Defaults to the secret key. |
| `DOJAH_STRICT_MATCH` | See below. |

### The sandbox always says yes

The sandbox returns one fixed persona — `John Doe`, born `1996-02-21` — with
every `is_*_match` flag hard-coded to `true`, **whatever** you send it. Trusting
those flags alone would approve any input.

`DOJAH_STRICT_MATCH` therefore also compares the PII Dojah echoes back against
what the user typed. It defaults to on everywhere except a `sandbox.` host, so
production fails closed while the sandbox stays demoable. Set
`DOJAH_STRICT_MATCH=true` against sandbox to exercise the real pass/fail
behaviour — you then have to enter the persona above to get a `VERIFIED`, and
anything else produces a `FAILED`.

### Automating verification with webhooks

The direct form at `/dashboard/kyc-verification` is synchronous and needs no
webhook. Register one only if you add Dojah's hosted widget or EasyOnboard,
where the answer arrives after the user has moved on:

```bash
curl -X POST "https://sandbox.dojah.io/api/v1/webhook/subscribe" \
  -H "Authorization: $DOJAH_SECRET_KEY" \
  -H "AppId: $DOJAH_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{"webhook":"https://your-domain/api/webhooks/dojah","service":"kyc_widget"}'
```

`POST /api/webhooks/dojah` verifies the HMAC-SHA256 signature over the raw body,
claims the event id so redeliveries are not processed twice, and converges on the
same transactional write the direct path uses. The callback must be publicly
reachable over HTTPS — use a tunnel in development.

### What the gate covers

| Action | Unverified user |
| --- | --- |
| Reach `/dashboard/cards/create` | Redirected to the verification form |
| `POST /api/cards/issue` | `403 KYC_REQUIRED` |
| `POST /api/cards/funding` — fund, or raise a limit | `403 KYC_REQUIRED` |
| `POST /api/cards/funding` — withdraw, or lower a limit | **Allowed** |
| `POST /api/wallet/deposit` | Allowed |

Funding is gated by *direction*, not by endpoint. Raising an allocation puts
more spendable money behind an unverified identity; withdrawing pulls money back
and lowers exposure. Blocking withdrawal would strand the funds of anyone
holding a card issued before verification existed — punishing the user for our
change rather than protecting anyone.

Deposits are deliberately left open so a user can fund an account before
verifying. Gate them too if your compliance posture requires it — the check is
one call to `requireVerifiedKycApi()`.

### Manual control and review

`/admin/users/[id]` shows the identity on file (legal name, date of birth,
national ID masked to the last four, provider reference) and the full attempt
history with the fields that failed to match. A reviewer approving or rejecting
can see the evidence rather than working blind.

Any lifecycle value can be set from there. Every override demands a reason and
is written to the audit trail as `KYC_OVERRIDE`, and an admin-granted `VERIFIED`
is never downgraded by a later failed attempt or a late webhook.

## Crypto deposits (USDC on Base)

Every account gets its own USDC receiving address. A transfer to that address is
attributed by destination and credited to the wallet ledger automatically — the
user never pastes a transaction hash.

### How an address is produced

Addresses are derived deterministically from one BIP-39 master mnemonic using
BIP-44 (`m/44'/60'/0'/0/{user id}`), in `src/lib/deposit-address.ts`. No private
key is ever stored: losing the database costs records, not custody, because any
address can be re-derived from the mnemonic and the user id.

A per-user address exists because an ERC-20 transfer carries no memo. With one
shared address there is no way to tell whose money arrived; with a distinct
destination per user, attribution is a database lookup — which is exactly what
the existing crypto webhook already does.

Provisioning happens in `getAuthenticatedUser`, so accounts created before this
feature are backfilled on their next request. It can never break a sign-in: a
failure is logged and the session proceeds.

> **Custody warning.** Whoever holds `DEPOSIT_MASTER_MNEMONIC` controls every
> user's deposits. Keep it in a secret manager or behind a KMS signer. The
> module imports `server-only`, so the build fails if it ever reaches a client
> bundle — but that protects the browser, not your deployment config.

### What you still need to run this for real

| Concern | Status |
| --- | --- |
| Address generation | Done, no external service needed. |
| Deposit detection | **Needs a chain listener** — see below. |
| Sweeping funds to treasury | Not implemented. Balances sit in each user's derived address; consolidating them needs ETH for gas in every address. Fine for a prototype, a real cost at scale. |
| Withdrawals / payouts | Not implemented. Would require signing from the derived key. |

### Chain listeners you can use without running infrastructure

The webhook at `/api/webhooks/crypto` already accepts the common indexer payload
shapes and verifies an HMAC-SHA256 signature against `CRYPTO_WEBHOOK_SECRET`.
Point any of these at it:

| Provider | Free tier | Notes |
| --- | --- | --- |
| **Alchemy Notify** (default) | Yes | Address Activity webhooks. `src/lib/indexer.ts` registers each new deposit address automatically when `ALCHEMY_NOTIFY_TOKEN` and `ALCHEMY_WEBHOOK_ID` are set. Best fit — nothing to write. |
| **Moralis Streams** | Yes | Can watch an ERC-20 contract filtered by `to`, so one stream covers all users without per-address registration. |
| **QuickNode QuickAlerts** | Yes | Expression-based filters on Base logs. |
| **thirdweb Insight** | Yes | Indexed event queries plus webhooks. |
| **Coinbase Developer Platform** | Yes | Natural pairing if you are already on Base/OnchainKit. |

Without any of them, addresses are still issued and still receive funds —
nothing credits automatically. The deposit UI says so rather than leaving the
user watching a balance that will not move.

### Testnet by default

`.env.local` ships pointed at **Base Sepolia** (`DEPOSIT_CHAIN_ID=84532`) with a
development mnemonic, so a misconfiguration cannot lose real money. Switch
`DEPOSIT_CHAIN_ID` to `8453`, drop `DEPOSIT_USDC_ADDRESS`, and supply a properly
secured mnemonic to go live.

## Deploying to Vercel

Set these in **Project → Settings → Environment Variables**. Anything not
listed is optional — the app boots on a partial config and each provider client
reports itself unconfigured rather than throwing.

### Required — the app will not work without these

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon connection string. Use the **pooled** one for serverless. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk. Safe to expose. |
| `CLERK_SECRET_KEY` | Clerk. Secret. |
| `NEXT_PUBLIC_APP_URL` | Your real deployment URL — provider callbacks are built from it. |

### Required for the KYC gate

| Variable | Value |
| --- | --- |
| `DOJAH_BASE_URL` | `https://sandbox.dojah.io` (test keys) or `https://api.dojah.io` (live). Never `https://dojah.io`. |
| `DOJAH_APP_ID` | From the Dojah dashboard. |
| `DOJAH_SECRET_KEY` | Secret. Sent raw, no `Bearer` prefix. |
| `DOJAH_WEBHOOK_SECRET` | Only if you register the hosted-widget webhook. Defaults to the secret key. |
| `DOJAH_STRICT_MATCH` | Optional. Auto-on except against sandbox. Set `true` to force real pass/fail behaviour in sandbox. |

Without these, verification returns `503 KYC_UNAVAILABLE` and **no one can
create a card** — the gate fails closed by design.

### Required for crypto deposits

| Variable | Value |
| --- | --- |
| `DEPOSIT_MASTER_MNEMONIC` | Secret. Generate a fresh one for production; do not reuse the development mnemonic in `.env.local`. |
| `DEPOSIT_CHAIN_ID` | `8453` mainnet, `84532` Base Sepolia. |
| `DEPOSIT_USDC_ADDRESS` | Only on a testnet. Omit on mainnet to use canonical USDC. |
| `CRYPTO_WEBHOOK_SECRET` | The provider's **signing key** for that webhook (Alchemy: webhook detail page), not a value you invent. **The crypto webhook rejects every request without it**, so deposits silently stop crediting if it is missing or wrong. |
| `ALCHEMY_NOTIFY_TOKEN` | Optional. Enables auto-crediting. |
| `ALCHEMY_WEBHOOK_ID` | Optional. The Address Activity webhook pointed at `/api/webhooks/crypto`. |
| `CRYPTO_MIN_CONFIRMATIONS` | Optional, defaults to `3`. |

> Set `DEPOSIT_MASTER_MNEMONIC` for **Production only**, and use a different
> mnemonic per environment. Sharing one across Preview and Production means a
> preview deployment derives — and can display to a tester — the same addresses
> real users are depositing into.

### Everything else

`FLW_*` and `STRIPE_*` for card issuing, `MPESA_*` for M-Pesa deposits,
`ADMIN_EMAILS` for admin access, `FX_FALLBACK_KES_PER_USD`,
`NEXT_PUBLIC_ONCHAINKIT_API_KEY`. See `.env.example` for the full annotated set.

### After the first deploy

1. Point the Dojah webhook (if used) at `https://<your-domain>/api/webhooks/dojah`.
2. Point the Alchemy Address Activity webhook at `https://<your-domain>/api/webhooks/crypto`.
3. Hit any authenticated page once — the schema bootstrap runs on first query,
   creating the new KYC columns, the `kyc_attempts` table and the deposit-address
   index automatically. There is no separate migration step.

## Project structure

```
src/
  app/            Routes — pages and API handlers
  components/     UI, grouped by surface
  lib/            Business logic: money, ledger, providers, auth
  types/          Shared client/server contracts
scripts/          One-off maintenance and seed scripts
```

A few conventions worth knowing before changing anything in `lib/`:

- **Money is never a float.** Amounts are carried as decimal strings and computed
  as bigint minor units. See `lib/money.ts`.
- **A balance move and its ledger row are written together**, in one guarded SQL
  statement, so the two can never disagree and a replayed webhook is a no-op
  rather than a double charge.
- **Provider clients degrade, they don't throw.** An unconfigured or failing
  provider falls back rather than taking the request down with it.

## Contributing

1. Branch off `main` — `feat/…`, `fix/…` or `chore/…`
2. Keep `pnpm lint` and `npx tsc --noEmit` clean
3. Write commit messages that explain *why*, not just what
4. Open a PR against `main` describing the change and how you tested it

Please don't commit `.env.local` or any real credentials. `.env.example` is the
place to document a new variable.

## Deployment

Deployed on Vercel from `main`. Set the same environment variables in the Vercel
project, marking secrets as **Sensitive**, and point `NEXT_PUBLIC_APP_URL` at the
deployment URL — provider callbacks and redirects are built from it.
