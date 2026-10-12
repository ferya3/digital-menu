"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Coffee, LogOut, Loader2, Check, X, Ban, ImageIcon,
  ClipboardList, BellRing, Star, Users, UtensilsCrossed, Settings as SettingsIcon,
  ReceiptText, Download, Phone, MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, money, toFa } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Order, OrderStatus } from "@/lib/types";
import {
  loginAction, logoutAction, staffOrdersAction, staffSetStatusAction,
  staffConfirmPayAction, staffRejectPayAction, staffRequestsAction, staffDoneRequestAction,
  staffFeedbackAction, staffCustomersAction,
  type AdminSettings,
} from "@/app/staff/actions";
import type { StaffCustomer, StaffFeedback, StaffRequest } from "@/lib/queries";
import { MenuManager } from "@/components/staff/menu-manager";
import { SettingsPanel } from "@/components/staff/settings-panel";

type Tab = "orders" | "requests" | "feedback" | "customers" | "menu" | "settings";

const STATUS_FA: Record<string, string> = {
  new: "در انتظار تأیید آشپزخانه", preparing: "در حال آماده‌سازی ☕", ready: "آماده است! ✅",
  served: "سرو شد", cancelled: "لغو شد",
};
const NEXT: Record<string, { to: OrderStatus; label: string }> = {
  new: { to: "preparing", label: "تأیید و آماده‌سازی" },
  preparing: { to: "ready", label: "آماده شد" },
  ready: { to: "served", label: "سرو شد" },
};
const timeFa = (iso: string) => {
  try {
    const d = new Date(iso);
    return toFa(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  } catch { return ""; }
};

export function StaffApp({ initialAuthed }: { initialAuthed: boolean }) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [feedback, setFeedback] = useState<StaffFeedback[]>([]);
  const [customers, setCustomers] = useState<StaffCustomer[]>([]);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2600); };

  const refreshOrders = useCallback(() => { staffOrdersAction().then(setOrders).catch(() => {}); }, []);
  const refreshRequests = useCallback(() => { staffRequestsAction().then(setRequests).catch(() => {}); }, []);

  useEffect(() => {
    if (!authed) return;
    refreshOrders();
    refreshRequests();
    staffFeedbackAction().then(setFeedback).catch(() => {});
    staffCustomersAction().then(setCustomers).catch(() => {});
    const t = setInterval(() => { refreshOrders(); refreshRequests(); }, 5000);
    return () => clearInterval(t);
  }, [authed, refreshOrders, refreshRequests]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true); setLoginErr("");
    try {
      await loginAction(pass);
      setAuthed(true); setPass("");
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "ورود ناموفق");
    } finally { setLoggingIn(false); }
  }

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "served" && o.status !== "cancelled").length, [orders]);
  const pendingPay = useMemo(() => orders.filter((o) => o.payStatus === "pending").length, [orders]);
  const pendingReq = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => {
      const act = (o: Order) => (o.status !== "served" && o.status !== "cancelled" ? 0 : 1);
      return act(a) - act(b) || b.number - a.number;
    }),
    [orders]
  );
  const sortedReq = useMemo(
    () => [...requests].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)),
    [requests]
  );

  async function setStatus(o: Order, status: OrderStatus) {
    const up = await staffSetStatusAction(o.id, status).catch(() => null);
    if (up) setOrders((l) => l.map((x) => (x.id === o.id ? up : x)));
  }
  async function confirmPay(o: Order) {
    const up = await staffConfirmPayAction(o.id).catch(() => null);
    if (up) { setOrders((l) => l.map((x) => (x.id === o.id ? up : x))); flash(`پرداخت میز ${toFa(o.table)} تأیید شد ✅`); }
  }
  async function doReject() {
    if (!rejectId) return;
    const up = await staffRejectPayAction(rejectId, rejectReason).catch(() => null);
    if (up) setOrders((l) => l.map((x) => (x.id === rejectId ? up : x)));
    setRejectId(null); setRejectReason(""); flash("فیش رد شد و از سفارش حذف شد");
  }
  async function doneRequest(r: StaffRequest) {
    await staffDoneRequestAction(r.id).catch(() => {});
    setRequests((l) => l.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)));
  }
  function exportCsv() {
    const rows = [["شماره موبایل", "میزها", "تعداد مراجعه", "اولین", "آخرین"]];
    customers.forEach((c) => rows.push([c.phone, c.tables.join("|"), String(c.visits), c.firstSeen, c.lastSeen]));
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- login ---------- */
  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <form onSubmit={doLogin} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Coffee className="size-5" /></span>
            <div><h1 className="text-lg font-extrabold">ورود کارکنان</h1><p className="text-[11px] text-muted-foreground">پنل مدیریت کافه</p></div>
          </div>
          <label className="mb-1 block text-sm text-muted-foreground">رمز عبور</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" placeholder="رمز عبور مدیر" />
          {loginErr && <p className="mb-3 text-sm text-primary">{loginErr}</p>}
          <Button type="submit" size="lg" className="w-full rounded-xl" disabled={loggingIn}>{loggingIn ? <Loader2 className="animate-spin" /> : "ورود"}</Button>
        </form>
      </div>
    );
  }

  /* ---------- dashboard ---------- */
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Coffee className="size-5" /></span>
            <div className="leading-tight"><h1 className="text-lg font-extrabold">پنل کارکنان</h1><p className="text-[11px] text-muted-foreground">زنده</p></div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="خروج" onClick={async () => { await logoutAction().catch(() => {}); setAuthed(false); }}><LogOut /></Button>
          </div>
        </div>
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="size-4" />} label="سفارش‌ها" badge={activeOrders} />
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} icon={<BellRing className="size-4" />} label="درخواست‌ها" badge={pendingReq} />
          <TabBtn active={tab === "feedback"} onClick={() => setTab("feedback")} icon={<Star className="size-4" />} label="نظرسنجی" badge={feedback.length} />
          <TabBtn active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="size-4" />} label="مشتری‌ها" />
          <TabBtn active={tab === "menu"} onClick={() => setTab("menu")} icon={<UtensilsCrossed className="size-4" />} label="مدیریت منو" />
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<SettingsIcon className="size-4" />} label="تنظیمات" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {tab === "orders" && (
          <>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <Stat label="سفارش فعال" value={activeOrders} />
              <Stat label="منتظر تأیید پرداخت" value={pendingPay} tone="amber" />
            </div>
            {sortedOrders.length === 0 ? <Empty text="هنوز سفارشی ثبت نشده." /> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedOrders.map((o) => (
                  <OrderCard key={o.id} o={o}
                    onNext={() => NEXT[o.status] && setStatus(o, NEXT[o.status].to)}
                    onCancel={() => setStatus(o, "cancelled")}
                    onConfirm={() => confirmPay(o)}
                    onReject={() => setRejectId(o.id)}
                    onReceipt={() => o.receipt && setViewReceipt(o.receipt)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "requests" && (
          sortedReq.length === 0 ? <Empty text="درخواستی وجود ندارد." /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedReq.map((r) => <RequestCard key={r.id} r={r} onDone={() => doneRequest(r)} />)}
            </div>
          )
        )}

        {tab === "feedback" && <FeedbackPanel items={feedback} />}
        {tab === "customers" && <CustomersPanel items={customers} onExport={exportCsv} />}
        {tab === "menu" && <MenuManager flash={flash} />}
        {tab === "settings" && <SettingsPanel flash={flash} />}
      </main>

      {viewReceipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setViewReceipt(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewReceipt} alt="رسید" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}
      {rejectId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setRejectId(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-extrabold">رد فیش پرداخت</h3>
            <p className="mb-3 text-xs text-muted-foreground">با رد کردن، عکس فیش از سفارش هم حذف می‌شود.</p>
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="دلیل (اختیاری)" className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRejectId(null)}>انصراف</Button>
              <Button className="flex-1 rounded-xl" onClick={doReject}>رد فیش</Button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed inset-x-0 top-4 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-foreground px-5 py-2 text-center text-sm font-semibold text-background shadow-lg">{toast}</div>}
    </div>
  );
}

/* ---------- pieces ---------- */
function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={cn("relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition", active ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:text-foreground")}>
      {icon}{label}
      {!!badge && badge > 0 && <span className={cn("grid size-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold", active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>{toFa(badge)}</span>}
    </button>
  );
}
function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return <span className={cn("rounded-full border px-3 py-1 font-semibold", tone === "amber" ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border bg-muted text-muted-foreground")}>{label}: {toFa(value)}</span>;
}
function Empty({ text }: { text: string }) { return <p className="py-20 text-center text-muted-foreground">{text}</p>; }

function statusTone(s: string) {
  if (s === "ready") return "bg-green-600/15 text-green-600 dark:text-green-400";
  if (s === "preparing") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (s === "cancelled") return "bg-primary/10 text-primary";
  if (s === "served") return "bg-muted text-muted-foreground";
  return "bg-muted text-foreground";
}
function OrderCard({ o, onNext, onCancel, onConfirm, onReject, onReceipt }: {
  o: Order; onNext: () => void; onCancel: () => void; onConfirm: () => void; onReject: () => void; onReceipt: () => void;
}) {
  const dim = o.status === "served" || o.status === "cancelled";
  const next = NEXT[o.status];
  return (
    <article className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", dim && "opacity-60")}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="text-base font-extrabold">#{toFa(o.number)}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">میز {toFa(o.table)}</span></div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", statusTone(o.status))}>{STATUS_FA[o.status]}</span>
      </div>
      <ul className="mb-2 space-y-0.5 text-sm">
        {o.items.map((it, i) => (<li key={i} className="flex justify-between"><span className="text-foreground">{it.name} <span className="text-muted-foreground">× {toFa(it.qty)}</span></span><span className="text-muted-foreground">{money(it.price * it.qty)}</span></li>))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-2"><span className="text-[11px] text-muted-foreground">{timeFa(o.createdAt)}</span><span className="text-base font-extrabold text-primary">{money(o.total)}</span></div>
      {o.status !== "cancelled" && o.status !== "served" && (
        <div className="mt-3 flex gap-2">
          {next && <Button className="h-9 flex-1 rounded-xl text-sm" onClick={onNext}>{next.label}</Button>}
          <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={onCancel} aria-label="لغو"><Ban className="size-4" /></Button>
        </div>
      )}
      {o.payStatus === "pending" && (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="mb-2 text-xs font-bold text-amber-600 dark:text-amber-400">فیش پرداخت رسید</div>
          <div className="flex gap-2">
            <button onClick={onReceipt} className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-background" aria-label="دیدن فیش"><ImageIcon className="size-4" /></button>
            <Button className="h-9 flex-1 rounded-xl bg-green-600 text-sm text-white hover:bg-green-600/90" onClick={onConfirm}><Check className="size-4" /> تأیید</Button>
            <Button variant="outline" className="h-9 rounded-xl text-sm" onClick={onReject}><X className="size-4" /> رد</Button>
          </div>
        </div>
      )}
      {o.payStatus === "confirmed" && <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-600/10 px-3 py-2 text-sm font-semibold text-green-600 dark:text-green-400"><ReceiptText className="size-4" /> پرداخت تأیید شده</div>}
      {o.payStatus === "rejected" && <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">فیش رد شد{o.rejectedReason ? `: ${o.rejectedReason}` : ""}</div>}
    </article>
  );
}
function RequestCard({ r, onDone }: { r: StaffRequest; onDone: () => void }) {
  const done = r.status === "done";
  const invoice = r.type === "invoice";
  return (
    <article className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", done && "opacity-55")}>
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold", invoice ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
          {invoice ? <ReceiptText className="size-3.5" /> : <BellRing className="size-3.5" />}{invoice ? "درخواست فاکتور" : "صدا زدن گارسون"}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">میز {toFa(r.table)}</span>
      </div>
      {invoice && r.amount > 0 && <p className="text-sm">مبلغ صورتحساب: <span className="font-extrabold text-primary">{money(r.amount)}</span> <span className="text-muted-foreground">({toFa(r.orderCount)} سفارش)</span></p>}
      {r.note && <p className="mt-1 text-sm text-muted-foreground">یادداشت: {r.note}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{timeFa(r.createdAt)}</span>
        {done ? <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400"><Check className="size-4" /> انجام شد</span> : <Button className="h-9 rounded-xl text-sm" onClick={onDone}>انجام شد</Button>}
      </div>
    </article>
  );
}
function FeedbackPanel({ items }: { items: StaffFeedback[] }) {
  const avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0;
  if (items.length === 0) return <Empty text="هنوز نظری ثبت نشده." />;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="text-3xl font-black text-amber-500">{toFa(avg.toFixed(1))}</div>
        <div><Stars n={Math.round(avg)} /><div className="mt-1 text-xs text-muted-foreground">میانگین از {toFa(items.length)} نظر</div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <div key={f.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between"><Stars n={f.rating} />{f.table && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">میز {toFa(f.table)}</span>}</div>
            {f.comment ? <p className="flex gap-1.5 text-sm"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{f.comment}</p> : <p className="text-sm text-muted-foreground">بدون توضیح</p>}
            <div className="mt-2 text-[11px] text-muted-foreground">{timeFa(f.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn("size-4", i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />)}</div>;
}
function CustomersPanel({ items, onExport }: { items: StaffCustomer[]; onExport: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />{toFa(items.length)} مشتری</span>
        {items.length > 0 && <Button variant="outline" className="rounded-xl" onClick={onExport}><Download className="size-4" /> خروجی CSV</Button>}
      </div>
      {items.length === 0 ? <Empty text="هنوز شماره‌ای ثبت نشده." /> : (
        <div className="grid gap-2">
          {items.map((c) => (
            <div key={c.phone} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"><Phone className="size-4" /></span>
              <div className="min-w-0 flex-1"><div className="font-bold" dir="ltr">{toFa(c.phone)}</div><div className="text-xs text-muted-foreground">{toFa(c.visits)} مراجعه{c.tables.length ? ` · میز ${c.tables.map((t) => toFa(t)).join("، ")}` : ""}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
