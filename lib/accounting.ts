import "server-only";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/queries";
import type { CafeInfo } from "@/lib/types";
import type { OrderItem } from "@/lib/types";

/**
 * Reports use the Gregorian calendar in the restaurant's time zone
 * (Settings → time zone; falls back to the APP_TIMEZONE environment variable, then UTC).
 */
const DAY = 86_400_000;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function tz(): string {
  const t = getSetting<Partial<CafeInfo>>("cafe", {}).timezone || process.env.APP_TIMEZONE || "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: t }); return t; } catch { return "UTC"; }
}
let TZ = "UTC";
let partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" });
let wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
function useZone(zone: string) {
  if (zone === TZ) return;
  TZ = zone;
  partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" });
  wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
}

function jParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => { const j = jParts(d); return `${j.y}-${pad(j.m)}-${pad(j.d)}`; };
const monthKey = (d: Date) => { const j = jParts(d); return `${j.y}-${pad(j.m)}`; };
const monthLabel = (key: string) => { const [y, m] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
function prevMonth(key: string) { let [y, m] = key.split("-").map(Number); m -= 1; if (m === 0) { m = 12; y -= 1; } return `${y}-${pad(m)}`; }

/** receipt = bank transfer, pos = card reader at the table, counter = cashier, online = Stripe */
export type Method = "receipt" | "pos" | "counter" | "online";
export interface Totals { revenue: number; orders: number; items: number }
export interface DayRow extends Totals { key: string; day: number; weekday: string }
export interface MonthRow extends Totals { key: string; label: string; byMethod: Record<Method, number> }
export interface Accounting {
  today: Totals & { label: string };
  yesterday: Totals;
  thisMonth: Totals & { label: string; key: string };
  lastMonth: Totals & { label: string };
  last30: DayRow[];
  months: MonthRow[];
  selected: {
    key: string;
    label: string;
    totals: Totals;
    days: DayRow[];
    byMethod: Record<Method, number>;
    topItems: { name: string; qty: number; revenue: number }[];
  };
  /** Open, unpaid bills (receivables) */
  openDebt: { revenue: number; orders: number };
}

const zero = (): Totals => ({ revenue: 0, orders: 0, items: 0 });
const zeroM = (): Record<Method, number> => ({ receipt: 0, pos: 0, counter: 0, online: 0 });

export function getAccounting(selectedMonth?: string): Accounting {
  useZone(tz());
  const now = new Date();
  const since = new Date(now.getTime() - 400 * DAY).toISOString();
  const rows = db()
    .prepare("SELECT total, items, pay_method, paid_at FROM orders WHERE paid = 1 AND status != 'cancelled' AND paid_at >= ?")
    .all(since) as unknown as { total: number; items: string; pay_method: string; paid_at: string }[];

  const byDay = new Map<string, Totals>();
  const byMonth = new Map<string, Totals & { byMethod: Record<Method, number> }>();
  const itemsByMonth = new Map<string, Map<string, { qty: number; revenue: number }>>();
  for (const r of rows) {
    const t = new Date(r.paid_at);
    if (isNaN(+t)) continue;
    const dk = dayKey(t), mk = dk.slice(0, 7);
    const lines = (() => { try { return JSON.parse(r.items || "[]") as OrderItem[]; } catch { return []; } })();
    const n = lines.reduce((s, l) => s + (l.qty || 0), 0);
    const d = byDay.get(dk) || zero();
    d.revenue += r.total; d.orders += 1; d.items += n;
    byDay.set(dk, d);
    const m = byMonth.get(mk) || { ...zero(), byMethod: zeroM() };
    m.revenue += r.total; m.orders += 1; m.items += n;
    const method = (["receipt", "pos", "counter", "online"].includes(r.pay_method) ? r.pay_method : "counter") as Method;
    m.byMethod[method] += r.total;
    byMonth.set(mk, m);
    const im = itemsByMonth.get(mk) || new Map();
    for (const l of lines) {
      const cur = im.get(l.name) || { qty: 0, revenue: 0 };
      cur.qty += l.qty || 0; cur.revenue += (l.price || 0) * (l.qty || 0);
      im.set(l.name, cur);
    }
    itemsByMonth.set(mk, im);
  }

  const dayRow = (d: Date): DayRow => {
    const k = dayKey(d);
    return { key: k, day: jParts(d).d, weekday: wdFmt.format(d), ...(byDay.get(k) || zero()) };
  };
  const totalsOf = (mk: string): Totals => { const m = byMonth.get(mk); return m ? { revenue: m.revenue, orders: m.orders, items: m.items } : zero(); };

  const thisMk = monthKey(now);
  const lastMk = prevMonth(thisMk);
  const todayKey = dayKey(now);

  // Last 30 days (oldest → today)
  const last30: DayRow[] = [];
  for (let i = 29; i >= 0; i--) last30.push(dayRow(new Date(now.getTime() - i * DAY)));

  // Last 12 months (newest → oldest)
  const months: MonthRow[] = [];
  for (let i = 0, k = thisMk; i < 12; i++, k = prevMonth(k)) {
    const m = byMonth.get(k);
    months.push({ key: k, label: monthLabel(k), ...(m ? { revenue: m.revenue, orders: m.orders, items: m.items } : zero()), byMethod: m ? m.byMethod : zeroM() });
  }

  // Selected month: its days up to today
  const sel = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth) && months.some((m) => m.key === selectedMonth) ? selectedMonth : thisMk;
  const days: DayRow[] = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date(now.getTime() - i * DAY);
    const mk = monthKey(d);
    if (mk === sel) days.push(dayRow(d));
    else if (mk < sel) break;
  }
  days.reverse();
  const topItems = [...(itemsByMonth.get(sel) || new Map()).entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const open = db()
    .prepare("SELECT COALESCE(SUM(total),0) s, COUNT(*) c FROM orders WHERE paid = 0 AND status != 'cancelled'")
    .get() as unknown as { s: number; c: number };

  return {
    today: { ...(byDay.get(todayKey) || zero()), label: `${wdFmt.format(now)}, ${MONTHS[jParts(now).m - 1]} ${jParts(now).d}` },
    yesterday: byDay.get(dayKey(new Date(now.getTime() - DAY))) || zero(),
    thisMonth: { ...totalsOf(thisMk), label: monthLabel(thisMk), key: thisMk },
    lastMonth: { ...totalsOf(lastMk), label: monthLabel(lastMk) },
    last30,
    months,
    selected: {
      key: sel,
      label: monthLabel(sel),
      totals: totalsOf(sel),
      days,
      byMethod: byMonth.get(sel)?.byMethod || zeroM(),
      topItems,
    },
    openDebt: { revenue: open.s, orders: open.c },
  };
}
