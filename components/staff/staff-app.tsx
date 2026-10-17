"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Coffee, LogOut, Loader2, ClipboardList, BellRing, LayoutGrid, CreditCard, Users,
  Settings as SettingsIcon, QrCode, Calculator, ExternalLink, Menu as MenuIcon, X, Volume2, VolumeX, Lock, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney, toFa } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Order, OrderCodeMode } from "@/lib/types";
import {
  loginAction, logoutAction, staffChangePasswordAction, staffCustomersAction, staffSettingsAction,
} from "@/app/staff/actions";
import type { StaffCustomer, StaffFeedback, StaffRequest } from "@/lib/queries";
import { Ctx, inputCls, isImgSrc, type StaffCtx } from "@/components/staff/kit";
import { OrdersSection } from "@/components/staff/sections/orders";
import { RequestsSection } from "@/components/staff/sections/requests";
import { CashierSection } from "@/components/staff/sections/cashier";
import { CustomersSection } from "@/components/staff/sections/customers";
import { QrSection } from "@/components/staff/sections/qr";
import { AccountingSection } from "@/components/staff/sections/accounting";
import { BillingSection } from "@/components/staff/sections/billing";
import { MenuManager } from "@/components/staff/menu-manager";
import { SettingsPanel } from "@/components/staff/settings-panel";
import { unwrap } from "@/lib/action-result";

type Section = "orders" | "requests" | "products" | "cashier" | "accounting" | "customers" | "settings" | "qr" | "billing";

// همان ترتیبِ منوی کناریِ پنل قبلی
const NAV: { id: Section; label: string; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "orders", label: "سفارش‌ها", title: "سفارش‌ها", icon: ClipboardList },
  { id: "requests", label: "درخواست‌ها", title: "درخواست گارسون و صورتحساب", icon: BellRing },
  { id: "products", label: "محصولات", title: "مدیریت محصولات", icon: LayoutGrid },
  { id: "cashier", label: "صندوق", title: "صندوق و تأیید پرداخت‌ها", icon: CreditCard },
  { id: "accounting", label: "حسابداری", title: "حسابداری — درآمد روزانه و ماهانه", icon: Calculator },
  { id: "customers", label: "مشتری‌ها", title: "بانک شمارهٔ مشتری‌ها", icon: Users },
  { id: "settings", label: "تنظیمات", title: "تنظیمات", icon: SettingsIcon },
  { id: "qr", label: "کدهای QR", title: "کدهای QR میزها", icon: QrCode },
];

export interface SubscriptionInfo {
  state: "trial" | "active" | "expired" | "suspended";
  active: boolean;
  daysLeft: number;
  expiresAt: string;
  slug: string;
}

export function StaffApp({ initialAuthed, subscription = null }: { initialAuthed: boolean; subscription?: SubscriptionInfo | null }) {
  const [authed, setAuthed] = useState(initialAuthed);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} subscription={subscription} />;
}

/* ===================== ورود ===================== */
function Login({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  // رمزِ نصب ضعیف/پیش‌فرض است ← قبل از بازشدنِ پنل باید عوض شود
  const [mustChange, setMustChange] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      if (mustChange) {
        if (pass !== pass2) throw new Error("دو رمز یکسان نیستند");
        unwrap(await staffChangePasswordAction(pass));
        onDone();
      } else {
        const r = unwrap(await loginAction(pass));
        if (r.mustChange) { setMustChange(true); setPass(""); } else onDone();
      }
    }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : "ورود ناموفق"); }
    finally { setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
        <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Lock className="size-6" /></span>
        <h1 className="text-xl font-extrabold">{mustChange ? "رمزِ جدید انتخاب کنید" : "ورود مدیریت"}</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          {mustChange ? "رمزِ فعلی ساده یا پیش‌فرض است. برای امنیت، یک رمزِ حداقل ۸ نویسه‌ای بگذارید." : "برای دسترسی به داشبورد، رمز عبور را وارد کنید"}
        </p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete={mustChange ? "new-password" : "current-password"} className={cn(inputCls, "mb-3 py-2.5 text-center")} placeholder={mustChange ? "رمزِ جدید" : "رمز عبور"} />
        {mustChange && <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" className={cn(inputCls, "mb-3 py-2.5 text-center")} placeholder="تکرارِ رمزِ جدید" />}
        {err && <p className="mb-3 text-sm text-primary">{err}</p>}
        <Button type="submit" size="lg" className="w-full rounded-xl" disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> لطفاً صبر کنید…</> : mustChange ? "ذخیره و ورود" : "ورود"}</Button>
      </form>
    </div>
  );
}

