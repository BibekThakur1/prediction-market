import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useUser } from "./hooks/useUser";
import { api } from "./api";
import type { Account, Market } from "./types";
import { MarketList } from "./components/MarketList";
import { MarketDetail } from "./components/MarketDetail";
import { OrderForm } from "./components/OrderForm";
import { Balance } from "./components/Balance";
import { Positions } from "./components/Positions";
import { OrderHistory } from "./components/OrderHistory";
import { SplitMerge } from "./components/SplitMerge";
import "./App.css";

declare global { interface Window { solflare?: unknown } }

const publicConfig = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL,
};
const missingPublicConfig = Object.entries(publicConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name);

const supabase = createClient(
  publicConfig.VITE_SUPABASE_URL ?? "https://example.supabase.co",
  publicConfig.VITE_SUPABASE_PUBLISHABLE_KEY ?? "missing-key",
);

type Tab = "markets" | "trading" | "portfolio" | "orders" | "funds";

export default function App() {
  const { session, loading: authLoading } = useUser(supabase);
  const token = session?.access_token ?? "";
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("markets");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    api.markets()
      .then((data) => { setMarkets(data.markets); setError(""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load markets"));
  }, [refreshKey]);
  useEffect(() => {
    if (!token) return;
    api.me(token)
      .then((data) => setAccount(data.user))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your account"));
  }, [token, refreshKey]);
  const selectedMarket = markets.find((market) => market.id === selectedId) ?? null;
  const refresh = () => setRefreshKey((value) => value + 1);

  const signIn = async () => {
    if (!window.solflare) return setError("Install the Solflare browser wallet to sign in.");
    const { error: signInError } = await supabase.auth.signInWithWeb3({ chain: "solana", statement: "Sign in to Forecast testnet.", wallet: window.solflare as never });
    if (signInError) setError(signInError.message);
  };

  if (missingPublicConfig.length) return (
    <main className="auth-container">
      <section className="auth-box" role="alert">
        <div className="brand-mark" aria-hidden="true">F</div>
        <span className="eyebrow">Setup required</span>
        <h1>Forecast is not configured yet.</h1>
        <p>Add {missingPublicConfig.join(", ")} to the frontend environment, then rebuild the app.</p>
        <small>See docs/DEPLOYMENT.md for the exact Vercel setup.</small>
      </section>
    </main>
  );

  if (authLoading) return <div className="loading-screen" aria-live="polite">Loading Forecast…</div>;
  if (!session) return (
    <main className="auth-container">
      <section className="auth-box">
        <div className="brand-mark" aria-hidden="true">F</div>
        <span className="eyebrow">Testnet prediction exchange</span>
        <h1>Trade your conviction, not your capital.</h1>
        <p>Explore transparent prediction markets with test credits, a complete audit ledger, and no real-money risk.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="signin-button" onClick={signIn}>Connect Solflare</button>
        <small>New profiles receive $100 in test credits.</small>
      </section>
    </main>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-lockup"><div className="header-mark" aria-hidden="true">F</div><div><h1>Forecast</h1><p className="testnet-label"><span className="live-dot" />Testnet exchange</p></div></div>
        <div className="header-actions"><div className="wallet-identity"><span>Connected profile</span><strong>{account?.address ? `${account.address.slice(0, 5)}…${account.address.slice(-4)}` : "Loading…"}</strong></div><button className="logout-button" onClick={() => supabase.auth.signOut()} aria-label="Sign out">Sign out</button></div>
      </header>
      <nav className="app-nav" aria-label="Primary navigation">
        {([['markets','Markets'],['portfolio','Portfolio'],['orders','Orders'],['funds','Funds']] as [Tab,string][]).map(([value, label]) => (
          <button key={value} className={tab === value || (value === "markets" && tab === "trading") ? "active" : ""} onClick={() => { setTab(value); if (value === "markets") setSelectedId(null); }}>{label}</button>
        ))}
      </nav>
      <main className="app-main">
        {error && <div className="error" role="alert">{error}</div>}
        <section className="account-strip" aria-label="Account balances">
          <div><span>Available balance</span><strong>{account ? `$${(account.availableBalance / 100).toFixed(2)}` : "—"}<small>USD</small></strong></div>
          <div><span>Reserved for orders</span><strong>{account ? `$${(account.reservedBalance / 100).toFixed(2)}` : "—"}<small>USD</small></strong></div>
          <div className="account-hint"><span>Settlement</span><strong>Fully collateralized</strong><small>Every movement is ledgered</small></div>
        </section>
        {tab === "markets" && <MarketList markets={markets} onSelectMarket={(id) => { setSelectedId(id); setTab("trading"); }} />}
        {tab === "trading" && selectedMarket && <div className="trading-container">
          <MarketDetail market={selectedMarket} onBack={() => { setSelectedId(null); setTab("markets"); }} />
          <aside className="trade-sidebar"><OrderForm market={selectedMarket} token={token} availableBalance={account?.availableBalance ?? 0} onOrderPlaced={refresh} /><SplitMerge market={selectedMarket} token={token} availableBalance={account?.availableBalance ?? 0} onActionComplete={refresh} /></aside>
        </div>}
        {tab === "portfolio" && <Positions token={token} key={refreshKey} />}
        {tab === "orders" && <OrderHistory token={token} onChanged={refresh} key={refreshKey} />}
        {tab === "funds" && <Balance token={token} key={refreshKey} />}
      </main>
    </div>
  );
}
