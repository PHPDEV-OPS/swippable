# Swippable

Virtual cards funded by M-Pesa and crypto. Next.js App Router, Clerk for identity,
Neon Postgres for the ledger, and Flutterwave or Stripe Issuing for card issuing.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy the environment keys into `.env.local` — Clerk, `DATABASE_URL`, the Flutterwave
pair, the Daraja credentials and the crypto webhook secret. Every provider client
reports itself *unconfigured* rather than throwing, so the app runs end-to-end on a
partial `.env` and simply falls back to sandbox behaviour.

## Surfaces

| Route | Who | What |
| --- | --- | --- |
| `/` | public | Marketing site |
| `/dashboard` | any signed-in user | Wallet, cards, transactions, analytics |
| `/checkout` | any signed-in user | Test merchant checkout (real charges) |
| `/admin` | superadmins only | Command center (below) |

## Superadmin command center

`/admin` is the founder-only control surface. There are deliberately **no support
roles** in it: no RBAC, no ticket queues, no agent assignment. Every operator is a
superadmin, so each screen offers direct overrides rather than passive views.

- **Command center** — live M-Pesa float, crypto hot wallet and issuer settlement
  pool, each shown against what the ledger owes; revenue derived from the fee
  schedule over settled volume.
- **Users** — a 360° profile per account with one-click KYC bypass, editable
  daily/monthly funding and spending caps, and Active / Frozen / Banned status.
- **Transaction rails** — the two-rail intervention module for deposits whose
  provider callback never arrived (M-Pesa STK and crypto webhooks).
- **Card lifecycle** — every issued card, a PCI-conscious PAN/CVV reveal, and a
  decline diagnostic pane that translates processor codes into next steps.
- **Simulation lab** — rehearse payments, declines and lost webhooks against the
  *real* authorisation path.
- **Card issuers** — which provider mints new cards, automatic failover, and a
  live health probe.
- **Audit trail** — append-only record of every override.

### The kill switch is real

Engaging it writes to `platform_settings`, and `assertRailOpen` reads that on every
deposit, card issuance and card authorisation. It takes effect on the very next
request — not at the next deploy — and halts four rails independently: card minting,
M-Pesa deposits, crypto deposits and card authorisations.

### Every override is reasoned and audited

No override endpoint accepts a request without a written reason, and each one writes
to `admin_audit_log` — with the before/after pair — *before* it takes effect. A PAN
reveal is audited before the issuer is even called, so a successful fetch can never
go unrecorded.

### Granting superadmin access

Access is granted two ways:

1. `users.is_admin` is already `true`, or
2. the Clerk email is on the bootstrap list — `swippable@gmail.com`, plus anything
   in the optional `ADMIN_EMAILS` env var (comma-separated).

The founder account is created in Clerk and in Postgres independently and out of
band, so its Clerk id is unknowable until it first signs in. That first request is
where `resolveAdmin` stitches the identities together: it links `clerk_user_id`, sets
`uuid` to match (the shape every other user row has), marks the row admin and
verified, and writes an `ADMIN_BOOTSTRAPPED` audit entry. Nothing needs doing by hand
beyond seeding the row:

```sql
INSERT INTO users (uuid, clerk_user_id, name, email, kyc_status, wallet_balance, is_admin, account_status)
VALUES ('pending-clerk-link-swippable-admin', NULL, 'Swippable Superadmin',
        'swippable@gmail.com', 'VERIFIED', 0.00, TRUE, 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;
```

Then create the matching user in the Clerk dashboard with the same email and sign in.

A non-admin hitting `/admin` or any `/api/admin/*` route gets a **404**, not a 403 —
so an unauthorised caller learns nothing about whether the surface exists or who is
on the bootstrap list.

## Card issuers and failover

Two issuers are supported behind one interface, and which is primary is a runtime
setting at `/admin/settings` rather than a deploy-time constant.

Issuance walks the configured order: primary, then the secondary if failover is on,
then a local sandbox card if the sandbox fallback is on. A provider with no
credentials is *skipped* rather than counted as a failure, so removing a set of keys
quietly moves traffic to the other issuer instead of erroring on every request.

Each card records the issuer that actually minted it, and every later operation on
that card — reveal, pause, limit change — routes back to the same one. Providers are
never mixed for a single card.

The health probe on that screen calls the Issuing API rather than just checking for a
key, because *configured* and *working* are different things: a valid Stripe key with
Issuing not yet activated passes every credential check and fails every card call.

### Stripe: two different products

