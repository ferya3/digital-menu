"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, Phone, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, orderCode, toFa } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { staffSetPaidAction, staffTablePayAction } from "@/app/staff/actions";
import { Empty, Panel, TableBadge, useStaff } from "@/components/staff/kit";

interface Group {
  table: string;
  orders: Order[];
  total: number;
  receipt: string;
  phone: string;
  reused: boolean;
  lastAt: number;
}

/** گروه‌بندیِ سفارش‌ها بر اساس میز (هر کارت = کلِ صورتحسابِ یک میز) */
function groupByTable(list: Order[]): Group[] {
  const map = new Map<string, Order[]>();
  for (const o of list) map.set(o.table, [...(map.get(o.table) || []), o]);
  return [...map.entries()]
    .map(([table, os]) => {
      const orders = [...os].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      return {
        table,
        orders,
        total: orders.reduce((s, o) => s + o.total, 0),
        receipt: orders.find((o) => o.receipt)?.receipt || "",
        phone: orders.find((o) => o.phone)?.phone || "",
        reused: orders.some((o) => o.receiptReused),
        lastAt: Math.max(...orders.map((o) => +new Date(o.updatedAt || o.createdAt))),
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function CashierSection({ orders, onRefresh }: { orders: Order[]; onRefresh: () => void }) {
  const pending = groupByTable(orders.filter((o) => o.payStatus === "pending"));
  // صورتحساب‌های باز بدون فیش (برای پرداخت نقدی/کارتخوان)
  const open = groupByTable(orders.filter((o) => !o.paid && o.status !== "cancelled" && o.payStatus !== "pending"));
  const confirmed = groupByTable(orders.filter((o) => o.paid)).slice(0, 30);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Panel title="پرداخت‌های در انتظار تأیید" icon={<CreditCard className="size-5 text-primary" />} count={toFa(pending.length)}>
        {pending.length === 0 ? <Empty text="پرداختی در انتظار نیست" /> : (
          <div className="grid gap-3 md:grid-cols-2">{pending.map((g) => <BillCard key={g.table} g={g} kind="pending" onDone={onRefresh} />)}</div>
        )}
      </Panel>
      <Panel title="صورتحساب‌های باز (بدون فیش)" icon={<Banknote className="size-5 text-amber-600" />} count={toFa(open.length)}>
        {open.length === 0 ? <Empty text="صورتحساب بازی نیست" /> : (
          <div className="grid gap-3 md:grid-cols-2">{open.map((g) => <BillCard key={g.table} g={g} kind="open" onDone={onRefresh} />)}</div>
        )}
      </Panel>
      <Panel title="تأییدشده‌ها" icon={<CheckCircle2 className="size-5 text-green-600" />}>
        {confirmed.length === 0 ? <Empty text="—" /> : (
          <div className="grid gap-3 md:grid-cols-2">{confirmed.map((g) => <BillCard key={g.table} g={g} kind="paid" onDone={onRefresh} />)}</div>
        )}
      </Panel>
    </div>
  );
}

function BillCard({ g, kind, onDone }: { g: Group; kind: "pending" | "open" | "paid"; onDone: () => void }) {
  const { money, codeMode, print, viewImage, ask, flash } = useStaff();
  const [busy, setBusy] = useState<"" | "ok" | "no">("");

  async function confirmAll() {
    setBusy("ok");
    try {
      if (kind === "pending") await staffTablePayAction(g.table, "confirmed");
      else await Promise.all(g.orders.map((o) => staffSetPaidAction(o.id, true)));
      flash(`پرداخت میز ${toFa(g.table)} تأیید شد ✅`);
      onDone();
    } catch (e) { flash(e instanceof Error ? e.message : "خطا"); } finally { setBusy(""); }
  }
  async function rejectAll() {
    const reason = await ask("عدم تأیید فیش", "دلیل (اختیاری) به مشتری نشان داده می‌شود و عکس فیش حذف می‌شود.");
    if (reason === null) return;
    setBusy("no");
    try { await staffTablePayAction(g.table, "rejected", reason); flash("فیش رد شد"); onDone(); }
    catch (e) { flash(e instanceof Error ? e.message : "خطا"); } finally { setBusy(""); }
  }

  return (
    <article className={cn("rounded-2xl border bg-background p-3.5", kind === "pending" ? "border-amber-500/40" : kind === "paid" ? "border-green-600/30 opacity-80" : "border-border")}>
      <div className="mb-2 flex items-center justify-between">
        <TableBadge table={toFa(g.table)} />
        <span className="text-xs text-muted-foreground">{toFa(g.orders.length)} سفارش</span>
      </div>
      <ul className="mb-2 space-y-0.5 text-sm">
        {g.orders.map((o) => (
          <li key={o.id} className="flex justify-between gap-2">
            <span className="text-muted-foreground"><span dir="ltr">{orderCode(o, codeMode)}</span> · {faDateTime(o.createdAt)}</span>
            <span>{money(o.total)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">{kind === "paid" ? "جمع پرداختی" : "جمع بدهی"}</span>
        <strong className="text-lg text-primary">{money(g.total)}</strong>
      </div>
      {g.phone && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3.5" /><span dir="ltr">{toFa(g.phone)}</span></p>}
      {g.reused && kind === "pending" && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-500/15 p-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" /> این تصویر قبلاً استفاده شده — احتمالاً اسکرین‌شات تکراری است. با دقت بررسی کنید.
        </p>
      )}
      {kind === "pending" && (g.receipt ? (
        <button onClick={() => viewImage(g.receipt)} className="mt-2 block w-full overflow-hidden rounded-xl border border-border" aria-label="مشاهدهٔ فیش">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.receipt} alt="فیش پرداخت" className="max-h-56 w-full object-contain bg-muted" />
        </button>
      ) : <p className="mt-2 text-xs text-muted-foreground">بدون فیش</p>)}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kind === "pending" && (
          <>
            <Button size="sm" className="h-8 flex-1 rounded-xl bg-green-600 text-white hover:bg-green-600/90" disabled={!!busy} onClick={confirmAll}>{busy === "ok" ? <Loader2 className="animate-spin" /> : "✅ تأیید پرداخت"}</Button>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-primary" disabled={!!busy} onClick={rejectAll}>{busy === "no" ? <Loader2 className="animate-spin" /> : <><X className="size-3.5" /> عدم تأیید</>}</Button>
          </>
        )}
        {kind === "open" && (
          <Button size="sm" className="h-8 flex-1 rounded-xl" disabled={!!busy} onClick={() => { if (confirm(`کل صورتحساب میز ${toFa(g.table)} پرداخت شد؟`)) confirmAll(); }}>{busy ? <Loader2 className="animate-spin" /> : <><Banknote className="size-3.5" /> پرداخت شد (نقدی/کارتخوان)</>}</Button>
        )}
        {kind === "paid" && <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"><CheckCircle2 className="size-4" /> پرداخت تأیید شد</span>}
        <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={() => print("orders=" + g.orders.map((o) => o.id).join(","))}><Printer className="size-3.5" /> چاپ صورتحساب</Button>
      </div>
    </article>
  );
}
