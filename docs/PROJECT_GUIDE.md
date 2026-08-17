# Forecast: beginner-to-production project guide

This guide explains what the application does, how its pieces communicate, and
how to rebuild the same kind of product from an empty folder.

## Start here: learn by running it

Do these lessons in order. After every command, read the explanation before
moving on. That connects the visible behavior to the responsible code.

### Lesson 1: understand why `index.html` does not run directly

Do **not** double-click `apps/frontend/index.html`. A `file://` page cannot ask
Vite to transform TypeScript/JSX, resolve npm packages, inject `VITE_`
environment variables, or provide hot module replacement.

Run this instead:

```bash
bun install
bun run dev:frontend
```

Open `http://localhost:3001`. Edit the heading in `apps/frontend/src/App.tsx`
and save it. Seeing the browser update proves this flow:

```text
App.tsx -> Vite transforms TSX -> browser receives JavaScript -> React renders
```

### Lesson 2: start the stateful part

The API can listen without PostgreSQL, so `/health` may succeed while `/markets`
fails. That means "the server process is alive," not "the whole system works."

If the `prediction-postgres` Docker container already exists:

```bash
bun run db:start
```

Only on the first setup, create it instead:

```bash
bun run db:create
bun run db:migrate
bun run db:seed
```

Now start the API and compare the two endpoints:

```bash
bun run dev:backend
curl http://localhost:3000/health
curl http://localhost:3000/markets
```

`/health` tests Express. `/markets` tests Express + Prisma + PostgreSQL + seeded
data. If Prisma reports `P1001`, start PostgreSQL or correct `DATABASE_URL`.

### Lesson 3: run the complete application

After the database is running, one command starts only the two real Forecast
apps:

```bash
bun run dev
```

The root command intentionally filters out `apps/web` and `apps/docs`; those
starter projects use the same ports and previously caused collisions.

Open these in order:

1. `http://localhost:3000/health` — API process check.
2. `http://localhost:3000/markets` — database/data check.
3. `http://localhost:3001` — React application.

Then connect Solflare. Watch the browser Network panel while signing in and
placing an order. Match each request to the route in `apps/backend/index.ts`,
then follow the called function into `trading.ts`.

### Lesson 4: follow one order end-to-end

Set a breakpoint or temporary log at these places:

1. `OrderForm.tsx` inside `submit` — browser gathers the form values.
2. `api.ts` inside `request` — browser sends JSON and a bearer token.
3. `middleware.ts` — API verifies the Supabase user.
4. `index.ts` at `POST /orders` — Zod validates the request.
5. `trading.ts` at `placeOrder` — transaction reserves and matches assets.
6. Prisma queries — PostgreSQL commits the order, trade, positions, and ledger.

Cancel the order and follow the same path into `cancelOrder`. Learning one full
vertical flow is more useful than trying to memorize every file separately.

### Lesson 5: prove changes are safe

Run the same checks used before deployment:

```bash
bun run check-types
bun run --cwd apps/frontend lint
bun test ./apps/backend/matching.test.ts
bun run build
```

- Type-checking catches incompatible data shapes.
- Linting catches risky React/JavaScript patterns.
- Unit tests prove matching calculations.
- The production build proves Vite and Next starter packages compile.

## 1. The simple mental model

Forecast is three programs working together:

```text
Browser (React) -> HTTP API (Express) -> PostgreSQL (Prisma)
       |                  |
       +---- Supabase ----+
            authentication
```

- The browser renders markets, forms, balances, orders, and positions.
- Supabase proves which wallet user is making a request.
- The API validates every action and runs the matching engine.
- PostgreSQL is the source of truth. The browser is never trusted with money,
  shares, fills, or balances.

## 2. Technologies and why they exist

| Technology | Job in this project |
| --- | --- |
| React | Turns state into interactive screens and components. |
| TypeScript | Finds wrong data shapes before the app runs. |
| Vite | Runs and bundles the browser application. |
| Express | Maps HTTP routes such as `POST /orders` to server code. |
| Zod | Rejects malformed request bodies. |
| Prisma | Gives typed PostgreSQL queries and schema migrations. |
| PostgreSQL | Stores durable transactional state. |
| Supabase Auth | Verifies the Solflare wallet session token. |
| Bun | Installs packages and runs scripts/tests. |
| Turborepo | Runs tasks across all workspace packages. |
| Vercel | Hosts the static frontend and the Express API Function. |

