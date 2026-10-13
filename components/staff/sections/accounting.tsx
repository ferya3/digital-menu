"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Calculator, CalendarDays, Download, Loader2, TrendingDown, TrendingUp, Trophy, Wallet, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";
import { staffAccountingAction } from "@/app/staff/actions";
import type { Accounting, DayRow, Method } from "@/lib/accounting";
import { Empty, Panel, useStaff } from "@/components/staff/kit";

const METHOD_FA: Record<Method, string> = {
  receipt: "کارت‌به‌کارت (فیش)",
  pos: "کارت‌خوان سر میز",
  counter: "صندوق (نقدی / کارت‌خوان)",
};

export function AccountingSection() {
  const { money, currency, flash } = useStaff();
  const [data, setData] = useState<Accounting | null>(null);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    staffAccountingAction(month).then(setData).catch(() => flash("خطا در بارگذاری گزارش")).finally(() => setLoading(false));
  }, [month, flash]);

  // اعداد کوتاه برای محورِ نمودار (به واحدِ پولِ انتخاب‌شده)
  const short = (n: number) => {
    const v = currency === "rial" ? n * 10 : n;
    if (v >= 1e9) return toFa((v / 1e9).toFixed(1).replace(/\.0$/, "")) + " میلیارد";
    if (v >= 1e6) return toFa((v / 1e6).toFixed(1).replace(/\.0$/, "")) + " م";
    if (v >= 1e3) return toFa(Math.round(v / 1e3)) + " هزار";
    return toFa(v);
  };

  if (!data) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;
  const avg = (r: number, o: number) => (o ? Math.round(r / o) : 0);

  function exportCsv() {
    const rows = [["تاریخ", "روز هفته", "تعداد سفارش", "تعداد آیتم", `درآمد (${currency === "rial" ? "ریال" : "تومان"})`]];
    for (const d of data!.selected.days) rows.push([d.key.replace(/-/g, "/"), d.weekday, String(d.orders), String(d.items), String(currency === "rial" ? d.revenue * 10 : d.revenue)]);
    rows.push(["جمع", "", String(data!.selected.totals.orders), String(data!.selected.totals.items), String(currency === "rial" ? data!.selected.totals.revenue * 10 : data!.selected.totals.revenue)]);
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `report-${data!.selected.key}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* کاشی‌های خلاصه */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi title="امروز" sub={data.today.label} revenue={data.today.revenue} orders={data.today.orders} prev={data.yesterday.revenue} prevLabel="دیروز" money={money} />
        <Kpi title="دیروز" revenue={data.yesterday.revenue} orders={data.yesterday.orders} money={money} />
        <Kpi title="این ماه" sub={data.thisMonth.label} revenue={data.thisMonth.revenue} orders={data.thisMonth.orders} prev={data.lastMonth.revenue} prevLabel="ماه قبل" money={money} accent />
        <Kpi title="ماه قبل" sub={data.lastMonth.label} revenue={data.lastMonth.revenue} orders={data.lastMonth.orders} money={money} />
      </div>

      <Panel title="درآمد روزانه — ۳۰ روز اخیر" icon={<BarChart3 className="size-5 text-primary" />}>
        <DailyChart days={data.last30} money={money} short={short} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title={`گزارش ${data.selected.label}`}
          icon={<CalendarDays className="size-5 text-primary" />}
          action={
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <select value={data.selected.key} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-input bg-background px-2 py-1.5 text-sm">
                {data.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={exportCsv}><Download className="size-3.5" /> اکسل</Button>
            </div>
          }
        >
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="درآمد ماه" value={money(data.selected.totals.revenue)} strong />
            <Mini label="سفارش" value={toFa(data.selected.totals.orders)} />
            <Mini label="میانگین هر سفارش" value={money(avg(data.selected.totals.revenue, data.selected.totals.orders))} />
          </div>
          {data.selected.days.every((d) => d.orders === 0) ? <Empty text="در این ماه فروشی ثبت نشده" /> : <DaysTable days={data.selected.days} money={money} />}
        </Panel>

        <div className="space-y-4">
          <Panel title="روش‌های پرداخت" icon={<Wallet className="size-5 text-primary" />}>
            <MethodBars byMethod={data.selected.byMethod} money={money} />
          </Panel>
          <Panel title="پرفروش‌ترین‌ها" icon={<Trophy className="size-5 text-amber-500" />}>
            {data.selected.topItems.length === 0 ? <Empty text="—" /> : (
              <ol className="space-y-1.5 text-sm">
                {data.selected.topItems.map((it, i) => (
                  <li key={it.name} className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold">{toFa(i + 1)}</span>
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <span className="text-xs text-muted-foreground">{toFa(it.qty)} عدد</span>
                    <span className="w-28 shrink-0 text-left font-semibold">{money(it.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="طلبِ باز (پرداخت‌نشده)" icon={<Calculator className="size-5 text-primary" />}>
            <p className="text-sm text-muted-foreground"><b className="text-lg text-foreground">{money(data.openDebt.revenue)}</b> در {toFa(data.openDebt.orders)} سفارشِ هنوز پرداخت‌نشده</p>
          </Panel>
        </div>
      </div>

      <Panel title="درآمد ماهانه — ۱۲ ماه اخیر" icon={<CalendarDays className="size-5 text-primary" />}>
        <MonthsTable months={data.months} money={money} selected={data.selected.key} onPick={setMonth} />
      </Panel>
      <p className="text-center text-[11px] text-muted-foreground">درآمد = جمعِ سفارش‌های پرداخت‌شده (لغوشده‌ها حساب نمی‌شوند)، بر اساسِ زمانِ پرداخت و تقویمِ شمسی به وقتِ تهران.</p>
    </div>
  );
}

/* ---------- کاشیِ خلاصه ---------- */
function Kpi({ title, sub, revenue, orders, prev, prevLabel, money, accent }: {
  title: string; sub?: string; revenue: number; orders: number; prev?: number; prevLabel?: string; money: (n: number) => string; accent?: boolean;
}) {
  const change = prev === undefined ? null : prev === 0 ? (revenue > 0 ? Infinity : 0) : ((revenue - prev) / prev) * 100;
  return (
    <div className={cn("rounded-3xl border p-4 shadow-sm", accent ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{title}</span>
        {sub && <span className="truncate text-[11px] text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{money(revenue)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{toFa(orders)} سفارش</span>
        {change !== null && (
          <span className={cn("flex items-center gap-0.5 font-semibold", change > 0 ? "text-green-700 dark:text-green-400" : change < 0 ? "text-primary" : "")}>
            {change > 0 ? <TrendingUp className="size-3.5" /> : change < 0 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />}
            {change === Infinity ? "جدید" : `${toFa(Math.abs(Math.round(change)))}٪`} نسبت به {prevLabel}
          </span>
        )}
      </div>
    </div>
  );
}
function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold", strong && "text-primary")}>{value}</div>
    </div>
  );
}

/* ---------- نمودارِ میله‌ایِ روزانه (یک سری، یک رنگ؛ راهنما با هاور/لمس) ---------- */
function DailyChart({ days, money, short }: { days: DayRow[]; money: (n: number) => string; short: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.revenue), 0);
  // سقفِ گرد برای خطوطِ راهنما
  const top = useMemo(() => {
    if (max <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  }, [max]);
  const total = days.reduce((s, d) => s + d.revenue, 0);
  const best = days.reduce((b, d, i) => (d.revenue > days[b].revenue ? i : b), 0);
  if (max === 0) return <Empty text="در ۳۰ روز اخیر فروشی ثبت نشده" />;
  const H = 200;
  const h = hover !== null ? days[hover] : null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">جمع ۳۰ روز: <b className="text-foreground">{money(total)}</b></span>
        <span className="text-muted-foreground">میانگین روزانه: <b className="text-foreground">{money(Math.round(total / days.length))}</b></span>
      </div>
      <div className="relative" style={{ height: H + 28 }}>
        {/* خطوطِ راهنمای کم‌رنگ */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70" style={{ bottom: 28 + f * H }}>
            <span className="absolute -top-2.5 left-0 bg-card pr-1 text-[10px] text-muted-foreground">{short(top * f)}</span>
          </div>
        ))}
        {/* میله‌ها: قدیمی سمتِ راست ← امروز سمتِ چپ (جهتِ خواندنِ فارسی) */}
        <div className="absolute inset-x-0 bottom-7 flex items-end gap-[2px] pl-14" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <button
              key={d.key}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${d.weekday} ${toFa(d.day)}: ${money(d.revenue)}`}
              className="group relative flex h-full flex-1 items-end"
            >
              <span
                className={cn("w-full rounded-t-[4px] transition-colors", hover === i ? "bg-primary" : "bg-primary/75 group-hover:bg-primary")}
                style={{ height: d.revenue ? Math.max(3, (d.revenue / top) * H) : 0 }}
              />
              {/* برچسبِ مستقیم فقط برای بیشترین روز */}
              {i === best && hover === null && (
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-foreground" style={{ bottom: (d.revenue / top) * H + 4 }}>
                  {short(d.revenue)}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* محورِ روزها (هر ۵ روز یک برچسب + امروز) */}
        <div className="absolute inset-x-0 bottom-0 flex gap-[2px] pl-14 text-[10px] text-muted-foreground">
          {days.map((d, i) => (
            <span key={d.key} className="flex-1 text-center">{i === days.length - 1 ? "امروز" : (days.length - 1 - i) % 5 === 0 ? toFa(d.day) : ""}</span>
          ))}
        </div>
        {/* راهنما */}
        {h && (
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
            <div className="font-bold">{h.weekday} {toFa(h.day)}</div>
            <div className="mt-0.5">{money(h.revenue)}</div>
            <div className="text-muted-foreground">{toFa(h.orders)} سفارش</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- جدولِ روزهای ماه ---------- */
function DaysTable({ days, money }: { days: DayRow[]; money: (n: number) => string }) {
  const max = Math.max(...days.map((d) => d.revenue), 1);
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-right font-semibold">روز</th>
            <th className="p-2 text-right font-semibold">سفارش</th>
            <th className="p-2 text-right font-semibold">درآمد</th>
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.key} className={cn("border-t border-border", d.orders === 0 && "text-muted-foreground")}>
              <td className="p-2 whitespace-nowrap">{toFa(d.day)} · <span className="text-xs text-muted-foreground">{d.weekday}</span></td>
              <td className="p-2">{toFa(d.orders)}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span className="w-28 shrink-0 font-semibold">{money(d.revenue)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(d.revenue / max) * 100}%` }} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- روش‌های پرداخت (میله‌های افقیِ تک‌رنگ با برچسب) ---------- */
function MethodBars({ byMethod, money }: { byMethod: Record<Method, number>; money: (n: number) => string }) {
  const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
  if (!total) return <Empty text="—" />;
  return (
    <div className="space-y-3">
      {(Object.keys(METHOD_FA) as Method[]).map((m) => {
        const pct = (byMethod[m] / total) * 100;
        return (
          <div key={m}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span>{METHOD_FA[m]}</span>
              <span className="font-semibold">{money(byMethod[m])} <span className="text-xs font-normal text-muted-foreground">({toFa(Math.round(pct))}٪)</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- جدولِ ماهانه ---------- */
function MonthsTable({ months, money, selected, onPick }: { months: Accounting["months"]; money: (n: number) => string; selected: string; onPick: (k: string) => void }) {
  const max = Math.max(...months.map((m) => m.revenue), 1);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="p-2.5 text-right font-semibold">ماه</th>
            <th className="p-2.5 text-right font-semibold">سفارش</th>
            <th className="p-2.5 text-right font-semibold">میانگین</th>
            <th className="p-2.5 text-right font-semibold">درآمد</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key} onClick={() => onPick(m.key)} className={cn("cursor-pointer border-t border-border transition hover:bg-muted/50", m.key === selected && "bg-primary/[0.06]", m.orders === 0 && "text-muted-foreground")}>
              <td className="p-2.5 font-semibold whitespace-nowrap">{m.label}</td>
              <td className="p-2.5">{toFa(m.orders)}</td>
              <td className="p-2.5">{money(m.orders ? Math.round(m.revenue / m.orders) : 0)}</td>
              <td className="p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0 font-bold">{money(m.revenue)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary/75" style={{ width: `${(m.revenue / max) * 100}%` }} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
