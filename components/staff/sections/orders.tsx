"use client";

import { useMemo, useState } from "react";
import { Ban, CreditCard, Printer, Phone, StickyNote, ImageIcon, Star, MessageSquareText, ClipboardList, AlertTriangle, Hourglass, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, faTime, orderCode, toFa } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import type { StaffFeedback } from "@/lib/queries";
import { staffSetPaidAction, staffSetStatusAction } from "@/app/staff/actions";
import { Empty, Panel, TableBadge, useStaff } from "@/components/staff/kit";
import { unwrap } from "@/lib/action-result";

const STATUS_FA: Record<OrderStatus, string> = {
  new: "جدید", preparing: "در حال آماده‌سازی", ready: "آماده", served: "سرو شد", cancelled: "لغو شد",
};
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: "preparing", label: "شروع آماده‌سازی" },
  preparing: { to: "ready", label: "آماده شد" },
  ready: { to: "served", label: "سرو شد" },
};
const TONE: Record<OrderStatus, string> = {
  new: "border-r-primary",
  preparing: "border-r-amber-500",
  ready: "border-r-green-600",
  served: "border-r-border opacity-70",
  cancelled: "border-r-border opacity-50",
};
const isActive = (o: Order) => o.status !== "served" && o.status !== "cancelled";

type Filter = "active" | "done" | "all";

