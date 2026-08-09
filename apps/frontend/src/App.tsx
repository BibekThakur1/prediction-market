import { useState, useEffect } from "react";
import { useUser } from "./hooks/useUser";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Market } from "./types";
import { MarketList } from "./components/MarketList";
import { MarketDetail } from "./components/MarketDetail";
import { OrderForm } from "./components/OrderForm";
import { Balance } from "./components/Balance";
import { Positions } from "./components/Positions";
import { OrderHistory } from "./components/OrderHistory";
import { SplitMerge } from "./components/SplitMerge";
import "./App.css";

declare global {
  interface Window {
    solflare?: any;
  }
}

function App() {
  const [supabase] = useState<SupabaseClient>(() =>
    createClient(
      "https://xueelexradfkwcuflstg.supabase.co",
      "sb_publishable_yUiZrHgSvJiPbWbDYiGjEw_jfh8-zCr"
    )
  );

  return <AppWrapper supabase={supabase} />;
}

function AppWrapper({ supabase }: { supabase: SupabaseClient }) {
  const { claims } = useUser(supabase);

  const [token, setToken] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [activeTab, setActiveTab] = useState("markets");
  const [refreshKey, setRefreshKey] = useState(0);

  // Get the current Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
      }
    });
  }, [supabase, claims]);

  // Fetch markets when the application loads
  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch("http://localhost:3000/markets");

      if (!response.ok) {
        throw new Error(
          `Markets request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      const nextMarkets = data.markets || [];

      setMarkets(nextMarkets);

      setSelectedMarket((current) =>
        current
          ? nextMarkets.find(
              (market: Market) => market.id === current.id
            ) || current
          : current
      );
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    }
  };

  // Sign in using Solflare + Supabase Web3 Auth
  const handleSignIn = async () => {
    if (!window.solflare) {
      console.error("Solflare wallet was not found.");
      return;
    }

    try {
      console.log("Starting Solana Web3 sign-in...");

      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement:
          "I accept the Terms of Service at https://example.com/tos",
        wallet: window.solflare,
      });

      console.log("Web3 auth data:", data);
      console.log("Web3 auth error:", error);

      if (error) {
        console.error("Supabase Web3 authentication failed:", error);
        return;
      }

      if (data?.session?.access_token) {
        setToken(data.session.access_token);
        console.log("Successfully signed in.");
      }
    } catch (err) {
      console.error("Web3 sign-in exception:", err);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();

      setToken("");
      setSelectedMarket(null);
      setActiveTab("markets");
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  // Select a market
  const handleSelectMarket = (marketId: string) => {
    const market = markets.find((m) => m.id === marketId);

    if (market) {
      setSelectedMarket(market);
      setActiveTab("trading");
    }
  };

  // Called after an order/action completes
  const handleActionComplete = () => {
    setRefreshKey((prev) => prev + 1);
    fetchMarkets();
  };

  // User isn't signed in
  if (!claims) {
    return (
      <div className="app">
        <div className="auth-container">
          <h1>Prediction Market</h1>

          <p>Please sign in to access the market</p>

          {window.solflare && (
            <button onClick={handleSignIn}>
              Sign in with Solflare
            </button>
          )}

          {!window.solflare && (
            <p>Please install Solflare wallet to continue</p>
          )}
        </div>
      </div>
    );
  }

  // User is signed in
  return (
    <div className="app">
      <header className="app-header">
        <h1>Prediction Market</h1>

        <button onClick={handleSignOut}>
          Logout
        </button>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === "markets" ? "active" : ""}
          onClick={() => {
            setActiveTab("markets");
            setSelectedMarket(null);
          }}
        >
          Markets
        </button>

        <button
          className={activeTab === "trading" ? "active" : ""}
          onClick={() => setActiveTab("trading")}
          disabled={!selectedMarket}
        >
          Trading
        </button>

        <button
          className={activeTab === "balance" ? "active" : ""}
          onClick={() => setActiveTab("balance")}
        >
          Balance
        </button>

        <button
          className={activeTab === "positions" ? "active" : ""}
          onClick={() => setActiveTab("positions")}
        >
          Positions
        </button>

        <button
          className={activeTab === "history" ? "active" : ""}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "markets" && (
          <MarketList
            markets={markets}
            onSelectMarket={handleSelectMarket}
          />
        )}

        {activeTab === "trading" && selectedMarket && (
          <div className="trading-container">
            <MarketDetail
              market={selectedMarket}
              onBack={() => {
                setActiveTab("markets");
                setSelectedMarket(null);
              }}
            />

            <aside className="trade-sidebar">
              <OrderForm
                market={selectedMarket}
                token={token}
                onOrderPlaced={handleActionComplete}
              />

              <SplitMerge
                market={selectedMarket}
                token={token}
                onActionComplete={handleActionComplete}
              />
            </aside>
          </div>
        )}

        {activeTab === "balance" && (
          <Balance
            token={token}
            key={refreshKey}
          />
        )}

        {activeTab === "positions" && (
          <Positions
            token={token}
            markets={markets}
            key={refreshKey}
          />
        )}

        {activeTab === "history" && (
          <OrderHistory
            token={token}
            markets={markets}
            key={refreshKey}
          />
        )}
      </main>
    </div>
  );
}

export default App;