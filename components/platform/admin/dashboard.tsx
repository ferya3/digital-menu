"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarPlus, Loader2, MessageSquareText, Table2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, getPlatformCurrency, money, num } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminExtendAction, adminOwnerSmsAction, adminStatsAction } from "@/app/platform/actions";
import type { PlatformStats } from "@/lib/platform-admin";
import { Box, err, type Flash } from "./shared";

/** Single-series bar chart (one color, quiet axis, tooltip on each bar) */
function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Axis max: a round number above the peak (so the bar label doesn't collide with the axis label)
  const peak = Math.max(1, ...data.map((d) => d.value));
  const p10 = 10 ** Math.floor(Math.log10(peak * 1.15));
  const r = (peak * 1.15) / p10;
  const max = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p10;
  if (data.every((d) => d.value === 0)) {
    return <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">No data to show yet</div>;
  }
  const top = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  return (
    <div className="relative" role="img" aria-label={label}>
      {/* Faint grid lines */}
      <div className="relative h-44">
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${f * 100}%` }}>
            {/* Axis label in its own column on the left (never overlaps the bars) */}
            <span className="absolute -top-2 left-0 w-10 text-right text-[10px] leading-none text-muted-foreground">{format(Math.round(max * f))}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-11 right-0 flex items-end gap-[2px] border-b border-border">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
              <div className={cn("w-full max-w-7 rounded-t-[4px] bg-primary transition-opacity", hover !== null && hover !== i && "opacity-40")}
                style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : "0" }} />
              {/* Direct label only on the highest value */}
              {i === top && d.value > 0 && hover === null && (
                <span className="absolute -translate-y-1 whitespace-nowrap text-[10px] font-bold text-foreground" style={{ bottom: `${(d.value / max) * 100}%` }}>{format(d.value)}</span>
              )}
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-xl bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background shadow-lg">
                  {d.label}: {format(d.value)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px] pl-11">
        {/* On phones every third month is labeled (no clipping); on large screens every other one */}
        {data.map((d, i) => {
          const k = data.length - 1 - i;
          return <span key={i} className={cn("flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-muted-foreground", k % 2 !== 0 && "invisible", k % 3 !== 0 && "max-sm:invisible", k % 3 === 0 && "max-sm:visible")}>{d.label}</span>;
        })}
      </div>
    </div>
  );
}

/** Compact amount for chart labels, e.g. "$1.2K" */
const compactMoney = (n: number) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: getPlatformCurrency(), notation: "compact", maximumFractionDigits: 1 }).format(n); }
  catch { return money(n); }
};

export function Dashboard({ flash, onOpenTenant }: { flash: Flash; onOpenTenant: (slug: string) => void }) {
  const [s, setS] = useState<PlatformStats | null>(null);
  const [table, setTable] = useState(false);
  const [busy, setBusy] = useState("");
  const load = () => adminStatsAction().then((r) => setS(unwrap(r))).catch((e) => flash("❌ " + err(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const change = s.revenueLastMonth ? Math.round(((s.revenueThisMonth - s.revenueLastMonth) / s.revenueLastMonth) * 100) : null;
  const tiles: [string, string, string?][] = [
    ["Revenue this month", money(s.revenueThisMonth), change === null ? undefined : `${change >= 0 ? "▲" : "▼"} ${num(Math.abs(change))}% vs last month`],
    ["MRR (estimated)", money(s.mrr)],
    ["Signups (7 days)", num(s.signups7)],
    ["Signups (30 days)", num(s.signups30)],
  ];
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); flash(ok); load(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="rounded-3xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">{k}</div>
            <b className="mt-1 block text-xl">{v}</b>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTable((t) => !t)}>
          {table ? <><BarChart3 className="size-4" /> Show chart</> : <><Table2 className="size-4" /> Show table</>}
        </Button>
      </div>
      {table ? (
        <Box title="Last 12 months">
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-2.5 text-start">Month</th><th className="p-2.5 text-start">Signups</th><th className="p-2.5 text-start">Revenue</th></tr></thead>
              <tbody>{[...s.months].reverse().map((m) => <tr key={m.key} className="border-t border-border"><td className="p-2.5">{m.label} {num(m.key.slice(0, 4))}</td><td className="p-2.5">{num(m.signups)}</td><td className="p-2.5">{money(m.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        </Box>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title={`Monthly revenue (${getPlatformCurrency()})`}><BarChart label="Monthly revenue" data={s.months.map((m) => ({ label: m.label, value: m.revenue }))} format={compactMoney} /></Box>
          <Box title="Monthly signups"><BarChart label="Monthly signups" data={s.months.map((m) => ({ label: m.label, value: m.signups }))} format={(n) => num(n)} /></Box>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Expiring soon (next 7 days)">
          {s.expiringSoon.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing expiring</p> : (
            <div className="space-y-2">
              {s.expiringSoon.map((t) => (
                <div key={t.slug} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-2.5 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
                  <button onClick={() => onOpenTenant(t.slug)} className="min-w-0 flex-1 truncate text-start font-bold hover:text-primary">{t.name}</button>
                  <span className="text-xs text-muted-foreground">{num(t.daysLeft)} {t.daysLeft === 1 ? "day" : "days"}</span>
                  <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy}
                    onClick={() => run("x" + t.slug, async () => unwrap(await adminExtendAction(t.slug, { months: 1 })), `✅ ${t.name} extended by 1 month`)}><CalendarPlus className="size-3.5" /> 1 month</Button>
                  {t.phone && <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy}
                    onClick={() => run("s" + t.slug, async () => unwrap(await adminOwnerSmsAction("{brand}: the subscription for {name} ends in {days} days. Renew here: {link}", "all", t.slug)), "✅ Reminder sent")}><MessageSquareText className="size-3.5" /> Remind</Button>}
                </div>
              ))}
            </div>
          )}
        </Box>
        <Box title="Latest signups">
          {s.recentSignups.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No signups yet</p> : (
            <div className="divide-y divide-border">
              {s.recentSignups.map((t) => (
                <button key={t.slug} onClick={() => onOpenTenant(t.slug)} className="flex w-full items-center justify-between gap-2 py-2 text-start text-sm hover:text-primary">
                  <b className="truncate">{t.name}</b><span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(t.at)}</span>
                </button>
              ))}
            </div>
          )}
        </Box>
      </div>
    </div>
  );
}