export function OrdersSection({ orders, feedback, onChange, payFirst, onCashier }: {
  orders: Order[]; feedback: StaffFeedback[]; onChange: (o: Order | null) => void; payFirst: boolean; onCashier: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  // اول پرداخت: سفارشِ پرداخت‌نشده هنوز مالِ آشپزخانه نیست
  // (سفارشی که قبلاً واردِ آشپزخانه شده، همان‌جا می‌ماند)
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
        title={payFirst ? "سفارش‌های آشپزخانه (پرداخت‌شده)" : "سفارش‌ها"}
        icon={payFirst ? <ChefHat className="size-5 text-primary" /> : <ClipboardList className="size-5 text-primary" />}
        count={toFa(active)}
        action={
          <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
            {([["active", "فعال"], ["done", "سرو/لغو"], ["all", "همه"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFilter(id)} className={cn("rounded-full px-3 py-1 transition", filter === id ? "bg-card shadow" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
        }
      >
        {list.length === 0 ? (
          <Empty text={filter === "active" ? "سفارش فعالی نیست" : "سفارشی ثبت نشده است"} />
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
    try { onChange(await fn()); } catch (e) { flash(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  };

  return (
    <article className={cn("rounded-2xl border border-border border-r-4 bg-background p-3.5 shadow-sm transition", TONE[o.status])}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TableBadge table={toFa(o.table)} />
          <span className="text-sm font-extrabold" dir="ltr">{orderCode(o, codeMode)}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{faTime(o.createdAt)}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
        <span className="rounded-full bg-muted px-2 py-0.5">{STATUS_FA[o.status]}</span>
        {o.paid && <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-green-700 dark:text-green-400">پرداخت‌شده</span>}
        {!o.paid && o.payStatus === "pending" && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">فیش در انتظار تأیید</span>}
        {!o.paid && o.payStatus === "pos" && <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-blue-700 dark:text-blue-400">کارت‌خوان سر میز</span>}
        {o.payStatus === "rejected" && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">فیش رد شد</span>}
      </div>
      <ul className="mb-2 space-y-0.5 text-sm">
        {o.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>{it.name} <span className="text-muted-foreground">× {toFa(it.qty)}</span></span>
            <span className="shrink-0 text-muted-foreground">{money(it.price * it.qty)}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="mb-1.5 flex gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-xs"><StickyNote className="size-3.5 shrink-0 text-amber-600" /> یادداشت: {o.note}</p>}
      {o.phone && <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3.5" /><span dir="ltr">{toFa(o.phone)}</span></p>}
      {o.receipt && (
        <button onClick={() => viewImage(o.receipt)} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ImageIcon className="size-3.5" /> مشاهدهٔ فیش پرداخت
          {o.receiptReused && <AlertTriangle className="size-3.5 text-amber-500" />}
        </button>
      )}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs text-muted-foreground">جمع</span>
        <strong className="text-primary">{money(o.total)}</strong>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {next && <Button size="sm" className="h-8 flex-1 rounded-xl" disabled={busy} onClick={() => run(async () => unwrap(await staffSetStatusAction(o.id, next.to)))}>{next.label}</Button>}
        {!o.paid && o.status !== "cancelled" && (
          <Button size="sm" variant="outline" className="h-8 rounded-xl" disabled={busy} onClick={() => run(() => staffSetPaidAction(o.id, true))}><CreditCard className="size-3.5" /> پرداخت شد</Button>
        )}
        {isActive(o) && (
          <Button size="sm" variant="outline" className="h-8 rounded-xl text-primary" disabled={busy} onClick={() => { if (confirm(`لغو سفارش ${orderCode(o, codeMode)}؟`)) run(async () => unwrap(await staffSetStatusAction(o.id, "cancelled"))); }}><Ban className="size-3.5" /> لغو</Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 rounded-xl" onClick={() => print("order=" + o.id)} title="چاپ فاکتور"><Printer className="size-3.5" /> چاپ فاکتور</Button>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">{faDateTime(o.createdAt)}</div>
    </article>
  );
}

/** سفارش‌هایی که منتظر پرداخت‌اند (هنوز به آشپزخانه نرفته‌اند) */
function AwaitingPanel({ list, onChange, onCashier }: { list: Order[]; onChange: (o: Order | null) => void; onCashier: () => void }) {
  const { money, codeMode, flash } = useStaff();
  const [busy, setBusy] = useState("");
  const run = async (id: string, fn: () => Promise<Order | null>) => {
    setBusy(id);
    try { onChange(await fn()); } catch (e) { flash(e instanceof Error ? e.message : "خطا"); } finally { setBusy(""); }
  };
  return (
    <Panel title="در انتظار پرداخت" icon={<Hourglass className="size-5 text-amber-600" />} count={toFa(list.length)} className="border-amber-500/40 bg-amber-500/[0.04]">
      <p className="-mt-1 mb-3 text-xs text-muted-foreground">این سفارش‌ها تا تأیید پرداخت به آشپزخانه نمی‌روند. سفارشِ پرداخت‌نشده بعد از ۱ ساعت خودکار لغو می‌شود.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5"><TableBadge table={toFa(o.table)} /><span className="text-sm font-extrabold" dir="ltr">{orderCode(o, codeMode)}</span></div>
              <span className="text-[11px] text-muted-foreground">{faTime(o.createdAt)}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{o.items.map((it) => `${it.name}×${toFa(it.qty)}`).join("، ")}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <strong className="text-primary">{money(o.total)}</strong>
              {o.payStatus === "pending" ? (
                <button onClick={onCashier} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">فیش رسیده ← صندوق</button>
              ) : o.payStatus === "pos" ? (
                <button onClick={onCashier} className="rounded-full bg-blue-600/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">کارت‌خوان خواسته ← صندوق</button>
              ) : (
                <span className="text-[11px] text-muted-foreground">{o.payStatus === "rejected" ? "فیش رد شد" : "هنوز پرداخت نشده"}</span>
              )}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 flex-1 rounded-xl" disabled={busy === o.id} onClick={() => run(o.id, () => staffSetPaidAction(o.id, true))}><CreditCard className="size-3.5" /> پرداخت شد</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" disabled={busy === o.id} onClick={() => { if (confirm(`لغو سفارش ${orderCode(o, codeMode)}؟`)) run(o.id, async () => unwrap(await staffSetStatusAction(o.id, "cancelled"))); }}><Ban className="size-3.5" /> لغو</Button>
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
    <Panel title="نظرها" icon={<Star className="size-5 text-amber-500" />} count={toFa(items.length)} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      {items.length === 0 ? <Empty text="نظری ثبت نشده است" /> : (
        <>
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
            <div className="text-3xl font-black text-amber-500">{toFa(avg.toFixed(1))}</div>
            <div><Stars n={Math.round(avg)} /><div className="mt-1 text-xs text-muted-foreground">میانگین از {toFa(items.length)} نظر</div></div>
          </div>
          <div className="space-y-2">
            {items.map((f) => (
              <div key={f.id} className="rounded-2xl border border-border p-3">
                <div className="mb-1 flex items-center justify-between"><Stars n={f.rating} /><span className="text-[11px] text-muted-foreground">{f.table ? `میز ${toFa(f.table)} · ` : ""}{faTime(f.createdAt)}</span></div>
                {f.comment ? <p className="flex gap-1.5 text-sm"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{f.comment}</p> : <p className="text-sm text-muted-foreground">بدون توضیح</p>}
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