## 3. Repository map

```text
apps/
  frontend/        Real React/Vite product
    src/App.tsx     Top-level state, auth, tabs, and screen selection
    src/api.ts      Typed wrapper around browser fetch calls
    src/components  Market, order, balance, position, and fund UI
  backend/          Real Express API and trading engine
    index.ts        Routes, CORS, responses, and error handling
    middleware.ts   Supabase token verification and profile creation
    trading.ts      Reserve, match, settle, cancel, split, and merge logic
    matching.ts     Small pure matching calculations
    types.ts        Zod request schemas
  web/              Unused Turborepo starter Next.js app
  docs/             Unused Turborepo starter Next.js app
packages/
  db/               Prisma schema, migrations, and shared client
  ui/               Starter shared components used by the starter Next apps
  eslint-config/    Shared lint rules for the starter Next apps
  typescript-config Shared TypeScript settings
docs/               Human documentation for this product
```

The `apps/web` and `apps/docs` projects are not the Forecast UI. They can be
removed later after confirming nothing else depends on them. Keeping them is
not harmful, but it makes deployment and onboarding harder to understand.

## 4. What happens when the app opens

1. `src/main.tsx` mounts `<App />` into the `#root` HTML element.
2. `App.tsx` creates a Supabase browser client from public `VITE_` variables.
3. `useUser` asks Supabase whether a session already exists and subscribes to
   future sign-in/sign-out changes.
4. A signed-out user sees the Solflare connection screen.
5. A signed-in user receives a Supabase access token. The frontend adds it as
   `Authorization: Bearer <token>` on protected API calls.
6. The API middleware asks Supabase to verify the token. It never trusts a user
   ID sent by the browser.
7. On first sign-in, the middleware creates a database profile and a test-credit
   deposit plus matching ledger entry in one transaction.

## 5. Frontend structure

`App.tsx` owns global screen state:

- `markets`: market data returned by the API.
- `selectedId`: the market currently being viewed.
- `tab`: markets, trading, portfolio, orders, or funds.
- `account`: available and reserved cash.
- `refreshKey`: a simple signal that reloads data after a mutation.
- `error`: the latest user-visible problem.

The components are intentionally small:

- `MarketList` filters/searches markets and opens one.
- `MarketDetail` shows rules and the YES/NO order books.
- `OrderForm` submits limit buy or sell orders.
- `SplitMerge` converts 100 cents into one YES plus one NO share, or reverses it.
- `Positions` shows available and reserved shares.
- `OrderHistory` shows fills/status and cancels open orders.
- `Balance` creates test deposits and withdrawals.

`api.ts` is the only place that knows the API base URL. It also turns non-2xx
responses into normal JavaScript errors so components can show feedback.

## 6. Backend request flow

For a protected request such as `POST /orders`:

```text
JSON request
  -> Express JSON parser
  -> CORS check
  -> Supabase authentication middleware
  -> Zod validation
  -> trading transaction
  -> JSON response
  -> central error handler on failure
```

The route layer stays thin. Financial rules live in `trading.ts`; pure matching
calculations live in `matching.ts`; database structure lives in Prisma.

## 7. Prediction-market mechanics

Prices are integer cents from 1 through 99. A YES share pays 100 cents if YES
wins; a NO share pays 100 cents if NO wins. A complete YES+NO pair is therefore
fully collateralized by 100 cents.

Example: buying 10 YES shares at 60 cents reserves `10 x 60 = 600` cents.

### Limit order lifecycle

1. Validate market, outcome, side, price, and quantity.
2. Lock the market and open a serializable database transaction.
3. For a BUY, move cash from available to reserved.
4. For a SELL, move shares from available to reserved.
5. Find opposite orders that cross the requested limit.
6. Sort makers by best price and then earliest creation time.
7. Fill as much as possible at the maker's price.
8. Transfer cash/shares and refund BUY price improvement.
9. Write immutable ledger entries for every movement.
10. Mark orders OPEN, PARTIALLY_FILLED, or FILLED and commit everything together.

