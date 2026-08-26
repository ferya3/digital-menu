import { useEffect, useMemo, useRef, useState } from "react";
import {
  Moon,
  Sun,
  LogOut,
  Loader2,
  Check,
  X,
  Coffee,
  ClipboardList,
  BellRing,
  ReceiptText,
  ImageIcon,
  Ban,
  AlertTriangle,
  UtensilsCrossed,
  Settings as SettingsIcon,
  Users,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API } from "@/api";
import {
  me,
  login,
  logout,
  fetchOrders,
  patchOrder,
  fetchRequests,
  patchRequest,
  fetchFeedback,
  fetchSettings,
  type CafeRequest,
  type Feedback,
} from "@/api";
import { connectStaff, STATUS_FA, type ServerOrder } from "@/socket";
import ManageMenu from "@/ManageMenu";
import StaffSettings from "@/StaffSettings";
import StaffCustomers from "@/StaffCustomers";
import StaffFeedback from "@/StaffFeedback";

/* ---------- helpers ---------- */
const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) => String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
const money = (n: number) => toFa(n.toLocaleString("en-US")) + " تومان";
const timeFa = (iso: string) => {
  try {
    const d = new Date(iso);
    return toFa(String(d.getHours()).padStart(2, "0")) + ":" + toFa(String(d.getMinutes()).padStart(2, "0"));
  } catch {
    return "";
  }
};

const NEXT: Record<string, { to: ServerOrder["status"]; label: string }> = {
  new: { to: "preparing", label: "تأیید و آماده‌سازی" },
  preparing: { to: "ready", label: "آماده شد" },
  ready: { to: "served", label: "سرو شد" },
};

const imgSrc = (p: string) => (!p ? "" : /^https?:|^data:/.test(p) ? p : API + p);

