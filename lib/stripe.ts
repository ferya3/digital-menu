import "server-only";

/**
 * Minimal Stripe Checkout client (REST API, no SDK dependency).
 * Used for platform subscriptions (platform key) and for restaurant table bills (each restaurant's own key).
 * Payments are confirmed by retrieving the Checkout Session from Stripe on return/webhook,
 * so no client-supplied data is trusted.
 */
const API = process.env.STRIPE_API_BASE || "https://api.stripe.com/v1";

/** Currencies without minor units (amount is sent as-is, not ×100) */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
export const toMinor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
export const fromMinor = (minor: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;

async function call<T>(key: string, path: string, init: { method: "GET" | "POST"; form?: URLSearchParams }): Promise<T> {
  if (!/^(sk|rk)_(test|live)_/.test(key || "")) throw new Error("Stripe secret key is missing or invalid");
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${key}`, ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: init.form,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  return data;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | null;
  metadata: Record<string, string>;
}

/** Create a one-off Checkout Session and return it (redirect the customer to `session.url`). */
export async function createCheckout(o: {
  key: string; amount: number; currency: string; name: string; description?: string;
  successUrl: string; cancelUrl: string; metadata: Record<string, string>; email?: string;
}): Promise<CheckoutSession> {
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("success_url", o.successUrl);
  f.set("cancel_url", o.cancelUrl);
  f.set("line_items[0][quantity]", "1");
  f.set("line_items[0][price_data][currency]", o.currency.toLowerCase());
  f.set("line_items[0][price_data][unit_amount]", String(toMinor(o.amount, o.currency)));
  f.set("line_items[0][price_data][product_data][name]", o.name.slice(0, 250));
  if (o.description) f.set("line_items[0][price_data][product_data][description]", o.description.slice(0, 500));
  for (const [k, v] of Object.entries(o.metadata)) {
    f.set(`metadata[${k}]`, v);
    f.set(`payment_intent_data[metadata][${k}]`, v);
  }
  if (o.email) f.set("customer_email", o.email);
  return call<CheckoutSession>(o.key, "/checkout/sessions", { method: "POST", form: f });
}

export async function getCheckout(key: string, id: string): Promise<CheckoutSession> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id || "")) throw new Error("Invalid checkout session");
  return call<CheckoutSession>(key, `/checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" });
}

/** A session counts as paid only when Stripe says so and the amount/currency match what we expect. */
export function isPaid(s: CheckoutSession, amount: number, currency: string) {
  return s.payment_status === "paid"
    && (s.currency || "").toUpperCase() === currency.toUpperCase()
    && s.amount_total === toMinor(amount, currency);
}
