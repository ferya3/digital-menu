"use client";

import { useMemo, useState } from "react";
import { Ban, CreditCard, Printer, Phone, StickyNote, ImageIcon, Star, MessageSquareText, ClipboardList, AlertTriangle, Hourglass, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, fmtTime, orderCode, num } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import type { StaffFeedback } from "@/lib/queries";
import { staffSetPaidAction, staffSetStatusAction } from "@/app/staff/actions";
import { Empty, Panel, TableBadge, useStaff } from "@/components/staff/kit";
import { unwrap } from "@/lib/action-result";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New", preparing: "Preparing", ready: "Ready", served: "Served", cancelled: "Cancelled",
};
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "served", label: "Mark served" },
};
const TONE: Record<OrderStatus, string> = {
  new: "border-l-primary",
  preparing: "border-l-amber-500",
  ready: "border-l-green-600",
  served: "border-l-border opacity-70",
  cancelled: "border-l-border opacity-50",
};
const isActive = (o: Order) => o.status !== "served" && o.status !== "cancelled";

type Filter = "active" | "done" | "all";

export function OrdersSection({ orders, feedback, onChange, payFirst, onCashier }: {
  orders: Order[]; feedback: StaffFeedback[]; onChange: (o: Order | null) => void; payFirst: boolean; onCashier: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  // Pay first: unpaid orders don't belong to the kitchen yet
  // (an order already in the kitchen stays there)
  const waits = (o: Order) => payFirst && o.status === "new" && !o.paid;
  const awaiting = useMemo(() => orders.filter(waits), [orders, payFirst]); // eslint-disable-line react-hooks/exhaustive-deps
  const kitchen = useMemo(() => orders.filter((o) => !waits(o)), [orders, payFirst]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = kitchen.filter(isActive).length;
  const list = useMemo(
    () => kitchen.filter((o) => (filter === "all" ? true : filter === "active" ? isActive(o) : !isActive(o))),
    [kitchen, filter]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
      {payFirst && awaiting.length > 0 && <AwaitingPanel list={awaiting} onChange={onChange} onCashier={onCashier} />}
      <Panel
        title={payFirst ? "Kitchen orders (paid)" : "Orders"}
        icon={payFirst ? <ChefHat className="size-5 text-primary" /> : <ClipboardList className="size-5 text-primary" />}
        count={num(active)}
        action={
          <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
            {([["active", "Active"], ["done", "Served/cancelled"], ["all", "All"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFilter(id)} className={cn("rounded-full px-3 py-1 transition", filter === id ? "bg-card shadow" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
        }
      >
        {list.length === 0 ? (
          <Empty text={filter === "active" ? "No active orders" : "No orders yet"} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((o) => <OrderCard key={o.id} o={o} onChange={onChange} />)}
          </div>
        )}
      </Panel>
      </div>
      <FeedbackPanel items={feedback} />
    </div>
  );
}

function OrderCard({ o, onChange }: { o: Order; onChange: (o: Order | null) => void }) {
  const { money, codeMode, print, viewImage, flash } = useStaff();
  const [busy, setBusy] = useState(false);
  const next = NEXT[o.status];
  const run = async (fn: () => Promise<Order | null>) => {
    setBusy(true);
    try { onChange(await fn()); } catch (e) { flash(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  };

  return (
    <article className={cn("rounded-2xl border border-border border-l-4 bg-background p-3.5 shadow-sm transition", TONE[o.status])}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TableBadge table={num(o.table)} />
          <span className="text-sm font-extrabold">{orderCode(o, codeMode)}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{fmtTime(o.createdAt)}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
        <span className="rounded-full bg-muted px-2 py-0.5">{STATUS_LABELS[o.status]}</span>
        {o.paid && <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-green-700 dark:text-green-400">{o.payMethod === "online" ? "Paid online" : "Paid"}</span>}
        {!o.paid && o.payStatus === "pending" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">Receipt pending</span>}
        {!o.paid && o.payStatus === "pos" && <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-blue-700 dark:text-blue-400">Card reader requested</span>}
        {o.payStatus === "rejected" && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Rejected</span>}
      </div>
      <ul className="mb-2 space-y-0.5 text-sm">
        {o.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>{it.name} <span className="text-muted-foreground">× {num(it.qty)}</span></span>
            <span className="shrink-0 text-muted-foreground">{money(it.price * it.qty)}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="mb-1.5 flex gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-xs"><StickyNote className="size-3.5 shrink-0 text-amber-600" /> Note: {o.note}</p>}
      {o.phone && <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3.5" /><span>{o.phone}</span></p>}
      {o.receipt && (
        <button onClick={() => viewImage(o.receipt)} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ImageIcon className="size-3.5" /> View payment receipt
          {o.receiptReused && <AlertTriangle className="size-3.5 text-amber-500" aria-label="This receipt image was already used for another table" />}
        </button>
      )}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">Total</span>
        <strong className="text-primary">{money(o.total)}</strong>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {next && <Button size="sm" className="h-8 flex-1 rounded-xl" disabled={busy} onClick={() => run(async () => unwrap(await staffSetStatusAction(o.id, next.to)))}>{next.label}</Button>}
        {!o.paid && o.status !== "cancelled" && (
          <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={busy} onClick={() => run(() => staffSetPaidAction(o.id, true))}><CreditCard className="size-3.5" /> Mark paid</Button>
        )}
        {isActive(o) && (
          <Button size="sm" variant="outline" className="h-8 rounded-xl text-primary" disabled={busy} onClick={() => { if (confirm(`Cancel order ${orderCode(o, codeMode)}?`)) run(async () => unwrap(await staffSetStatusAction(o.id, "cancelled"))); }}><Ban className="size-3.5" /> Cancel</Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={() => print("order=" + o.id)} title="Print bill"><Printer className="size-3.5" /> Print bill</Button>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">{fmtDateTime(o.createdAt)}</div>
    </article>
  );
}

/** Orders waiting for payment (not sent to the kitchen yet) */
function AwaitingPanel({ list, onChange, onCashier }: { list: Order[]; onChange: (o: Order | null) => void; onCashier: () => void }) {
  const { money, codeMode, flash } = useStaff();
  const [busy, setBusy] = useState("");
  const run = async (id: string, fn: () => Promise<Order | null>) => {
    setBusy(id);
    try { onChange(await fn()); } catch (e) { flash(e instanceof Error ? e.message : "Error"); } finally { setBusy(""); }
  };
  return (
    <Panel title="Awaiting payment" icon={<Hourglass className="size-5 text-amber-600" />} count={num(list.length)} className="border-amber-500/40 bg-amber-500/[0.04]">
      <p className="-mt-1 mb-3 text-xs text-muted-foreground">These orders go to the kitchen once payment is confirmed. Unpaid orders are cancelled automatically after 1 hour.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5"><TableBadge table={num(o.table)} /><span className="text-sm font-extrabold">{orderCode(o, codeMode)}</span></div>
              <span className="text-[11px] text-muted-foreground">{fmtTime(o.createdAt)}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{o.items.map((it) => `${it.name}×${num(it.qty)}`).join(", ")}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <strong className="text-primary">{money(o.total)}</strong>
              {o.payStatus === "pending" ? (
                <button onClick={onCashier} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">Receipt pending → Cashier</button>
              ) : o.payStatus === "pos" ? (
                <button onClick={onCashier} className="rounded-full bg-blue-600/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">Card reader requested → Cashier</button>
              ) : (
                <span className="text-[11px] text-muted-foreground">{o.payStatus === "rejected" ? "Rejected" : "Unpaid"}</span>
              )}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 flex-1 rounded-xl" disabled={busy === o.id} onClick={() => run(o.id, () => staffSetPaidAction(o.id, true))}><CreditCard className="size-3.5" /> Mark paid</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" disabled={busy === o.id} onClick={() => { if (confirm(`Cancel order ${orderCode(o, codeMode)}?`)) run(o.id, async () => unwrap(await staffSetStatusAction(o.id, "cancelled"))); }}><Ban className="size-3.5" /> Cancel</Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FeedbackPanel({ items }: { items: StaffFeedback[] }) {
  const avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0;
  return (
    <Panel title="Reviews" icon={<Star className="size-5 text-amber-500" />} count={num(items.length)} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      {items.length === 0 ? <Empty text="No reviews yet" /> : (
        <>
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
            <div className="text-3xl font-black text-amber-500">{num(avg.toFixed(1))}</div>
            <div><Stars n={Math.round(avg)} /><div className="mt-1 text-xs text-muted-foreground">Average of {num(items.length)} review{items.length === 1 ? "" : "s"}</div></div>
          </div>
          <div className="space-y-2">
            {items.map((f) => (
              <div key={f.id} className="rounded-2xl border border-border p-3">
                <div className="mb-1 flex items-center justify-between"><Stars n={f.rating} /><span className="text-[11px] text-muted-foreground">{f.table ? `Table ${num(f.table)} · ` : ""}{fmtTime(f.createdAt)}</span></div>
                {f.comment ? <p className="flex gap-1.5 text-sm"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{f.comment}</p> : <p className="text-sm text-muted-foreground">No comment</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("size-4", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />)}</div>;
}
