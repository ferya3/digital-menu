"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, X, Coffee, Star, Trash2, BellRing, Moon, Sun, QrCode,
  ReceiptText, Upload, Loader2, ClipboardList, Check, CheckCircle2, Menu as MenuIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, thumb, toFa, formatMoney } from "@/lib/utils";
import type { Bill, CafeInfo, Menu, MenuCategory, MenuItem, Order, PaymentInfo } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUI } from "@/store/ui";
import { scrollToId } from "@/components/fx/smooth-scroll";
import { CoverflowCarousel, GridCard, ListRow, Stepper, ViewToggle, type ViewMode } from "@/components/menu/menu-modes";
import dynamic from "next/dynamic";
import { PhoneGate } from "@/components/menu/phone-gate";
import { ShareSheet, copyText, nativeShare, type ShareTarget } from "@/components/menu/share-sheet";
import { CatIcon } from "@/components/staff/kit";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import {
  placeOrderAction, billAction, ordersAction, uploadReceiptAction, posRequestAction,
  requestAction, feedbackAction,
} from "@/app/actions";
import { unwrap } from "@/lib/action-result";
import { picksTitle } from "@/lib/seeds";

/** گزینه‌های سریعِ درخواست از گارسون (مثل نسخهٔ قبلی) */
const QUICK_REQUESTS = [
  { icon: "🍴", label: "قاشق و چنگال", text: "قاشق و چنگال" },
  { icon: "🪑", label: "صندلی اضافه", text: "صندلی اضافه" },
  { icon: "🧻", label: "دستمال", text: "دستمال کاغذی" },
  { icon: "💧", label: "آب", text: "یک لیوان آب" },
  { icon: "🍬", label: "شکر", text: "شکر" },
  { icon: "🧽", label: "تمیز کردن میز", text: "تمیز کردن میز" },
  { icon: "📋", label: "منوی کاغذی", text: "منوی کاغذی" },
];

// پنل منتخب‌ها (با GSAP) جدا و بعد از بارگذاری صفحه لود می‌شود
const PicksSheet = dynamic(() => import("@/components/menu/picks-sheet").then((m) => m.PicksSheet), { ssr: false });

const STATUS_STEPS = ["new", "preparing", "ready", "served"] as const;
const STATUS_FA: Record<string, string> = {
  new: "در انتظار تأیید آشپزخانه",
  preparing: "در حال آماده‌سازی ☕",
  ready: "آماده است! ✅",
  served: "سرو شد",
  cancelled: "لغو شد",
};
const STATUS_SHORT: Record<string, string> = {
  new: "ثبت شد", preparing: "آماده‌سازی", ready: "آماده", served: "سرو شد", cancelled: "لغو",
};


