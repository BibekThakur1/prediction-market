import type { Market, Order, Position } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "Request failed");
  return payload;
}

export const api = {
  markets: () => request<{ markets: Market[] }>("/markets"),
  me: (token: string) => request<{ user: { id: string; address: string; availableBalance: number; reservedBalance: number } }>("/me", token),
  positions: (token: string) => request<{ positions: Position[] }>("/positions", token),
  orders: (token: string) => request<{ orders: Order[] }>("/orders", token),
  placeOrder: (token: string, data: { marketId: string; outcome: "YES" | "NO"; side: "BUY" | "SELL"; price: number; quantity: number }) =>
    request("/orders", token, { method: "POST", body: JSON.stringify(data) }),
  cancelOrder: (token: string, orderId: string) => request(`/orders/${orderId}/cancel`, token, { method: "POST" }),
  split: (token: string, marketId: string, quantity: number) => request("/split", token, { method: "POST", body: JSON.stringify({ marketId, quantity }) }),
  merge: (token: string, marketId: string, quantity: number) => request("/merge", token, { method: "POST", body: JSON.stringify({ marketId, quantity }) }),
  deposit: (token: string, amount: number) => request("/deposits", token, { method: "POST", body: JSON.stringify({ amount }) }),
  withdraw: (token: string, amount: number) => request("/withdrawals", token, { method: "POST", body: JSON.stringify({ amount }) }),
};