Worth keeping straight, because both are wired up and they do opposite things.

| Module | Product | Direction | Needs activation? |
| --- | --- | --- | --- |
| `lib/stripe-issuing.ts` | Issuing | Mints cards *we* hand out | Yes — activate Issuing in the Stripe Dashboard |
| `lib/stripe-checkout.ts` | Checkout | Accepts a card payment *to* us | No — works on any sandbox |

The hosted Checkout path (`/api/checkout/stripe`) is the dependable way to exercise a
card payment end to end while an Issuing application is still pending. Its credit is
keyed on the Stripe session id, so returning to the success URL twice credits once.

## Testing card payments

`/checkout` is a merchant-shaped page that makes a **real charge**: on approval it
calls `authoriseCardDebit`, the same guarded statement the live card webhook uses.

Seed the two published sandbox test cards, plus enough float to authorise against:

```bash
node --env-file=.env.local scripts/seed-test-cards.mjs [email]
```

| Card | PAN | Expiry | CVV |
| --- | --- | --- | --- |
| Stripe test card | 4242 4242 4242 4242 | 12/34 | any 3 digits |
| Flutterwave test card | 5531 8866 5214 2950 | 09/32 | 564 |

At the checkout you pick the card rather than typing the PAN — matching runs on the
last 4. Test triggers are stated on the page: CVV `000` forces an invalid-CVV
decline, and `IR KP SY CU RU BY` force a blocked-country decline.

## Crypto deposits (USDC on Base)

A user reaches a deposit address two ways, and the difference is recorded rather
than flattened:

| Route | `source` | Verified? |
| --- | --- | --- |
| Signed in with a Base account / Coinbase Wallet via Clerk | `clerk` | **Yes** — Clerk made them sign a nonce |
| Connected a wallet in the dashboard | `wallet_connect` | No |
| Typed an address | `manual` | No |

A Web3 sign-in *is* the wallet link. `syncClerkWeb3Wallets` runs on the auth path,
so the address is picked up on the first authenticated request and can receive USDC
immediately — no button to find. Only wallets Clerk reports as `verified` are linked;
an unproven address must never receive credit.

Users can link **several** addresses, one of which is the primary receive address.
That matters because inbound transfers are matched to a user *by destination
address*: a single overwritable column would orphan money sent to a previous one.
A unique index enforces that an address belongs to exactly one account.

### Making deposits actually credit

The endpoint is built and hardened (`/api/webhooks/crypto`: HMAC-verified, replayed
events deduplicated, confirmations enforced). What it needs is something watching the
chain and calling it.

Point an address-activity webhook — Alchemy, QuickNode, Helius, Coinbase Commerce —
at `https://<your-domain>/api/webhooks/crypto`, signing with `CRYPTO_WEBHOOK_SECRET`.
It must be updated with each newly linked address; `listCryptoWallets` is the source
of truth for what to watch.

Two settlement paths are supported, so either style of provider works:

1. The user declared the deposit first → the PENDING row is matched by tx hash.
2. The transfer arrives unannounced → the destination address is matched to its owner.

Until an indexer is wired up, exercise the whole path from the admin **Simulation
lab** (`CRYPTO_DEPOSIT_CONFIRMED`), which settles through the same statement the real
webhook uses.

### Keys

| Variable | Needed for | Notes |
| --- | --- | --- |
| `CRYPTO_WEBHOOK_SECRET` | **Required** | HMAC-SHA256 secret; the webhook rejects everything without it |
| `CRYPTO_MIN_CONFIRMATIONS` | Optional | Defaults to 3 |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Optional | Coinbase OnchainKit; only for the in-app connect UI |

Clerk Web3 sign-in needs **no extra keys** — it is dashboard configuration on your
existing Clerk instance, and the existing publishable/secret pair covers it.

## Money handling

Every amount is carried as a `Decimal` — a canonical `"0.00"` string — and computed
internally as a bigint of minor units. No value ever passes through a JS float, so
rounding drift is structurally impossible. See `src/lib/money.ts`.

Balance movements and their ledger rows are always written in a single guarded SQL
statement (`authoriseCardDebit`, `creditWallet`, `settlePendingDeposit`), so a balance
and its ledger entry can never diverge, and webhook redelivery is a no-op rather than
a double charge.

## Schema

Tables are created idempotently on first use — `ensureSchema` in `src/lib/db.ts` for
the core app, `ensureAdminSchema` in `src/lib/admin-db.ts` for the command center — so
a fresh Neon branch (preview or CI) comes up with the exact production shape without a
migration step.
