# Forecast API

The Express API owns authentication, market reads, matching, balances,
positions, orders, transfers, and the immutable ledger.

Run it from the repository root:

```bash
bun install
bun --cwd apps/backend index.ts
```

It needs `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
`CORS_ORIGINS`. See the root `.env.example` and `docs/DEPLOYMENT.md`.

The current routes and request shapes are documented in the root `README.md`
and `docs/PROJECT_GUIDE.md`. Never place the Supabase secret in the frontend.