If any step fails, PostgreSQL rolls the whole transaction back.

### Split and merge

- Split: pay 100 cents per unit and receive one YES plus one NO.
- Merge: surrender one YES plus one NO and receive 100 cents.

This is how complete outcome sets enter and leave the test exchange.

## 8. Database tables

| Table | Meaning |
| --- | --- |
| `User` | Wallet identity and available/reserved cash. |
| `Market` | Question, rules, category, dates, and state. |
| `Order` | A limit order and its filled quantity/status. |
| `Trade` | An immutable match between maker and taker. |
| `Position` | Available/reserved YES or NO shares per user and market. |
| `LedgerEntry` | Append-only explanation for each asset movement. |
| `Transfer` | Test deposit or withdrawal record. |
| `MarketResolution` | Final outcome and supporting evidence. |

Migrations in `packages/db/prisma/migrations` are versioned database changes.
Never edit a migration that has already run in a shared environment; create a
new migration instead.

## 9. Environment variables

| Variable | Where | Secret? | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | API/database | Yes | PostgreSQL connection string. |
| `SUPABASE_URL` | API | No | Supabase project URL. |
| `SUPABASE_SECRET_KEY` | API only | Yes | Server-side token verification. |
| `VITE_SUPABASE_URL` | Frontend | No | Same project URL bundled for the browser. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | No | Browser-safe Supabase key. |
| `VITE_API_URL` | Frontend | No | Public deployed API origin. |
| `CORS_ORIGINS` | API | No | Comma-separated allowed frontend origins. |
| `TESTNET_STARTING_BALANCE_CENTS` | API | No | First-login test-credit grant. |
| `PORT` | Local API | No | Local listening port; Vercel supplies its own. |

Never put `SUPABASE_SECRET_KEY` or `DATABASE_URL` in a `VITE_` variable. Vite
variables are readable by every browser visitor.

## 10. Build this kind of app from zero

Use this order so each layer is testable before the next one exists:

1. Write product rules: outcomes, payout, price range, cancellation, and resolution.
2. Design the normalized database schema and integer money units.
3. Create migrations and seed one market.
4. Add pure tests for crossing, price-time priority, fills, and refunds.
5. Implement transactional reserve, match, settlement, and cancellation logic.
6. Add API validation, authentication, error shapes, and read endpoints.
7. Build one frontend journey: sign in -> list -> detail -> order -> history.
8. Add positions, split/merge, balances, loading, empty, and error states.
9. Test concurrency and ledger/balance invariants, not only happy paths.
10. Deploy database, API, and frontend; then add monitoring and backups.

## 11. Highest-value improvements

### Product and UX

- Give every market its own URL instead of keeping navigation only in React state.
- Add recent trades, last price, probability movement, spread, and volume.
- Replace page-wide error state with errors beside the action that failed.
- Add skeletons, explicit empty states, success confirmation, and retry actions.
- Confirm order details before submitting and show estimated maximum cost/proceeds.
- Use locale-aware currency, quantity, and date formatting.
- Add mobile bottom navigation and keep all controls at least 44px tall.

### Engineering

- Remove the unused starter `web`, `docs`, and shared UI packages.
- Add API integration tests against a temporary PostgreSQL database.
- Add property/invariant tests: assets cannot appear, reserved amounts cannot go
  negative, and ledger totals must reconcile with balances and positions.
- Add request IDs, structured logs, rate limits, and error monitoring.
- Add pagination to markets, orders, activity, and trades.
- Add CI for install, type-check, lint, tests, build, and migration validation.

### Production safety

- Disable unrestricted test deposits before any real-money adaptation.
- Implement governed market closing, resolution, payout, cancellation, and disputes.
- Add admin authorization and an auditable resolution workflow.
- Add database backups, point-in-time recovery, alerts, and a disaster runbook.
- Treat real-money prediction markets as a regulated product requiring legal,
  KYC/AML, custody, market-surveillance, and jurisdiction work.

## 12. Everyday commands

```bash
bun install
bun run dev
bun run check-types
bun run lint
bun test ./apps/backend/matching.test.ts
bun run build
```

Use `bun run --cwd apps/frontend dev` and `bun --cwd apps/backend index.ts` when
you want the two real applications in separate terminals.
