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
