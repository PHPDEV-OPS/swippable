# Swippable

Virtual cards funded by M-Pesa and crypto. Next.js App Router, Clerk for identity,
Neon Postgres for the ledger, Flutterwave for card issuing.

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