export default function StaffApp() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<
    "orders" | "requests" | "feedback" | "customers" | "manage" | "settings"
  >("orders");
  const [orders, setOrders] = useState<ServerOrder[]>([]);
  const [requests, setRequests] = useState<CafeRequest[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [cafeName, setCafeName] = useState("");
  const [toast, setToast] = useState("");
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
  };

  const toggleDark = () =>
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("cafe_theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });

  // auth check
  useEffect(() => {
    me().then(setAuthed);
    fetchSettings().then((s) => setCafeName(s.cafe?.name || "")).catch(() => {});
  }, []);

  // load data + live subscription (once authed)
  useEffect(() => {
    if (!authed) return;
    fetchOrders().then(setOrders).catch(() => {});
    fetchRequests().then(setRequests).catch(() => {});
    fetchFeedback().then(setFeedback).catch(() => {});

    const socket = connectStaff({
      onFeedback: (f) => {
        const fb = f as Feedback;
        setFeedback((l) => (l.some((x) => x.id === fb.id) ? l : [fb, ...l]));
        flash(`نظر جدید ثبت شد ⭐ (${fb.rating}/۵)`);
      },
      onOrder: (o) => {
        setOrders((list) => {
          const exists = list.some((x) => x.id === o.id);
          if (!exists) flash(`سفارش جدید #${toFa(o.number)} — میز ${toFa(o.table)}`);
          const next = exists ? list.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [o, ...list];
          return next;
        });
      },
      onRequest: (r) => {
        const req = r as CafeRequest;
        setRequests((list) => {
          const exists = list.some((x) => x.id === req.id);
          if (!exists)
            flash(req.type === "waiter" ? `درخواست گارسون — میز ${toFa(req.table)}` : `درخواست فاکتور — میز ${toFa(req.table)}`);
          return exists ? list.map((x) => (x.id === req.id ? { ...x, ...req } : x)) : [req, ...list];
        });
      },
    });
    return () => {
      socket.disconnect();
    };
  }, [authed]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginErr("");
    try {
      await login(pass);
      setAuthed(true);
      setPass("");
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "ورود ناموفق");
    } finally {
      setLoggingIn(false);
    }
  }

  async function setStatus(o: ServerOrder, status: ServerOrder["status"]) {
    try {
      const up = await patchOrder(o.id, { status });
      setOrders((l) => l.map((x) => (x.id === o.id ? { ...x, ...up } : x)));
    } catch (err) {
      flash(err instanceof Error ? err.message : "خطا");
    }
  }

  async function confirmPay(o: ServerOrder) {
    try {
      const up = await patchOrder(o.id, { payStatus: "confirmed" });
      setOrders((l) => l.map((x) => (x.id === o.id ? { ...x, ...up } : x)));
      flash(`پرداخت میز ${toFa(o.table)} تأیید شد ✅`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "خطا");
    }
  }

  async function doReject() {
    if (!rejectId) return;
    try {
      const up = await patchOrder(rejectId, { payStatus: "rejected", reason: rejectReason });
      setOrders((l) => l.map((x) => (x.id === rejectId ? { ...x, ...up } : x)));
      flash("فیش رد شد و از سفارش حذف شد");
    } catch (err) {
      flash(err instanceof Error ? err.message : "خطا");
    } finally {
      setRejectId(null);
      setRejectReason("");
    }
  }

  async function markDone(r: CafeRequest) {
    try {
      const up = await patchRequest(r.id);
      setRequests((l) => l.map((x) => (x.id === r.id ? { ...x, ...up } : x)));
    } catch (err) {
      flash(err instanceof Error ? err.message : "خطا");
    }
  }

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "served" && o.status !== "cancelled").length,
    [orders]
  );
  const pendingPay = useMemo(() => orders.filter((o) => o.payStatus === "pending").length, [orders]);
  const pendingReq = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const act = (o: ServerOrder) => (o.status !== "served" && o.status !== "cancelled" ? 0 : 1);
        return act(a) - act(b) || b.number - a.number;
      }),
    [orders]
  );
  const sortedReq = useMemo(
    () => [...requests].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || (a.createdAt < b.createdAt ? 1 : -1)),
    [requests]
  );

  /* ---------- login gate ---------- */
  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }
  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <form onSubmit={doLogin} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-extrabold">ورود کارکنان</h1>
              <p className="text-[11px] text-muted-foreground">پنل مدیریت کافه آرتاویل</p>
            </div>
          </div>
          <label className="mb-1 block text-sm text-muted-foreground">رمز عبور</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoFocus
            className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            placeholder="رمز عبور مدیر"
          />
          {loginErr && <p className="mb-3 text-sm text-primary">{loginErr}</p>}
          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={loggingIn}>
            {loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : "ورود"}
          </Button>
        </form>
      </div>
    );
  }

  /* ---------- dashboard ---------- */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-extrabold">پنل کارکنان</h1>
              <p className="text-[11px] text-muted-foreground">{cafeName ? cafeName + " · " : ""}زنده</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="حالت شب">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="خروج"
              onClick={async () => {
                await logout().catch(() => {});
                setAuthed(false);
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* tabs */}
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={<ClipboardList className="h-4 w-4" />} label="سفارش‌ها" badge={activeOrders} />
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")} icon={<BellRing className="h-4 w-4" />} label="درخواست‌ها" badge={pendingReq} />
          <TabBtn active={tab === "feedback"} onClick={() => setTab("feedback")} icon={<Star className="h-4 w-4" />} label="نظرسنجی" badge={feedback.length} />
          <TabBtn active={tab === "customers"} onClick={() => setTab("customers")} icon={<Users className="h-4 w-4" />} label="مشتری‌ها" />
          <TabBtn active={tab === "manage"} onClick={() => setTab("manage")} icon={<UtensilsCrossed className="h-4 w-4" />} label="مدیریت منو" />
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<SettingsIcon className="h-4 w-4" />} label="تنظیمات" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {tab === "orders" && (
          <>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <Stat label="سفارش فعال" value={activeOrders} />
              <Stat label="منتظر تأیید پرداخت" value={pendingPay} tone="amber" />
            </div>
            {sortedOrders.length === 0 ? (
              <Empty text="هنوز سفارشی ثبت نشده." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    onNext={() => NEXT[o.status] && setStatus(o, NEXT[o.status].to)}
                    onCancel={() => setStatus(o, "cancelled")}
                    onConfirmPay={() => confirmPay(o)}
                    onReject={() => setRejectId(o.id)}
                    onViewReceipt={() => o.receipt && setViewReceipt(imgSrc(o.receipt))}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            {sortedReq.length === 0 ? (
              <Empty text="درخواستی وجود ندارد." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedReq.map((r) => (
                  <RequestCard key={r.id} r={r} onDone={() => markDone(r)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "feedback" && <StaffFeedback items={feedback} />}
        {tab === "customers" && <StaffCustomers />}
        {tab === "manage" && <ManageMenu flash={flash} />}
        {tab === "settings" && <StaffSettings flash={flash} />}
      </main>

      {/* receipt lightbox */}
      {viewReceipt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setViewReceipt(null)}>
          <img src={viewReceipt} alt="رسید پرداخت" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}

      {/* reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setRejectId(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-extrabold">رد فیش پرداخت</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              با رد کردن، عکس فیش از سفارش هم حذف می‌شود و به مشتری اطلاع داده می‌شود.
            </p>
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="دلیل (اختیاری): مثلاً مبلغ نادرست"
              className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRejectId(null)}>
                انصراف
              </Button>
              <Button className="flex-1 rounded-xl" onClick={doReject}>
                رد فیش
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 top-4 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-foreground px-5 py-2 text-center text-sm font-semibold text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */
function TabBtn({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition",
        active ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-secondary-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
      {!!badge && badge > 0 && (
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold",
            active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
          )}
        >
          {toFa(badge)}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 font-semibold",
        tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border bg-secondary text-secondary-foreground"
      )}
    >
      {label}: {toFa(value)}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-20 text-center text-muted-foreground">{text}</p>;
}

function statusTone(s: ServerOrder["status"]) {
  if (s === "ready") return "bg-green-600/15 text-green-600 dark:text-green-400";
  if (s === "preparing") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (s === "cancelled") return "bg-primary/10 text-primary";
  if (s === "served") return "bg-secondary text-muted-foreground";
  return "bg-secondary text-secondary-foreground";
}

function OrderCard({
  o,
  onNext,
  onCancel,
  onConfirmPay,
  onReject,
  onViewReceipt,
}: {
  o: ServerOrder;
  onNext: () => void;
  onCancel: () => void;
  onConfirmPay: () => void;
  onReject: () => void;
  onViewReceipt: () => void;
}) {
  const dim = o.status === "served" || o.status === "cancelled";
  const next = NEXT[o.status];
  return (
    <article className={cn("rounded-3xl border border-border bg-card p-4 shadow-sm", dim && "opacity-60")}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold">#{toFa(o.number)}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">میز {toFa(o.table)}</span>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", statusTone(o.status))}>
          {STATUS_FA[o.status]}
        </span>
      </div>

      <ul className="mb-2 space-y-0.5 text-sm">
        {o.items.map((it, i) => (
          <li key={i} className="flex justify-between text-muted-foreground">
            <span className="text-foreground">
              {it.name} <span className="text-muted-foreground">× {toFa(it.qty)}</span>
            </span>
            <span>{money(it.price * it.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-[11px] text-muted-foreground">{timeFa(o.createdAt)}</span>
        <span className="text-base font-extrabold text-primary">{money(o.total)}</span>
      </div>

      {/* kitchen controls */}
      {o.status !== "cancelled" && o.status !== "served" && (
        <div className="mt-3 flex gap-2">
          {next && (
            <Button className="h-9 flex-1 rounded-xl text-sm" onClick={onNext}>
              {next.label}
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={onCancel} aria-label="لغو">
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* payment / cashier */}
      {o.payStatus === "pending" && (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">فیش پرداخت رسید</span>
            {o.receiptReused && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                <AlertTriangle className="h-3 w-3" /> احتمال تکراری
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onViewReceipt}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background"
              aria-label="دیدن فیش"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <Button className="h-9 flex-1 rounded-xl bg-green-600 text-sm text-white hover:bg-green-600/90" onClick={onConfirmPay}>
              <Check className="h-4 w-4" /> تأیید پرداخت
            </Button>
            <Button variant="outline" className="h-9 rounded-xl text-sm" onClick={onReject}>
              <X className="h-4 w-4" /> رد
            </Button>
          </div>
        </div>
      )}
      {o.payStatus === "confirmed" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-600/10 px-3 py-2 text-sm font-semibold text-green-600 dark:text-green-400">
          <ReceiptText className="h-4 w-4" /> پرداخت تأیید شده
        </div>
      )}
      {o.payStatus === "rejected" && (
        <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          فیش رد شد{o.rejectedReason ? `: ${o.rejectedReason}` : ""}
        </div>
      )}
    </article>
  );
}

function RequestCard({ r, onDone }: { r: CafeRequest; onDone: () => void }) {
  const done = r.status === "done";
  const invoice = r.type === "invoice";
  return (
    <article className={cn("rounded-3xl border border-border bg-card p-4 shadow-sm", done && "opacity-55")}>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
            invoice ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          )}
        >
          {invoice ? <ReceiptText className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
          {invoice ? "درخواست فاکتور" : "صدا زدن گارسون"}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">میز {toFa(r.table)}</span>
      </div>

      {invoice && r.amount != null && (
        <p className="text-sm">
          مبلغ صورتحساب: <span className="font-extrabold text-primary">{money(r.amount)}</span>
          {r.orderCount ? <span className="text-muted-foreground"> ({toFa(r.orderCount)} سفارش)</span> : null}
        </p>
      )}
      {r.note && <p className="mt-1 text-sm text-muted-foreground">یادداشت: {r.note}</p>}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{timeFa(r.createdAt)}</span>
        {done ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" /> انجام شد
          </span>
        ) : (
          <Button className="h-9 rounded-xl text-sm" onClick={onDone}>
            انجام شد
          </Button>
        )}
      </div>
    </article>
  );
}