/* ===================== داشبورد ===================== */
function Dashboard({ onLogout, subscription }: { onLogout: () => void; subscription: SubscriptionInfo | null }) {
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;
  // اشتراکِ تمام‌شده: پنل مستقیم روی «اشتراک» باز می‌شود
  const [section, setSection] = useState<Section>(subscription && !subscription.active ? "billing" : "orders");
  const nav = useMemo(() => (subscription ? [...NAV, { id: "billing" as Section, label: "اشتراک", title: "اشتراک و تمدید", icon: Crown }] : NAV), [subscription]);
  const [sideOpen, setSideOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [feedback, setFeedback] = useState<StaffFeedback[]>([]);
  const [customers, setCustomers] = useState<StaffCustomer[]>([]);
  const [cafe, setCafe] = useState({ name: "داشبورد مدیر", logo: "☕" });
  const [currency, setCurrency] = useState<"toman" | "rial">("toman");
  const [codeMode, setCodeMode] = useState<OrderCodeMode>("number");
  const [payFirst, setPayFirst] = useState(true);
  const payFirstRef = useRef(payFirst);
  payFirstRef.current = payFirst;
  const [sound, setSound] = useState(true);
  const [live, setLive] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ title: string; hint?: string; resolve: (v: string | null) => void } | null>(null);
  const [askText, setAskText] = useState("");

  const flash = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  // پیام‌های برگشت از درگاه/ثبت‌نام (?billing=ok …)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const b = sp.get("billing");
    const msg = sp.get("welcome") ? "🎉 خوش آمدید! منوی نمونه آماده است؛ از «محصولات» و «تنظیمات» شخصی‌سازی کنید"
      : sp.get("enter") ? "لینکِ ورود منقضی شده؛ با رمزِ پنل وارد شوید"
      : b === "ok" ? "✅ پرداخت موفق بود و اشتراک تمدید شد"
      : b === "cancel" ? "پرداخت لغو شد"
      : b ? "❌ پرداخت تأیید نشد؛ اگر مبلغ کم شده، تا ۷۲ ساعت به حساب‌تان برمی‌گردد" : "";
    if (!msg) return;
    if (b) setSection("billing");
    flash(msg);
    window.history.replaceState(null, "", "/staff");
    if (b === "ok") window.setTimeout(() => window.location.reload(), 1800);
  }, [flash]);

  /* ---- صدای اعلان (مثل پنل قبلی: بوقِ کوتاه) ---- */
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    try { const s = localStorage.getItem("staff_sound"); if (s === "0") setSound(false); } catch {}
    const unlock = () => {
      try {
        audio.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (audio.current.state === "suspended") audio.current.resume();
      } catch {}
    };
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);
  useEffect(() => {
    soundRef.current = sound;
    try { localStorage.setItem("staff_sound", sound ? "1" : "0"); } catch {}
  }, [sound]);
  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!soundRef.current || !ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);
  const titleTimer = useRef<number | undefined>(undefined);
  const flashTitle = useCallback((msg: string) => {
    document.title = "🔴 " + msg;
    window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => (document.title = "داشبورد مدیر"), 6000);
  }, []);

  /* ---- دریافتِ زنده (هر ۴ ثانیه) + تشخیص رویدادهای جدید ---- */
  const seen = useRef<{ ready: boolean; orders: Set<string>; requests: Set<string>; feedback: Set<string>; pending: Set<string>; paid: Set<string> }>({
    ready: false, orders: new Set(), requests: new Set(), feedback: new Set(), pending: new Set(), paid: new Set(),
  });
  const notify = useCallback((msg: string, short: string) => { beep(); flashTitle(short); flash(msg); }, [beep, flashTitle, flash]);

  const poll = useCallback(async () => {
    // یک درخواستِ معمولی (نه Server Action) تا پشتِ صفِ اکشن‌ها نماند
    let snap: { orders: Order[]; requests: StaffRequest[]; feedback: StaffFeedback[] } | null = null;
    try {
      const res = await fetch("/staff/snapshot", { cache: "no-store" });
      if (res.status === 401) { logoutRef.current(); return; }
      if (res.ok) snap = await res.json();
    } catch {}
    if (!snap) return;
    const { orders: o, requests: r, feedback: f } = snap;
    const s = seen.current;
    if (o) {
      for (const x of o) {
        if (!s.orders.has(x.id)) {
          s.orders.add(x.id);
          if (s.ready) {
            if (payFirstRef.current && !x.paid) notify(`🧾 سفارش جدید (در انتظار پرداخت) — میز ${toFa(x.table)}`, "سفارش جدید");
            else notify(`🧾 سفارش جدید — میز ${toFa(x.table)}`, "سفارش جدید");
          }
        }
        // اول پرداخت: لحظهٔ تأیید پرداخت = سفارش برای آشپزخانه
        if (x.paid && !s.paid.has(x.id)) {
          s.paid.add(x.id);
          if (s.ready && payFirstRef.current && x.status === "new") notify(`👨‍🍳 پرداخت شد — سفارش میز ${toFa(x.table)} برای آشپزخانه`, "سفارش پرداخت‌شده");
        }
        if (x.payStatus === "pending" && !s.pending.has(x.id)) {
          // یک اعلان برای هر میز کافی است (فیش به همهٔ سفارش‌های باز می‌چسبد)
          const already = [...s.pending].some((id) => o.find((y) => y.id === id && y.table === x.table && y.payStatus === "pending"));
          s.pending.add(x.id);
          if (s.ready && !already) notify(`💳 فیش پرداخت جدید — میز ${toFa(x.table)}`, "فیش پرداخت");
        }
        if (x.payStatus !== "pending") s.pending.delete(x.id);
      }
      setOrders(o);
    }
    if (r) {
      for (const x of r) {
        if (!s.requests.has(x.id)) {
          s.requests.add(x.id);
          if (s.ready) notify(`${x.type === "pos" ? "🧾 درخواست کارت‌خوان سر میز (چاپ فاکتور)" : x.type === "invoice" ? "💵 درخواست صورتحساب" : "🙋 درخواست گارسون"} — میز ${toFa(x.table)}${x.note ? `: ${x.note}` : ""}`, x.type === "pos" ? "کارت‌خوان" : "درخواست جدید");
        }
      }
      setRequests(r);
    }
    if (f) {
      for (const x of f) {
        if (!s.feedback.has(x.id)) { s.feedback.add(x.id); if (s.ready) notify("⭐ نظر جدید ثبت شد", "نظر جدید"); }
      }
      setFeedback(f);
    }
    s.ready = true;
  }, [notify]);

  const loadMeta = useCallback(() => {
    staffSettingsAction().then((st) => {
      setCafe({ name: st.cafe.name || "کافه", logo: st.cafe.logo || "☕" });
      setCurrency(st.cafe.currency === "rial" ? "rial" : "toman");
      setCodeMode(st.orderCode === "id" ? "id" : "number");
      setPayFirst(st.payFirst);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
    poll();
    // کانال زنده: سرور به‌محض هر تغییر خبر می‌دهد → همان لحظه داده تازه می‌شود
    let timer: number | undefined;
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(poll, 60); };
    const es = new EventSource("/staff/live");
    es.onmessage = refresh;
    es.onopen = () => { setLive(true); refresh(); }; // بعد از وصل‌شدنِ دوباره، چیزی جا نماند
    es.onerror = () => setLive(es.readyState === EventSource.OPEN);
    // پشتیبان: اگر اتصال زنده قطع بود، هر ۱۵ ثانیه
    const t = window.setInterval(poll, 15000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => { es.close(); window.clearInterval(t); window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [poll, loadMeta]);
  useEffect(() => {
    if (section === "customers") staffCustomersAction().then(setCustomers).catch(() => {});
  }, [section]);

  /* ---- شمارنده‌های منو ---- */
  const counts = useMemo(() => {
    const pendingTables = new Set(orders.filter((o) => (o.payStatus === "pending" || o.payStatus === "pos") && !o.paid).map((o) => o.table));
    const active = (o: Order) => o.status !== "served" && o.status !== "cancelled";
    // اول پرداخت: میزهایی که سفارشِ پرداخت‌نشده دارند هم کارِ صندوق‌اند
    const waits = (o: Order) => payFirst && o.status === "new" && !o.paid;
    if (payFirst) orders.filter(waits).forEach((o) => pendingTables.add(o.table));
    return {
      orders: orders.filter((o) => active(o) && !waits(o)).length,
      requests: requests.filter((r) => r.status === "pending").length,
      cashier: pendingTables.size,
    } as Partial<Record<Section, number>>;
  }, [orders, requests, payFirst]);

  const ctx: StaffCtx = useMemo(() => ({
    cafeName: cafe.name,
    money: (n: number) => formatMoney(n, currency),
    currency, codeMode, flash,
    print: (q: string) => window.open("/print?" + q, "_blank"),
    viewImage: setImage,
    ask: (title: string, hint?: string) => new Promise<string | null>((resolve) => { setAskText(""); setAsking({ title, hint, resolve }); }),
  }), [currency, codeMode, flash, cafe.name]);

  const upsertOrder = useCallback((o: Order | null) => { if (o) setOrders((l) => l.map((x) => (x.id === o.id ? o : x))); }, []);
  const go = (s: Section) => { setSection(s); setSideOpen(false); window.scrollTo({ top: 0 }); };
  const current = nav.find((n) => n.id === section)!;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-xl text-primary-foreground">
          {isImgSrc(cafe.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cafe.logo} alt="" className="size-full object-cover" />
          ) : cafe.logo || <Coffee className="size-5" />}
        </span>
        <div className="min-w-0 leading-tight">
          <b className="block truncate">{cafe.name}</b>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-green-500" : "bg-amber-500")} /> داشبورد مدیر · {live ? "زنده" : "در حال اتصال…"}</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {nav.map((n) => {
          const c = counts[n.id] || 0;
          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-sm font-semibold transition",
                section === n.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <n.icon className="size-[18px] shrink-0" />
              <span className="flex-1">{n.label}</span>
              {c > 0 && (
                <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold", section === n.id ? "bg-white text-primary" : "bg-primary text-primary-foreground")}>{toFa(c)}</span>
              )}
            </button>
          );
        })}
      </nav>
      <a href="/?table=1" target="_blank" rel="noopener" className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
        <ExternalLink className="size-4" /> مشاهدهٔ منوی مشتری
      </a>
    </div>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen lg:pr-64 print:pr-0">
        {/* منوی کناری (دسکتاپ) */}
        <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 border-l border-border bg-card p-4 lg:block print:hidden">{sidebar}</aside>

        {/* منوی کناری (موبایل) */}
        <AnimatePresence>
          {sideOpen && (
            <motion.div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSideOpen(false)}>
              <motion.aside
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
                className="absolute inset-y-0 right-0 w-72 max-w-[84vw] bg-card p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => setSideOpen(false)} aria-label="بستن" className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
                {sidebar}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl print:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو" onClick={() => setSideOpen(true)}><MenuIcon /></Button>
            <h1 className="flex-1 truncate text-lg font-extrabold">{current.title}</h1>
            <button
              onClick={() => setSound((s) => !s)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition", sound ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}
              title="صدای اعلان"
            >
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} صدا
            </button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="خروج" title="خروج" onClick={async () => { await logoutAction().catch(() => {}); onLogout(); }}><LogOut /></Button>
          </div>
        </header>

        {subscription && section !== "billing" && !subscription.expiresAt.startsWith("2099") && (!subscription.active || subscription.daysLeft <= 7) && (
          <button onClick={() => go("billing")} className={cn("flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-sm font-bold print:hidden", subscription.active ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-primary text-primary-foreground")}>
            <Crown className="size-4" />
            {subscription.state === "suspended" ? "این مجموعه تعلیق شده است — با پشتیبانی تماس بگیرید"
              : !subscription.active ? "اشتراک تمام شده و منوی مشتری‌ها غیرفعال است — برای تمدید بزنید"
              : `${subscription.state === "trial" ? "دورهٔ آزمایشی" : "اشتراک"} ${toFa(subscription.daysLeft)} روزِ دیگر تمام می‌شود — تمدید`}
          </button>
        )}

        <main className="mx-auto max-w-6xl px-4 py-5">
          {section === "orders" && <OrdersSection orders={orders} feedback={feedback} onChange={upsertOrder} payFirst={payFirst} onCashier={() => go("cashier")} />}
          {section === "requests" && <RequestsSection requests={requests} onChange={setRequests} />}
          {section === "products" && <MenuManager onCurrency={setCurrency} />}
          {section === "cashier" && <CashierSection orders={orders} onRefresh={poll} />}
          {section === "accounting" && <AccountingSection />}
          {section === "customers" && <CustomersSection items={customers} onChange={setCustomers} />}
          {section === "settings" && <SettingsPanel onSaved={loadMeta} />}
          {section === "qr" && <QrSection />}
          {section === "billing" && <BillingSection />}
        </main>
      </div>

      {/* عکس فیش */}
      {image && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-4" onClick={() => setImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="فیش پرداخت" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      )}

      {/* دیالوگ متن (دلیل رد و …) */}
      {asking && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={() => { asking.resolve(null); setAsking(null); }}>
          <form
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); asking.resolve(askText); setAsking(null); }}
          >
            <h3 className="mb-1 text-lg font-extrabold">{asking.title}</h3>
            {asking.hint && <p className="mb-3 text-xs text-muted-foreground">{asking.hint}</p>}
            <input value={askText} onChange={(e) => setAskText(e.target.value)} autoFocus placeholder="اختیاری" className={cn(inputCls, "mb-3 py-2.5")} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => { asking.resolve(null); setAsking(null); }}>انصراف</Button>
              <Button type="submit" className="flex-1 rounded-xl">تأیید</Button>
            </div>
          </form>
        </div>
      )}

      {/* اعلان‌ها */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4 print:hidden">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-foreground px-5 py-2 text-center text-sm font-semibold text-background shadow-lg">
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
