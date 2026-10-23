"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, Phone, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, orderCode, num } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { staffSettleTableAction, staffTablePayAction } from "@/app/staff/actions";
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

/** Group orders by table (each card = one table's whole bill) */
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
  // Customer asked for a card reader: print the bill and a server brings the card reader
  const pos = groupByTable(orders.filter((o) => !o.paid && o.status !== "cancelled" && o.payStatus === "pos"));
  // Open bills without a receipt (paid in cash or by card at the counter)
  const open = groupByTable(orders.filter((o) => !o.paid && o.status !== "cancelled" && o.payStatus !== "pending" && o.payStatus !== "pos"));
  const confirmed = groupByTable(orders.filter((o) => o.paid)).slice(0, 30);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Panel title="Payments awaiting approval" icon={<CreditCard className="size-5 text-primary" />} count={num(pending.length)}>
        {pending.length === 0 ? <Empty text="No pending payments" /> : (
          <div className="grid gap-3 md:grid-cols-2">{pending.map((g) => <BillCard key={g.table} g={g} kind="pending" onDone={onRefresh} />)}</div>
        )}
      </Panel>
      {pos.length > 0 && (
        <Panel title="Card reader at the table" icon={<Printer className="size-5 text-blue-600" />} count={num(pos.length)} className="border-blue-600/30">
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">Print the bill so a server can take it to the table with the card reader; tap “Paid” once the card has been charged.</p>
          <div className="grid gap-3 md:grid-cols-2">{pos.map((g) => <BillCard key={g.table} g={g} kind="pos" onDone={onRefresh} />)}</div>
        </Panel>
      )}
      <Panel title="Open bills (no receipt)" icon={<Banknote className="size-5 text-amber-600" />} count={num(open.length)}>
        {open.length === 0 ? <Empty text="No open bills" /> : (
          <div className="grid gap-3 md:grid-cols-2">{open.map((g) => <BillCard key={g.table} g={g} kind="open" onDone={onRefresh} />)}</div>
        )}
      </Panel>
      <Panel title="Paid" icon={<CheckCircle2 className="size-5 text-green-600" />}>
        {confirmed.length === 0 ? <Empty text="—" /> : (
          <div className="grid gap-3 md:grid-cols-2">{confirmed.map((g) => <BillCard key={g.table} g={g} kind="paid" onDone={onRefresh} />)}</div>
        )}
      </Panel>
    </div>
  );
}

function BillCard({ g, kind, onDone }: { g: Group; kind: "pending" | "open" | "paid" | "pos"; onDone: () => void }) {
  const { money, codeMode, print, viewImage, ask, flash } = useStaff();
  const [busy, setBusy] = useState<"" | "ok" | "no">("");

  async function confirmAll() {
    setBusy("ok");
    try {
      if (kind === "pending") await staffTablePayAction(g.table, "confirmed");
      else await staffSettleTableAction(g.table);
      flash(`Payment for Table ${num(g.table)} confirmed ✅`);
      onDone();
    } catch (e) { flash(e instanceof Error ? e.message : "Error"); } finally { setBusy(""); }
  }
  async function rejectAll() {
    const reason = await ask("Reject receipt", "The reason (optional) is shown to the customer and the receipt image is deleted.");
    if (reason === null) return;
    setBusy("no");
    try { await staffTablePayAction(g.table, "rejected", reason); flash("Receipt rejected"); onDone(); }
    catch (e) { flash(e instanceof Error ? e.message : "Error"); } finally { setBusy(""); }
  }

  return (
    <article className={cn("rounded-2xl border bg-background p-3.5", kind === "pending" ? "border-amber-500/40" : kind === "pos" ? "border-blue-600/40" : kind === "paid" ? "border-green-600/30 opacity-80" : "border-border")}>
      <div className="mb-2 flex items-center justify-between">
        <TableBadge table={num(g.table)} />
        <span className="text-xs text-muted-foreground">{num(g.orders.length)} {g.orders.length === 1 ? "order" : "orders"}</span>
      </div>
      <ul className="mb-2 space-y-0.5 text-sm">
        {g.orders.map((o) => (
          <li key={o.id} className="flex justify-between gap-2">
            <span className="text-muted-foreground"><span>{orderCode(o, codeMode)}</span> · {fmtDateTime(o.createdAt)}</span>
            <span>{money(o.total)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">{kind === "paid" ? "Total paid" : "Amount due"}</span>
        <strong className="text-lg text-primary">{money(g.total)}</strong>
      </div>
      {g.phone && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3.5" /><span>{g.phone}</span></p>}
      {g.reused && kind === "pending" && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-500/15 p-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" /> This image was used before — possibly a duplicate screenshot. Please check carefully.
        </p>
      )}
      {kind === "pending" && (g.receipt ? (
        <button onClick={() => viewImage(g.receipt)} className="mt-2 block w-full overflow-hidden rounded-xl border border-border" aria-label="View receipt">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.receipt} alt="Payment receipt" className="max-h-56 w-full object-contain bg-muted" />
        </button>
      ) : <p className="mt-2 text-xs text-muted-foreground">No receipt</p>)}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kind === "pending" && (
          <>
            <Button size="sm" className="h-8 flex-1 rounded-xl bg-green-600 text-white hover:bg-green-600/90" disabled={!!busy} onClick={confirmAll}>{busy === "ok" ? <Loader2 className="animate-spin" /> : "✅ Approve payment"}</Button>
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-primary" disabled={!!busy} onClick={rejectAll}>{busy === "no" ? <Loader2 className="animate-spin" /> : <><X className="size-3.5" /> Reject</>}</Button>
          </>
        )}
        {kind === "open" && (
          <Button size="sm" className="h-8 flex-1 rounded-xl" disabled={!!busy} onClick={() => { if (confirm(`Was the full bill for Table ${num(g.table)} paid?`)) confirmAll(); }}>{busy ? <Loader2 className="animate-spin" /> : <><Banknote className="size-3.5" /> Paid (cash/card)</>}</Button>
        )}
        {kind === "pos" && (
          <>
            <Button size="sm" className="h-8 flex-1 rounded-xl" onClick={() => print("table=" + encodeURIComponent(g.table))}><Printer className="size-3.5" /> Print bill</Button>
            <Button size="sm" className="h-8 flex-1 rounded-xl bg-green-600 text-white hover:bg-green-600/90" disabled={!!busy} onClick={() => { if (confirm(`Was Table ${num(g.table)} paid with the card reader?`)) confirmAll(); }}>{busy ? <Loader2 className="animate-spin" /> : "Paid (card reader)"}</Button>
          </>
        )}
        {kind === "paid" && <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"><CheckCircle2 className="size-4" /> Payment confirmed</span>}
        {kind !== "pos" && <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={() => print("orders=" + g.orders.map((o) => o.id).join(","))}><Printer className="size-3.5" /> Print bill</Button>}
      </div>
    </article>
  );
}