export function MenuView({
  menu, table, cafe, payment, otp = false, payFirst = false,
}: {
  menu: Menu;
  table: string;
  cafe: CafeInfo;
  payment: PaymentInfo;
  /** تأیید شمارهٔ مشتری با کد پیامکی (از تنظیمات) */
  otp?: boolean;
  /** سفارش فقط بعد از تأیید پرداخت به آشپزخانه می‌رود */
  payFirst?: boolean;
}) {
  const money = useCallback((n: number) => formatMoney(n, cafe.currency), [cafe.currency]);
  const openMobileMenu = useUI((s) => s.setMenu);
  // بدون شمارهٔ میز = فقط مشاهدهٔ منو (سفارش فقط با اسکنِ QR روی میز)
  const viewOnly = !table;
  // هدر با اسکرول به پایین پنهان می‌شود و فقط وقتی به بالای صفحه برگردیم دوباره دیده می‌شود
  // (نه با هر حرکتِ کوچکِ رو به بالا — روی گوشی با برگشتِ انگشت زود ظاهر می‌شد)
  const HDR_TOP = 120;
  const [hideHdr, setHideHdr] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => setHideHdr(window.scrollY > HDR_TOP);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const picksOpen = useUI((s) => s.picksOpen);
  const setPicks = useUI((s) => s.setPicks);
  const closePicks = useCallback(() => setPicks(false), [setPicks]);
  // منتخب‌ها: آیتم‌های برچسب‌دار (اگر حداقل ۳ تا باشند) وگرنه چند آیتمِ اول
  const featured = useMemo(() => {
    const avail = menu.items.filter((i) => i.available);
    const tagged = avail.filter((i) => i.tag);
    return (tagged.length >= 3 ? tagged : avail).slice(0, 6);
  }, [menu.items]);

  const [view, setView] = useState<ViewMode>("grid");
  const [activeCat, setActiveCat] = useState(menu.categories[0]?.id ?? "");
  const [lightbox, setLightbox] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<"card" | "pos" | null>(null);
  const [posSending, setPosSending] = useState(false);
  // روش‌های پرداختِ فعال: کارت‌به‌کارت (اگر کارت/لینک تعریف شده) و کارت‌خوان سر میز
  const cardOK = payment.allowCard !== false && !!(payment.card || payment.link);
  const posOK = payment.allowPos !== false;
  const [reqOpen, setReqOpen] = useState(false);
  const [reqSending, setReqSending] = useState<"waiter" | "invoice" | null>(null);
  const [reqNote, setReqNote] = useState("");
  const [fbOpen, setFbOpen] = useState(false);
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ordersKey = `cafe_orders_t${table}`;
  const toastTimer = useRef<number | undefined>(undefined);
  const flash = (m: string, ms = 2600) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), ms);
  };

  // منو به‌صورت بخش‌های دسته‌بندی (مثل نسخهٔ قبل)؛ محصولات ناموجود به مشتری نشان داده نمی‌شوند
  const sections = useMemo(
    () =>
      menu.categories
        .map((c) => ({ cat: c, items: menu.items.filter((i) => i.category === c.id && i.available) }))
        .filter((sec) => sec.items.length > 0),
    [menu]
  );

  // حالت نمایش انتخاب‌شده یادش می‌ماند
  useEffect(() => {
    try {
      const v = localStorage.getItem("cafe_view") as ViewMode | null;
      if (v === "carousel" || v === "grid" || v === "list") setView(v);
    } catch {}
  }, []);
  const changeView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem("cafe_view", v); } catch {}
  };

  // دسته‌ای که الان روی صفحه است، در نوار دسته‌ها پررنگ می‌شود
  useEffect(() => {
    const els = sections.map((sec) => document.getElementById(`cat-${sec.cat.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveCat(vis[0].target.id.slice(4));
      },
      { rootMargin: "-215px 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, view]);

  // نوارِ دسته‌ها همیشه دکمهٔ دستهٔ فعال را وسطِ دید نگه می‌دارد (با اسکرول یا کلیک)
  useEffect(() => {
    const box = chipsRef.current;
    const chip = document.getElementById(`chip-${activeCat}`);
    if (!box || !chip) return;
    const b = box.getBoundingClientRect(), c = chip.getBoundingClientRect();
    const delta = c.left + c.width / 2 - (b.left + b.width / 2);
    if (Math.abs(delta) > 4) box.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeCat]);

  const goToCategory = (id: string) => {
    setActiveCat(id);
    // اگر مقصد پایین‌تر از بالای صفحه باشد هدر پنهان است (فقط نوارِ دسته‌ها می‌ماند)
    const el = document.getElementById(`cat-${id}`);
    const bar = barRef.current?.offsetHeight ?? 60;
    const target = window.scrollY + (el?.getBoundingClientRect().top ?? 0) - (bar + 12);
    scrollToId(`cat-${id}`, -(bar + 12 + (target > HDR_TOP ? 0 : 92)));
  };

  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  async function share(item: MenuItem) {
    // لینکِ صفحهٔ خودِ محصول: در واتساپ/تلگرام پیش‌نمایشِ عکس و قیمت نشان می‌دهد
    const url = `${window.location.origin}/p/${encodeURIComponent(item.id)}`;
    const text = [
      `${item.name} — ${money(item.price)}`,
      `☕ ${cafe.name}`,
      cafe.address && `📍 ${cafe.address}`,
      cafe.mapUrl && `🗺️ ${cafe.mapUrl}`,
      cafe.instagram && `📷 ${cafe.instagram}`,
    ].filter(Boolean).join("\n");
    const target: ShareTarget = { title: item.name, text, url, image: item.image ? thumb(item.image, 1080) : undefined };
    if (await nativeShare(target)) return;
    setShareTarget(target);
  }


  const add = (id: string) => {
    if (viewOnly) return flash("برای سفارش، QR روی میزتان را اسکن کنید 📷", 3500);
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  };
  const dec = (id: string) =>
    setCart((c) => {
      const q = (c[id] || 0) - 1;
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((s, [id, q]) => {
    const d = menu.items.find((x) => x.id === id);
    return s + (d ? d.price * q : 0);
  }, 0);
  const activeOrders = myOrders.filter((o) => o.status !== "served" && o.status !== "cancelled").length;

  /* وضعیت سفارش‌ها: کانال زنده برای همین میز + پشتیبانِ کند */
  const billOpenRef = useRef(false);
  billOpenRef.current = billOpen;
  const myOrdersRef = useRef<Order[]>([]);
  myOrdersRef.current = myOrders;
  const payFirstRef = useRef(payFirst);
  payFirstRef.current = payFirst;
  useEffect(() => {
    // هر بار اسکنِ دوبارهٔ QR (تبِ تازه) = حضورِ جدید: سفارش‌های تمام‌شدهٔ قبلی نمایش داده نمی‌شوند
    const visitKey = `cafe_visit_t${table}`;
    let freshVisit = false;
    try {
      freshVisit = !sessionStorage.getItem(visitKey);
      sessionStorage.setItem(visitKey, String(Date.now()));
    } catch {}
    const refresh = () => {
      try {
        const cur: string[] = JSON.parse(localStorage.getItem(ordersKey) || "[]");
        if (!cur.length) return setMyOrders([]);
        ordersAction(cur)
            .then((all) => {
              const next = pruneOrders(all, freshVisit);
              freshVisit = false;
              try { localStorage.setItem(ordersKey, JSON.stringify(next.map((o) => o.id))); } catch {}
              // پرداخت تأیید شد → سفارش رفت برای سرآشپز
              const was = new Map(myOrdersRef.current.map((o) => [o.id, o]));
              const justPaid = next.find((o) => o.paid && was.get(o.id) && !was.get(o.id)!.paid && o.status !== "cancelled");
              if (justPaid && payFirstRef.current) flash(`✅ پرداخت تأیید شد — سفارش #${toFa(justPaid.number)} برای سرآشپز ارسال شد`, 6000);
              setMyOrders(next);
            })
            .catch(() => {});
      } catch {}
      if (billOpenRef.current) billAction(table).then(setBill).catch(() => {});
    };
    refresh();
    // سفارشِ تمام‌شده بعد از مدتی خودش از لیست می‌رود
    const prune = window.setInterval(() => setMyOrders((l) => pruneOrders(l, false)), 60_000);
    let timer: number | undefined;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 80); };
    if (!table) return;
    const es = new EventSource(`/live?table=${encodeURIComponent(table)}`);
    es.onmessage = soon;
    const t = window.setInterval(refresh, 30000);
    const onVis = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onVis);
    return () => { es.close(); window.clearInterval(t); window.clearInterval(prune); window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  async function submitOrder() {
    if (count === 0) return;
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      const ord = unwrap(await placeOrderAction(table, items, { note: note.trim(), phone }));
      setMyOrders((l) => {
        const next = [ord, ...l.filter((o) => o.id !== ord.id)];
        try {
          localStorage.setItem(ordersKey, JSON.stringify(next.slice(0, 12).map((o) => o.id)));
        } catch {}
        return next;
      });
      setCart({});
      setNote("");
      setCartOpen(false);
      setPlaced(ord.number);
      if (payFirst) {
        // اول پرداخت: صورتحساب و اطلاعات پرداخت همان لحظه باز می‌شود
        flash(`سفارش #${toFa(ord.number)} ثبت شد — بعد از پرداخت برای سرآشپز ارسال می‌شود`, 5000);
        window.setTimeout(() => openBill(), 350);
      } else {
        flash(`سفارش شماره ${toFa(ord.number)} ثبت شد`);
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestPos() {
    setPosSending(true);
    try {
      unwrap(await posRequestAction(table));
      flash("درخواست کارت‌خوان ثبت شد ✅ — با فاکتور و کارت‌خوان سر میز می‌آییم", 5000);
      setBill(await billAction(table));
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا");
    } finally {
      setPosSending(false);
    }
  }

  async function openBill() {
    setPayMethod(null);
    setBillOpen(true);
    setBillLoading(true);
    try {
      setBill(await billAction(table));
    } finally {
      setBillLoading(false);
    }
  }
  async function onReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const blob = await compressImage(f, 1600);
      const r = unwrap(await uploadReceiptAction(imageForm(blob, { table })));
      flash(r.reused ? "⚠️ این رسید قبلاً استفاده شده" : "رسید ارسال شد؛ منتظر تأیید صندوق");
      setBill(await billAction(table));
    } catch {
      flash("خطا در ارسال رسید");
    }
  }
  async function sendRequest(type: "waiter" | "invoice") {
    setReqSending(type);
    try {
      unwrap(await requestAction(table, type, type === "waiter" ? reqNote : ""));
      setReqOpen(false);
      if (type === "waiter") setReqNote("");
      flash(type === "waiter" ? "گارسون به‌زودی می‌آید 🙋" : "درخواست فاکتور ارسال شد 🧾");
    } catch {
      flash("ارسال نشد؛ دوباره تلاش کنید");
    } finally {
      setReqSending(null);
    }
  }
  async function sendFeedback() {
    setFbSending(true);
    try {
      unwrap(await feedbackAction({ table, orderId: myOrders[0]?.id, rating: fbRating, comment: fbComment }));
      setFbOpen(false);
      setFbComment("");
      setFbRating(5);
      flash("نظرت ثبت شد، ممنون 🙏");
    } finally {
      setFbSending(false);
    }
  }

  const logoIsImg = /^https?:|^data:|^\/uploads\//.test(cafe.logo);

  return (
    <div className="min-h-screen pb-44 sm:pb-28">
      {/* header */}
      <header className={cn("sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl transition-transform duration-300", hideHdr && "-translate-y-full")}>
        {/* منو سمت راست، لوگو و نام کافه وسط، دکمه‌های دسکتاپ سمت چپ */}
        <div className="mx-auto grid h-[92px] max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className="flex justify-start">
            <Button variant="ghost" size="icon" className="size-11 rounded-2xl" onClick={() => openMobileMenu(true)} aria-label="منو">
              <MenuIcon className="size-6" />
            </Button>
          </div>
          <div className="flex flex-col items-center text-center leading-tight">
            {logoIsImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumb(cafe.logo, 160)} alt="" className="size-11 rounded-2xl object-cover shadow-md" />
            ) : (
              <span className="grid size-11 place-items-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-lg shadow-primary/25">
                {cafe.logo || <Coffee className="size-5" />}
              </span>
            )}
            <h1 className="mt-1 max-w-[56vw] truncate text-base font-extrabold tracking-tight sm:max-w-none">{cafe.name}</h1>
            <p className="text-[10px] text-muted-foreground">{cafe.tagline || "منوی دیجیتال"} · {viewOnly ? "فقط مشاهده" : `میز ${toFa(table)}`}</p>
          </div>
          <div className={cn("flex items-center justify-end gap-1", viewOnly && "invisible")}>
            {/* روی موبایل این دکمه‌ها در نوارِ پایین هستند */}
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => setReqOpen(true)} aria-label="درخواست">
              <BellRing />
            </Button>
            {myOrders.length > 0 && (
              <button onClick={() => setStatusOpen(true)} className="relative hidden size-10 sm:grid place-items-center rounded-full bg-muted hover:bg-muted/70" aria-label="وضعیت سفارش">
                <ClipboardList className="size-5" />
                {activeOrders > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-green-600 px-1 text-[11px] font-bold text-white">{toFa(activeOrders)}</span>
                )}
              </button>
            )}
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={openBill} aria-label="صورتحساب"><ReceiptText /></Button>
            <span className="hidden sm:contents"><ThemeToggle /></span>
            <button onClick={() => setCartOpen(true)} className="relative hidden size-10 sm:grid place-items-center rounded-full bg-muted hover:bg-muted/70" aria-label="سبد خرید">
              <ShoppingBag className="size-5" />
              {count > 0 && (
                <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{toFa(count)}</motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* نوارِ چسبان: حالت نمایش منو + دسته‌ها (با پنهان‌شدنِ هدر، همین نوار بالا می‌ماند) */}
      <div ref={barRef} className={cn("sticky top-[92px] z-30 border-b border-border/40 bg-background/80 pb-2.5 pt-2 backdrop-blur-xl transition-transform duration-300", hideHdr && "-translate-y-[92px]")}>
        <div className="mx-auto mb-2 flex max-w-5xl flex-col items-center gap-1 px-4">
          <span className="text-[11px] font-bold text-muted-foreground">حالت نمایش منو</span>
          <ViewToggle value={view} onChange={changeView} compact />
        </div>
        <div ref={chipsRef} className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto scroll-smooth px-4">
          {sections.map(({ cat: c }) => (
            <button
              key={c.id}
              id={`chip-${c.id}`}
              onClick={() => goToCategory(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                activeCat === c.id ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="grid size-5 place-items-center overflow-hidden rounded-md"><CatIcon icon={c.emoji} /></span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* بخش‌های منو */}
      <main className="mx-auto max-w-5xl space-y-10 px-4 pt-5">
        {sections.length === 0 && <p className="py-20 text-center text-muted-foreground">منو هنوز خالی است.</p>}
        {sections.map(({ cat: c, items }) => {
          const actions = {
            money,
            cafeName: cafe.name,
            qtyOf: (id: string) => cart[id] || 0,
            onAdd: add,
            onDec: dec,
            onImage: (it: MenuItem) => setLightbox(it),
            onShare: share,
          };
          return (
            <section key={c.id} id={`cat-${c.id}`}>
              <CategoryTitle cat={c} count={items.length} />
              {view === "carousel" && <CoverflowCarousel items={items} {...actions} />}
              {view === "grid" && (
                <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {items.map((it, i) => <GridCard key={it.id} item={it} index={i} {...actions} />)}
                </div>
              )}
              {view === "list" && (
                <div className="space-y-2.5">
                  {items.map((it) => <ListRow key={it.id} item={it} {...actions} />)}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <ShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />

      {otp && !viewOnly && <PhoneGate cafe={cafe} table={table} onVerified={setPhone} />}

      <PicksSheet
        title={picksTitle(cafe.kind)}
        open={picksOpen}
        onClose={closePicks}
        items={featured}
        money={money}
        qtyOf={(id) => cart[id] || 0}
        onAdd={add}
        onDec={dec}
        onImage={(it) => setLightbox(it)}
        count={count}
        total={total}
        onCart={() => { setPicks(false); setCartOpen(true); }}
        onMenu={() => { setPicks(false); window.setTimeout(() => scrollToId("menu"), 80); }}
      />

      {/* بزرگ‌نمایی عکس */}
      <AnimatePresence>
        {lightbox?.image && (
          <motion.div
            className="fixed inset-0 z-[65] grid place-items-center bg-black/85 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.figure initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="max-w-3xl text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(lightbox.image, 1080)} alt={lightbox.name} className="max-h-[78vh] rounded-2xl object-contain" />
              <figcaption className="mt-3 font-bold text-white">{lightbox.name} · {money(lightbox.price)}</figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>

      {/* cart bar */}
      <AnimatePresence>
        {count > 0 && !cartOpen && !billOpen && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-background/85 backdrop-blur-xl sm:block">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
              <div className="text-sm"><span className="font-bold">{toFa(count)}</span><span className="text-muted-foreground"> کالا · </span><span className="font-extrabold text-primary">{money(total)}</span></div>
              <Button onClick={() => setCartOpen(true)} size="lg" className="rounded-full">مشاهدهٔ سبد</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* موبایل: جمعِ سبد به‌صورتِ یک قرصِ کوچک بالای دکمهٔ سبد */}
      <AnimatePresence>
        {count > 0 && !cartOpen && !billOpen && (
          <motion.button
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-[calc(98px+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur sm:hidden"
          >
            <span className="font-bold">{toFa(count)}</span><span className="text-muted-foreground">کالا ·</span>
            <span className="font-extrabold text-primary">{money(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* نوارِ پایینِ موبایل (با دکمهٔ گردِ سبد در وسط) */}
      <MobileTabBar
        count={count}
        activeOrders={activeOrders}
        onRequest={() => setReqOpen(true)}
        onStatus={() => setStatusOpen(true)}
        onCart={() => setCartOpen(true)}
        onBill={openBill}
        viewOnly={viewOnly}
        onScan={() => {
          // بدون میز: صفحهٔ اسکنِ QR (با دکمهٔ دوربین)
          try { sessionStorage.removeItem("cafe_browse"); } catch {}
          window.location.href = "/";
        }}
      />

      {/* placed toast */}
      <AnimatePresence>
        {placed !== null && (
          <motion.button initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setPlaced(null); setStatusOpen(true); }} className="fixed inset-x-0 bottom-[calc(146px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit sm:bottom-20 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xl">
            <CheckCircle2 className="size-5 text-green-500" /> سفارش #{toFa(placed)} ثبت شد — پیگیری وضعیت
          </motion.button>
        )}
      </AnimatePresence>

      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={onReceiptFile} />

      {/* ===== drawers ===== */}
      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title="سبد خرید">
        {count === 0 ? (
          <p className="py-12 text-center text-muted-foreground">سبد خالی است.</p>
        ) : (
          <>
            <div className="space-y-3">
              {Object.entries(cart).map(([id, q]) => {
                const d = menu.items.find((x) => x.id === id)!;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-xl bg-muted text-2xl">{d.emoji}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-bold">{d.name}</div><div className="text-sm text-primary">{money(d.price)}</div></div>
                    <Stepper qty={q} onAdd={() => add(id)} onDec={() => dec(id)} />
                  </div>
                );
              })}
            </div>
            {payFirst && (
              <p className="mt-4 flex gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs leading-6 text-amber-800 dark:text-amber-300">
                <span>💳</span>
                <span>سفارش شما <b>بعد از پرداخت</b> برای سرآشپز ارسال می‌شود. پس از ثبت، مبلغ را کارت‌به‌کارت کنید و رسید را بفرستید، یا در صندوق پرداخت کنید.</span>
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="یادداشت برای آشپزخانه (اختیاری) — مثلاً شیر کم‌چرب، بدون شکر"
              className="mt-4 w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-4"><span className="text-muted-foreground">مجموع</span><span className="text-xl font-black text-primary">{money(total)}</span></div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCart({})}><Trash2 /></Button>
              <Button size="lg" className="flex-1 rounded-xl" onClick={submitOrder} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : payFirst ? "ثبت سفارش و پرداخت" : "ثبت سفارش"}</Button>
            </div>
          </>
        )}
      </Drawer>

      <Drawer open={reqOpen} onClose={() => setReqOpen(false)} title="درخواست‌ها">
        <p className="mb-3 text-sm text-muted-foreground">درخواستتان را بنویسید یا از گزینه‌های سریع استفاده کنید:</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_REQUESTS.map((q) => {
            const on = reqNote.split("، ").includes(q.text);
            return (
              <button
                key={q.text}
                onClick={() =>
                  setReqNote((cur) => {
                    const parts = cur.split("، ").map((x) => x.trim()).filter(Boolean);
                    return (on ? parts.filter((x) => x !== q.text) : [...parts, q.text]).join("، ");
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-95",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:bg-muted"
                )}
              >
                <span>{q.icon}</span>
                {q.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={reqNote}
          onChange={(e) => setReqNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="مثلاً: یک قاشق اضافه لطفاً…"
          className="mb-3 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => sendRequest("waiter")} disabled={reqSending !== null}>
          {reqSending === "waiter" ? <Loader2 className="animate-spin" /> : <><BellRing className="size-5" /> صدا زدن گارسون</>}
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => sendRequest("invoice")} disabled={reqSending !== null}>
            {reqSending === "invoice" ? <Loader2 className="animate-spin" /> : <><ReceiptText className="size-4" /> درخواست فاکتور</>}
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setReqOpen(false); openBill(); }}>
            💳 صورتحساب و پرداخت
          </Button>
        </div>
      </Drawer>

      <Drawer open={statusOpen} onClose={() => setStatusOpen(false)} title="وضعیت سفارش">
        {myOrders.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">هنوز سفارشی ثبت نکرده‌ای.</p>
        ) : (
          <div className="space-y-4">
            {myOrders.map((o) => <OrderTracker key={o.id} order={o} money={money} payFirst={payFirst} onPay={() => { setStatusOpen(false); openBill(); }} />)}
            <Button variant="outline" className="w-full rounded-xl" onClick={() => { setStatusOpen(false); setFbOpen(true); }}><Star /> ثبت نظر و امتیاز</Button>
            <p className="pt-1 text-center text-[11px] text-muted-foreground">وضعیت هر چند ثانیه یک‌بار به‌روز می‌شود.</p>
          </div>
        )}
      </Drawer>

      <Drawer open={billOpen} onClose={() => setBillOpen(false)} title="صورتحساب میز">
        {billLoading ? (
          <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
        ) : !bill || bill.count === 0 ? (
          <p className="py-10 text-center text-muted-foreground">صورتحساب بازی برای این میز نیست.</p>
        ) : (
          <>
            {payFirst && bill.payStatus !== "pending" && (
              <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-7 text-amber-900 dark:text-amber-200">
                💳 <b>سفارش شما بعد از تأیید پرداخت برای سرآشپز ارسال می‌شود.</b>
                <br />
                <span className="text-xs">{cardOK && posOK ? "کارت‌به‌کارت کنید و رسید را بفرستید، یا «کارت‌خوان سر میز» را بزنید." : posOK ? "«کارت‌خوان سر میز» را بزنید تا با فاکتور و کارت‌خوان بیاییم." : "مبلغ را کارت‌به‌کارت کنید و رسید را بفرستید، یا در صندوق پرداخت کنید."}</span>
              </div>
            )}
            <p className="mb-3 text-xs text-muted-foreground">{toFa(bill.count)} سفارش پرداخت‌نشده روی این میز — همه با هم:</p>
            <div className="space-y-3">
              {bill.orders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">سفارش #{toFa(o.number)}</span><span className="text-sm font-extrabold text-primary">{money(o.total)}</span></div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {o.items.map((it, i) => (<li key={i} className="flex justify-between"><span>{it.name} × {toFa(it.qty)}</span><span>{money(it.price * it.qty)}</span></li>))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-muted-foreground">جمع کل بدهی</span><span className="text-2xl font-black text-primary">{money(bill.total)}</span></div>
            {bill.payStatus === "pending" && <div className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-600 dark:text-amber-400">رسید ارسال شد؛ در انتظار تأیید صندوق.{payFirst && " بعد از تأیید، سفارش برای سرآشپز ارسال می‌شود."}</div>}
            {bill.payStatus === "rejected" && <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-center text-sm text-primary">فیش قبلی رد شد{bill.rejectedReason ? `: ${bill.rejectedReason}` : ""}. دوباره پرداخت کن.</div>}
            {bill.payStatus === "pos" && (
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-sm leading-7">
                🧾 <b>درخواست کارت‌خوان ثبت شد.</b>
                <br />
                همکاران ما با فاکتور و کارت‌خوان سر میز می‌آیند.{payFirst && " بعد از پرداخت، سفارش برای سرآشپز ارسال می‌شود."}
              </div>
            )}
            {bill.payStatus !== "pos" && bill.payStatus !== "pending" && cardOK && posOK && (
              <div className="mt-4">
                <div className="mb-2 text-sm font-bold">روش پرداخت</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPayMethod("card")} className={cn("rounded-2xl border-2 p-3 text-center text-sm font-bold transition", payMethod === "card" ? "border-primary bg-primary/5" : "border-border")}>
                    <span className="mb-1 block text-2xl">💳</span>کارت‌به‌کارت
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">ارسال رسید</span>
                  </button>
                  <button onClick={() => setPayMethod("pos")} className={cn("rounded-2xl border-2 p-3 text-center text-sm font-bold transition", payMethod === "pos" ? "border-primary bg-primary/5" : "border-border")}>
                    <span className="mb-1 block text-2xl">🧾</span>کارت‌خوان سر میز
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">با فاکتور می‌آییم</span>
                  </button>
                </div>
              </div>
            )}
            {bill.payStatus !== "pos" && posOK && (payMethod === "pos" || !cardOK) && bill.payStatus !== "pending" && (
              <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <p className="mb-2 text-xs leading-6 text-muted-foreground">صندوق فاکتور میز را چاپ می‌کند و همکاران ما با کارت‌خوان سر میز می‌آیند.</p>
                <Button className="h-11 w-full rounded-xl text-base" onClick={requestPos} disabled={posSending}>{posSending ? <Loader2 className="animate-spin" /> : "🧾 درخواست کارت‌خوان سر میز"}</Button>
              </div>
            )}
            {cardOK && (payMethod === "card" || !posOK || bill.payStatus === "pending" || bill.payStatus === "pos") && (
              <>
            {(payment.card || payment.link || payment.holder) && (
                <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                  <div className="mb-1.5 font-bold">اطلاعات پرداخت</div>
                  {payment.card && (
                    <div className="flex items-center justify-between gap-2">
                      <span dir="ltr" className="font-mono tracking-wider">{toFa(payment.card)}</span>
                      <button onClick={async () => flash((await copyText(payment.card.replace(/\D/g, ""))) ? "شماره کارت کپی شد" : "کپی نشد")} className="shrink-0 rounded-lg bg-card px-2 py-1 text-xs font-semibold text-primary">کپی</button>
                    </div>
                  )}
                  {payment.holder && <div className="mt-0.5 text-xs text-muted-foreground">به نام {payment.holder}</div>}
                  {payment.note && <div className="mt-0.5 text-xs text-muted-foreground">{payment.note}</div>}
                  {payment.link && <a href={payment.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-primary">پرداخت آنلاین ↗</a>}
                </div>
              )}
              <Button className="mt-3 h-11 w-full rounded-xl text-base" onClick={() => fileRef.current?.click()}><Upload /> ارسال رسید پرداخت</Button>
              </>
            )}
            {!cardOK && !posOK && <p className="mt-3 text-center text-sm text-muted-foreground">برای پرداخت به صندوق مراجعه کنید.</p>}
          </>
        )}
      </Drawer>

      <Drawer open={fbOpen} onClose={() => setFbOpen(false)} title="نظر و امتیاز">
        <p className="mb-3 text-sm text-muted-foreground">تجربه‌ات از {cafe.name} چطور بود؟</p>
        <div className="mb-4 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setFbRating(i)} aria-label={`${i} ستاره`}>
              <Star className={cn("size-9 transition", i <= fbRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
        <textarea value={fbComment} onChange={(e) => setFbComment(e.target.value)} placeholder="توضیح (اختیاری)…" className="min-h-20 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button className="mt-3 h-11 w-full rounded-xl text-base" onClick={sendFeedback} disabled={fbSending}>{fbSending ? <Loader2 className="animate-spin" /> : "ثبت نظر"}</Button>
      </Drawer>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-x-0 top-4 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-foreground px-5 py-2 text-center text-sm font-semibold text-background shadow-lg">{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- عنوانِ دسته: روی بنر (اگر باشد) و وسط‌چین با تزئینِ دو طرف ---------- */
function Ornament({ flip }: { flip?: boolean }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center gap-1.5", flip && "flex-row-reverse")}>
      <span className="size-1 rounded-full bg-current opacity-60" />
      <span className="size-2 rotate-45 rounded-[2px] border-[1.5px] border-current" />
      <span className={cn("h-[2px] w-8 rounded-full from-current to-transparent sm:w-16", flip ? "bg-gradient-to-l" : "bg-gradient-to-r")} />
    </span>
  );
}
function CategoryTitle({ cat }: { cat: MenuCategory; count?: number }) {
  const title = (
    <>
      <Ornament />
      <span className="min-w-0 truncate">{cat.name}</span>
      <Ornament flip />
    </>
  );
  const heading = (
    <h3 className="mb-4 flex items-center justify-center gap-3 text-xl font-black sm:text-2xl">
      <span className="contents text-primary [&>span:nth-child(2)]:text-foreground">{title}</span>
    </h3>
  );
  if (!cat.banner) return heading;
  return (
    <>
      {/* عنوان بالای بنر (بیرون از عکس)، وسط‌چین */}
      {heading}
      {/* بنرِ تبلیغاتیِ همین دسته (از پنل ← محصولات ← دسته‌بندی‌ها) — بدون نوشته روی عکس */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb(cat.banner, 1080)}
        srcSet={`${thumb(cat.banner, 720)} 720w, ${thumb(cat.banner, 1080)} 1080w`}
        sizes="(min-width: 1024px) 1000px, 100vw"
        alt={cat.name}
        loading="lazy"
        decoding="async"
        className="mb-5 aspect-[12/5] w-full rounded-3xl object-cover shadow-md"
      />
    </>
  );
}

/* ---------- نوارِ پایینِ موبایل ---------- */
function MobileTabBar({ count, activeOrders, onRequest, onStatus, onCart, onBill, viewOnly, onScan }: {
  count: number; activeOrders: number; onRequest: () => void; onStatus: () => void; onCart: () => void; onBill: () => void;
  /** بدون شمارهٔ میز: دکمه‌ها به «اسکن QR میز» می‌روند */
  viewOnly?: boolean; onScan: () => void;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };
  const Item = ({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) => (
    <button onClick={onClick} className="relative flex flex-1 flex-col items-center gap-1 pb-1 pt-2.5 text-[11px] font-semibold text-muted-foreground transition active:scale-95">
      <span className="relative grid size-7 place-items-center [&_svg]:size-[22px]">
        {icon}
        {!!badge && badge > 0 && <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">{toFa(badge)}</span>}
      </span>
      {label}
    </button>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 sm:hidden" aria-label="نوار پایین">
      {/* بدنهٔ نوار با فرورفتگیِ گرد در وسط */}
      <div className="flex h-[68px] drop-shadow-[0_-6px_14px_rgba(60,35,20,0.10)] dark:drop-shadow-[0_-6px_14px_rgba(0,0,0,0.45)]">
        <div className="flex-1 rounded-tr-[22px] bg-card" />
        <svg viewBox="0 0 110 68" preserveAspectRatio="none" className="relative -mx-[2px] h-[68px] w-[114px] shrink-0 fill-card" aria-hidden>
          {/* لبه‌ها ۲px روی دو تکهٔ کناری می‌افتند تا خطِ درز دیده نشود */}
          <path d="M0 0 H10 C22 0 24 6 27 14 C33 32 42 41 55 41 C68 41 77 32 83 14 C86 6 88 0 100 0 H110 V68 H0 Z" />
        </svg>
        <div className="flex-1 rounded-tl-[22px] bg-card" />
      </div>
      <div className="bg-card pb-[env(safe-area-inset-bottom)]" />
      <div className="absolute inset-x-0 top-0 flex h-[68px] items-stretch">
        <Item icon={<BellRing />} label="درخواست" onClick={viewOnly ? onScan : onRequest} />
        <Item icon={<ClipboardList />} label="وضعیت سفارش" onClick={viewOnly ? onScan : onStatus} badge={viewOnly ? 0 : activeOrders} />
        <div className="w-[96px] shrink-0" />
        <Item icon={<ReceiptText />} label="صورتحساب" onClick={viewOnly ? onScan : onBill} />
        <Item icon={dark ? <Sun /> : <Moon />} label={dark ? "حالت روز" : "حالت شب"} onClick={toggleTheme} />
      </div>
      {/* دکمهٔ گردِ وسط: سبد خرید (یا «اسکن QR» وقتی میز مشخص نیست) */}
      <button
        onClick={viewOnly ? onScan : onCart}
        aria-label={viewOnly ? "اسکن QR میز" : "سبد خرید"}
        className="absolute left-1/2 top-0 grid size-[62px] -translate-x-1/2 -translate-y-[38%] place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_22px_-6px_hsl(var(--primary)/0.6)] ring-[5px] ring-background transition active:scale-95"
      >
        {viewOnly ? <QrCode className="size-7" /> : <ShoppingBag className="size-7" />}
        {!viewOnly && count > 0 && (
          <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-xs font-black text-primary shadow">{toFa(count)}</motion.span>
        )}
      </button>
    </nav>
  );
}

/* ---------- «سفارش‌های من»: فقط همین حضور ---------- */
const DONE_VISIBLE_MS = 20 * 60 * 1000; // سفارشِ تمام‌شده تا ۲۰ دقیقه دیده می‌شود
const MAX_AGE_MS = 6 * 3600 * 1000; // هیچ سفارشی بیشتر از ۶ ساعت در لیست نمی‌ماند
const isFinished = (o: Order) => o.status === "cancelled" || (o.status === "served" && o.paid);
function pruneOrders(list: Order[], freshVisit: boolean): Order[] {
  const now = Date.now();
  return list.filter((o) => {
    if (now - +new Date(o.createdAt) > MAX_AGE_MS) return false;
    // اسکنِ تازه: سفارشِ پرداخت‌شدهٔ قدیمی (حتی اگر «سرو شد» زده نشده) هم مالِ حضورِ قبلی است
    if (freshVisit && o.paid && now - +new Date(o.createdAt) > 90 * 60 * 1000) return false;
    if (!isFinished(o)) return true;
    if (freshVisit) return false;
    return now - +new Date(o.updatedAt || o.createdAt) < DONE_VISIBLE_MS;
  });
}

/* ---------- pieces ---------- */
function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className="max-h-[82vh] overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold">{title}</h3>
              <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OrderTracker({ order, money, payFirst, onPay }: { order: Order; money: (n: number) => string; payFirst?: boolean; onPay?: () => void }) {
  const cancelled = order.status === "cancelled";
  // اول پرداخت: تا تأیید پرداخت، سفارش هنوز به آشپزخانه نرفته
  if (payFirst && !order.paid && !cancelled) {
    const pending = order.payStatus === "pending";
    const rejected = order.payStatus === "rejected";
    const pos = order.payStatus === "pos";
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">سفارش #{toFa(order.number)}</span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">{pending ? "در انتظار تأیید صندوق" : pos ? "کارت‌خوان در راه است" : "در انتظار پرداخت"}</span>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {pending
            ? "رسید شما رسید ✅ — به‌محض تأیید صندوق، سفارش برای سرآشپز ارسال می‌شود."
            : pos
              ? "همکاران ما با فاکتور و کارت‌خوان سر میز می‌آیند؛ بعد از پرداخت، سفارش برای سرآشپز ارسال می‌شود."
              : rejected
              ? `فیش رد شد${order.rejectedReason ? `: ${order.rejectedReason}` : ""} — دوباره پرداخت کنید تا سفارش برای سرآشپز ارسال شود.`
              : "سفارش شما بعد از پرداخت برای سرآشپز ارسال می‌شود."}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-extrabold text-primary">{money(order.total)}</span>
          {!pending && !pos && onPay && <Button size="sm" className="h-8 rounded-xl" onClick={onPay}>💳 پرداخت</Button>}
        </div>
      </div>
    );
  }
  const idx = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">سفارش #{toFa(order.number)}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", cancelled ? "bg-primary/10 text-primary" : order.status === "ready" ? "bg-green-600/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground")}>{STATUS_FA[order.status]}</span>
      </div>
      {!cancelled && (
        <div className="flex items-center">
          {STATUS_STEPS.map((s, i) => {
            const done = i <= idx;
            return (
              <div key={s} className="contents">
                <div className="flex flex-col items-center gap-1">
                  <span className={cn("grid size-7 place-items-center rounded-full text-[11px] font-bold", done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground", i === idx && "ring-2 ring-green-600/40")}>{done ? <Check className="size-4" /> : toFa(i + 1)}</span>
                  <span className={cn("text-[10px]", done ? "font-semibold text-foreground" : "text-muted-foreground")}>{STATUS_SHORT[s]}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && <span className={cn("mx-1 mb-4 h-0.5 flex-1 rounded", i < idx ? "bg-green-600" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-extrabold text-primary">{money(order.total)}</span>
        {order.payStatus === "pending" && <span className="text-xs text-amber-600 dark:text-amber-400">در انتظار تأیید صندوق ⏳</span>}
        {order.payStatus === "confirmed" && <span className="text-xs text-green-600 dark:text-green-400">پرداخت تأیید شد ✅</span>}
        {order.payStatus === "rejected" && <span className="text-xs text-primary">فیش رد شد{order.rejectedReason ? `: ${order.rejectedReason}` : ""}</span>}
      </div>
    </div>
  );
}
