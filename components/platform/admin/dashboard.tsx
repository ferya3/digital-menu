"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarPlus, Loader2, MessageSquareText, Table2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, money, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminExtendAction, adminOwnerSmsAction, adminStatsAction } from "@/app/platform/actions";
import type { PlatformStats } from "@/lib/platform-admin";
import { Box, err, type Flash } from "./shared";

/** نمودارِ میله‌ایِ تک‌سری (یک رنگ، محورِ آرام، راهنمای شناور روی هر میله) */
function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // سقفِ محور: عددِ گرد بالاتر از بیشترین مقدار (برچسبِ میله با برچسبِ محور روی هم نیفتد)
  const peak = Math.max(1, ...data.map((d) => d.value));
  const p10 = 10 ** Math.floor(Math.log10(peak * 1.15));
  const r = (peak * 1.15) / p10;
  const max = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p10;
  const top = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  return (
    <div className="relative" role="img" aria-label={label}>
      {/* خطوطِ راهنمای کم‌رنگ */}
      <div className="relative h-44">
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${f * 100}%` }}>
            {/* برچسبِ محور در ستونِ جداگانهٔ سمتِ راست (با میله‌ها روی هم نمی‌افتد) */}
            <span className="absolute -top-2 right-0 w-10 text-left text-[10px] leading-none text-muted-foreground">{format(Math.round(max * f))}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-0 right-11 flex items-end gap-[2px] border-b border-border">
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
              <div className={cn("w-full max-w-7 rounded-t-[4px] bg-primary transition-opacity", hover !== null && hover !== i && "opacity-40")}
                style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : "0" }} />
              {/* برچسبِ مستقیم فقط روی بیشترین مقدار */}
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
      <div className="mt-1 flex gap-[2px] pr-11">
        {data.map((d, i) => <span key={i} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{(data.length - 1 - i) % 2 === 0 ? d.label : ""}</span>)}
      </div>
    </div>
  );
}

export function Dashboard({ flash, onOpenTenant }: { flash: Flash; onOpenTenant: (slug: string) => void }) {
  const [s, setS] = useState<PlatformStats | null>(null);
  const [table, setTable] = useState(false);
  const [busy, setBusy] = useState("");
  const load = () => adminStatsAction().then((r) => setS(unwrap(r))).catch((e) => flash("❌ " + err(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const change = s.revenueLastMonth ? Math.round(((s.revenueThisMonth - s.revenueLastMonth) / s.revenueLastMonth) * 100) : null;
  const tiles: [string, string, string?][] = [
    ["درآمدِ این ماه", money(s.revenueThisMonth), change === null ? undefined : `${change >= 0 ? "▲" : "▼"} ${toFa(Math.abs(change))}٪ نسبت به ماهِ قبل`],
    ["درآمدِ ماهانهٔ تکرارشونده (تقریبی)", money(s.mrr)],
    ["ثبت‌نامِ ۷ روزِ اخیر", toFa(s.signups7)],
    ["ثبت‌نامِ ۳۰ روزِ اخیر", toFa(s.signups30)],
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
          {table ? <><BarChart3 className="size-4" /> نمایشِ نمودار</> : <><Table2 className="size-4" /> نمایشِ جدول</>}
        </Button>
      </div>
      {table ? (
        <Box title="۱۲ ماهِ اخیر">
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-2.5 text-right">ماه</th><th className="p-2.5 text-right">ثبت‌نام</th><th className="p-2.5 text-right">درآمد</th></tr></thead>
              <tbody>{[...s.months].reverse().map((m) => <tr key={m.key} className="border-t border-border"><td className="p-2.5">{m.label} {toFa(m.key.slice(0, 4))}</td><td className="p-2.5">{toFa(m.signups)}</td><td className="p-2.5">{money(m.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        </Box>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="درآمدِ ماهانه (تومان)"><BarChart label="درآمدِ ماهانه" data={s.months.map((m) => ({ label: m.label, value: m.revenue }))} format={(n) => (n >= 1e6 ? `${toFa((n / 1e6).toFixed(1))}م` : n >= 1e3 ? `${toFa(Math.round(n / 1e3))}ه` : toFa(n))} /></Box>
          <Box title="ثبت‌نامِ ماهانه"><BarChart label="ثبت‌نامِ ماهانه" data={s.months.map((m) => ({ label: m.label, value: m.signups }))} format={(n) => toFa(n)} /></Box>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="اشتراک‌هایی که تا ۷ روزِ دیگر تمام می‌شوند">
          {s.expiringSoon.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">موردی نیست</p> : (
            <div className="space-y-2">
              {s.expiringSoon.map((t) => (
                <div key={t.slug} className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-2.5 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
                  <button onClick={() => onOpenTenant(t.slug)} className="min-w-0 flex-1 truncate text-right font-bold hover:text-primary">{t.name}</button>
                  <span className="text-xs text-muted-foreground">{toFa(t.daysLeft)} روز</span>
                  <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy}
                    onClick={() => run("x" + t.slug, async () => unwrap(await adminExtendAction(t.slug, { months: 1 })), `✅ ${t.name} یک ماه تمدید شد`)}><CalendarPlus className="size-3.5" /> ۱ ماه</Button>
                  {t.phone && <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={!!busy}
                    onClick={() => run("s" + t.slug, async () => unwrap(await adminOwnerSmsAction("{brand}\nاشتراکِ «{name}» {days} روزِ دیگر تمام می‌شود. تمدید:\n{link}", "all", t.slug)), "✅ یادآوری فرستاده شد")}><MessageSquareText className="size-3.5" /> یادآوری</Button>}
                </div>
              ))}
            </div>
          )}
        </Box>
        <Box title="آخرین ثبت‌نام‌ها">
          {s.recentSignups.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">هنوز ثبت‌نامی نیست</p> : (
            <div className="divide-y divide-border">
              {s.recentSignups.map((t) => (
                <button key={t.slug} onClick={() => onOpenTenant(t.slug)} className="flex w-full items-center justify-between gap-2 py-2 text-right text-sm hover:text-primary">
                  <b className="truncate">{t.name}</b><span className="shrink-0 text-xs text-muted-foreground">{faDateTime(t.at)}</span>
                </button>
              ))}
            </div>
          )}
        </Box>
      </div>
    </div>
  );
}
