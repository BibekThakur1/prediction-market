# Deploy Forecast to Vercel

Deploy the same GitHub repository as **two Vercel projects**. The frontend and
API need different build settings and different environment secrets.

## Before deploying

1. Create a hosted PostgreSQL database. Supabase Postgres works well.
2. Create/configure the Supabase Auth project and Solana Web3 provider.
3. Keep the database password and Supabase secret key private.
4. From your machine, apply production migrations and seed markets:

   ```bash
   DATABASE_URL="your-production-url" bunx prisma migrate deploy --config packages/db/prisma.config.ts
   DATABASE_URL="your-production-url" bun apps/backend/seed.ts
   ```

Run migrations deliberately from CI or a trusted machine. Do not run development
migrations automatically on every serverless cold start.

For Supabase on Vercel, prefer the transaction-pooler/serverless connection
string shown in Supabase's Connect dialog. A local value such as
`postgresql://postgres:postgres@localhost:5432/prediction_market` works only on
your computer; `localhost` inside Vercel refers to the Vercel Function itself.

## Project A: API

1. In Vercel, choose **Add New -> Project** and import this repository.
2. Set **Root Directory** to `apps/backend`.
3. Vercel should detect **Express** from `vercel.json`.
4. Add these variables to Production and Preview as appropriate:

   ```text
   DATABASE_URL=postgresql://...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your-server-secret
   CORS_ORIGINS=https://your-frontend.vercel.app
   TESTNET_STARTING_BALANCE_CENTS=10000
   ```

5. Deploy and copy the API URL, for example
   `https://forecast-api.vercel.app`.
6. Open `https://forecast-api.vercel.app/health`. It should return:

   ```json
   { "status": "ok" }
   ```

If health works but `/markets` fails, the deployment is running and the problem
is normally `DATABASE_URL`, an unapplied migration, or an unseeded database.

## Project B: frontend

1. Import the same repository again as another Vercel project.
2. Set **Root Directory** to `apps/frontend`.
3. Vercel should detect **Vite** from `vercel.json`.
4. Add these variables before building:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-browser-safe-key
   VITE_API_URL=https://forecast-api.vercel.app
   ```

5. Deploy and copy the final frontend URL.
6. Return to the API project and set `CORS_ORIGINS` to that exact URL, then
   redeploy the API.

Vite embeds `VITE_` variables during the build. Changing one in Vercel requires
a new frontend deployment.

## Supabase settings

In the Supabase dashboard, add the deployed frontend origin/redirect URL to the
authentication URL allowlist. Enable the Solana Web3 provider required by the
Solflare sign-in call. The publishable key belongs in the frontend; the secret
key belongs only in the API project.

## Common failures

### The Turborepo starter page is deployed

The Vercel root directory is `apps/web`, `apps/docs`, or the repository root.
Change it to `apps/frontend` for the real UI.

### `No Output Directory named dist found`

The frontend root/build settings are wrong. Use root `apps/frontend`, build
command `bun run build`, and output `dist`.

### Frontend opens but says it cannot load markets

Check `VITE_API_URL` contains the complete API origin with `https://` and no
unintended path. Then check `/health`, `/markets`, browser Network errors, and
the API logs in that order.

### Browser reports a CORS error

Set `CORS_ORIGINS` on the API to the exact frontend origin (no path). Multiple
origins are comma-separated. Redeploy the API after changing it.

### API function crashes during startup

Confirm `DATABASE_URL` exists in the API project, its password is URL-encoded,
the database accepts connections from Vercel, and Prisma generation completed.
Also confirm the root directory is `apps/backend`, not `packages/db`.

### `relation ... does not exist` or markets are empty

Run `prisma migrate deploy` against the production database. If tables exist but
there are no markets, run the seed script once.

### Sign-in fails after deployment

Check the frontend Supabase URL/publishable key, Supabase redirect allowlist,
Solana provider setup, and Solflare extension. Then inspect the browser Network
response from Supabase before changing API code.

### Preview deployment cannot call the API

Preview URLs change. For a stable setup, attach a custom frontend domain and use
it in `CORS_ORIGINS`. If previews must be interactive, explicitly add each preview
origin or implement a carefully scoped preview-origin policy.

## Verification after deployment

Test in this sequence:

1. API `/health` returns 200.
2. API `/markets` returns seeded markets.
3. Frontend loads without console/network errors.
4. Solflare sign-in creates/loads an account.
5. Initial test balance is correct.
6. Split one complete set.
7. Place and cancel an order; balances/reserves reconcile.
8. Use a second account to create a matching order and verify the fill.
9. Refresh and confirm orders, positions, and balances persisted.

## Production checklist

- Use a pooled PostgreSQL connection URL suitable for serverless traffic.
- Protect production secrets and rotate anything accidentally exposed.
- Enable database backups and alerts.
- Add monitoring for function errors and slow database queries.
- Use a custom domain for stable CORS and authentication redirects.
- Keep this test-credit product clearly labeled; it is not ready for real money.
