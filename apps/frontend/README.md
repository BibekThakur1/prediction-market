# Forecast frontend

React 19 + TypeScript + Vite client for the Forecast testnet.

```bash
bun install
bun run --cwd apps/frontend dev
```

The app runs at `http://localhost:3001` and needs
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_URL`.
Only variables prefixed with `VITE_` are bundled into browser code; never put a
server secret in one. See `docs/PROJECT_GUIDE.md` and `docs/DEPLOYMENT.md`.
