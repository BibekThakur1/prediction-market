# Forecast testnet

A test-credit prediction exchange with normalized order books, price-time matching, reserved balances, immutable ledger entries, and a responsive React trading interface.

## Architecture

- React 19 + Vite frontend
- Bun + TypeScript + Express API
- PostgreSQL + Prisma
- Supabase Web3 authentication with Solflare
- Normalized `Market`, `Order`, `Trade`, `Position`, `LedgerEntry`, `Transfer`, and `MarketResolution` records

Orders move through `OPEN`, `PARTIALLY_FILLED`, `FILLED`, and `CANCELLED`. Buy orders reserve cash; sell orders reserve outcome shares. Matching and all resulting ledger entries commit in one serializable transaction. PostgreSQL rejects updates or deletes to ledger rows.

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env` and provide the PostgreSQL and Supabase values. The frontend only receives the publishable Supabase key; the server secret stays in the API environment.

3. Apply the database migrations and seed markets:

   ```bash
   cd packages/db
   bunx prisma migrate dev
   cd ../../apps/backend
   bun seed.ts
   ```

4. Start both processes in separate terminals:

   ```bash
   cd apps/backend && bun index.ts
   cd apps/frontend && bun run dev
   ```

The UI runs at `http://localhost:3001` and the API at `http://localhost:3000`. Each newly authenticated profile receives the amount configured by `TESTNET_STARTING_BALANCE_CENTS` (default: $100.00), recorded as a deposit and ledger entry.

## Main API

- `GET /markets` and `GET /markets/:marketId`
- `POST /orders` and `POST /orders/:orderId/cancel`
- `GET /me`, `GET /positions`, `GET /orders`, `GET /activity`
- `POST /split` and `POST /merge`
- `POST /deposits` and `POST /withdrawals`

Protected routes expect `Authorization: Bearer <supabase-access-token>`.

## Verification

```bash
bun test ./apps/backend/matching.test.ts
bun run check-types
bun run --cwd apps/frontend lint
bun run --cwd apps/frontend build
```

This is a portfolio/testnet application. It does not implement real-money custody, KYC/AML, jurisdiction controls, market surveillance, or production-grade resolution governance.
