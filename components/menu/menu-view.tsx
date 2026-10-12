"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, X, Coffee, Star, Trash2, BellRing,
  ReceiptText, Upload, Loader2, ClipboardList, Check, CheckCircle2, Menu as MenuIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, thumb, toFa, formatMoney } from "@/lib/utils";
import type { Bill, CafeInfo, Menu, MenuItem, Order, PaymentInfo } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUI } from "@/store/ui";
import { scrollToId } from "@/components/fx/smooth-scroll";
import { CoverflowCarousel, GridCard, ListRow, Stepper, ViewToggle, type ViewMode } from "@/components/menu/menu-modes";
import dynamic from "next/dynamic";
import { PhoneGate } from "@/components/menu/phone-gate";
import { ShareSheet, nativeShare, type ShareTarget } from "@/components/menu/share-sheet";
import { CatIcon } from "@/components/staff/kit";
import { compressImage, imageForm } from "@/lib/client-image";
import {
  placeOrderAction, billAction, ordersAction, uploadReceiptAction,
  requestAction, feedbackAction,
} from "@/app/actions";

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
  menu, table, cafe, payment, otp = false,
}: {
  menu: Menu;
  table: string;
  cafe: CafeInfo;
  payment: PaymentInfo;
  /** تأیید شمارهٔ مشتری با کد پیامکی (از تنظیمات) */
  otp?: boolean;
}) {
  const money = useCallback((n: number) => formatMoney(n, cafe.currency), [cafe.currency]);
  const openMobileMenu = useUI((s) => s.setMenu);
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
  const [reqOpen, setReqOpen] = useState(false);
  const [reqSending, setReqSending] = useState<"waiter" | "invoice" | null>(null);
  const [fbOpen, setFbOpen] = useState(false);
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ordersKey = `cafe_orders_t${table}`;
  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
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
      { rootMargin: "-140px 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, view]);

  const goToCategory = (id: string) => {
    setActiveCat(id);
    scrollToId(`cat-${id}`, -130);
    document.getElementById(`chip-${id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
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


  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
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
  useEffect(() => {
    const refresh = () => {
      try {
        const cur: string[] = JSON.parse(localStorage.getItem(ordersKey) || "[]");
        if (cur.length) ordersAction(cur).then(setMyOrders).catch(() => {});
      } catch {}
      if (billOpenRef.current) billAction(table).then(setBill).catch(() => {});
    };
    refresh();
    let timer: number | undefined;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 80); };
    const es = new EventSource(`/live?table=${encodeURIComponent(table)}`);
    es.onmessage = soon;
    const t = window.setInterval(refresh, 30000);
    const onVis = () => document.visibilityState === "visible" && soon();
    document.addEventListener("visibilitychange", onVis);
    return () => { es.close(); window.clearInterval(t); window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  async function submitOrder() {
    if (count === 0) return;
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      const ord = await placeOrderAction(table, items, { note: note.trim(), phone });
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
      flash(`سفارش شماره ${toFa(ord.number)} ثبت شد`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  }

  async function openBill() {
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
      const r = await uploadReceiptAction(imageForm(blob, { table }));
      flash(r.reused ? "⚠️ این رسید قبلاً استفاده شده" : "رسید ارسال شد؛ منتظر تأیید صندوق");
      setBill(await billAction(table));
    } catch {
      flash("خطا در ارسال رسید");
    }
  }
  async function sendRequest(type: "waiter" | "invoice") {
    setReqSending(type);
    try {
      await requestAction(table, type);
      setReqOpen(false);
      flash(type === "waiter" ? "گارسون خبر شد ✅" : "درخواست فاکتور ثبت شد ✅");
    } finally {
      setReqSending(null);
    }
  }
  async function sendFeedback() {
    setFbSending(true);
    try {
      await feedbackAction({ table, orderId: myOrders[0]?.id, rating: fbRating, comment: fbComment });
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
    <div className="min-h-screen pb-28">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {logoIsImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumb(cafe.logo, 160)} alt="" className="size-10 rounded-2xl object-cover" />
            ) : (
              <span className="grid size-10 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-lg shadow-primary/25">
                {cafe.logo || <Coffee className="size-5" />}
              </span>
            )}
            <div className="leading-tight">
              <h1 className="text-lg font-extrabold tracking-tight">{cafe.name}</h1>
              <p className="text-[11px] text-muted-foreground">
                {cafe.tagline || "منوی دیجیتال"} · میز {toFa(table)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => openMobileMenu(true)} aria-label="منو">
              <MenuIcon />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setReqOpen(true)} aria-label="درخواست">
              <BellRing />
            </Button>
            {myOrders.length > 0 && (
              <button onClick={() => setStatusOpen(true)} className="relative grid size-10 place-items-center rounded-full bg-muted hover:bg-muted/70" aria-label="وضعیت سفارش">
                <ClipboardList className="size-5" />
                {activeOrders > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-green-600 px-1 text-[11px] font-bold text-white">{toFa(activeOrders)}</span>
                )}
              </button>
            )}
            <Button variant="ghost" size="icon" onClick={openBill} aria-label="صورتحساب"><ReceiptText /></Button>
            <ThemeToggle />
            <button onClick={() => setCartOpen(true)} className="relative grid size-10 place-items-center rounded-full bg-muted hover:bg-muted/70" aria-label="سبد خرید">
              <ShoppingBag className="size-5" />
              {count > 0 && (
                <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{toFa(count)}</motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* عنوان + انتخاب حالت نمایش */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 pb-1 pt-6">
        <h2 className="text-2xl font-black sm:text-3xl">منوی کامل</h2>
        <ViewToggle value={view} onChange={changeView} />
      </div>

      {/* نوار دسته‌ها: با کلیک به همان بخش می‌رود */}
      <div className="sticky top-[61px] z-30 bg-background/75 py-3 backdrop-blur-xl">
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4">
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
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                <span className="grid size-7 place-items-center overflow-hidden rounded-lg"><CatIcon icon={c.emoji} /></span>
                {c.name}
                <span className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
              </h3>
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

      {otp && <PhoneGate cafe={cafe} table={table} onVerified={setPhone} />}

      <PicksSheet
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
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
              <div className="text-sm"><span className="font-bold">{toFa(count)}</span><span className="text-muted-foreground"> کالا · </span><span className="font-extrabold text-primary">{money(total)}</span></div>
              <Button onClick={() => setCartOpen(true)} size="lg" className="rounded-full">مشاهدهٔ سبد</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* placed toast */}
      <AnimatePresence>
        {placed !== null && (
          <motion.button initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setPlaced(null); setStatusOpen(true); }} className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xl">
            <CheckCircle2 className="size-5 text-green-500" /> سفارش #{toFa(placed)} ثبت شد — پیگیری وضعیت
          </motion.button>
        )}
      </AnimatePresence>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onReceiptFile} />

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
              <Button size="lg" className="flex-1 rounded-xl" onClick={submitOrder} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : "ثبت سفارش"}</Button>
            </div>
          </>
        )}
      </Drawer>

      <Drawer open={reqOpen} onClose={() => setReqOpen(false)} title="درخواست">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => sendRequest("waiter")} disabled={reqSending !== null} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/40 p-5 font-bold transition hover:bg-muted disabled:opacity-60">
            {reqSending === "waiter" ? <Loader2 className="size-7 animate-spin" /> : <BellRing className="size-7 text-accent" />} صدا زدن گارسون
          </button>
          <button onClick={() => sendRequest("invoice")} disabled={reqSending !== null} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/40 p-5 font-bold transition hover:bg-muted disabled:opacity-60">
            {reqSending === "invoice" ? <Loader2 className="size-7 animate-spin" /> : <ReceiptText className="size-7 text-primary" />} درخواست فاکتور
          </button>
        </div>
      </Drawer>

      <Drawer open={statusOpen} onClose={() => setStatusOpen(false)} title="وضعیت سفارش">
        {myOrders.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">هنوز سفارشی ثبت نکرده‌ای.</p>
        ) : (
          <div className="space-y-4">
            {myOrders.map((o) => <OrderTracker key={o.id} order={o} money={money} />)}
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
            {bill.payStatus === "pending" && <div className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-600 dark:text-amber-400">رسید ارسال شد؛ در انتظار تأیید صندوق.</div>}
            {bill.payStatus === "rejected" && <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-center text-sm text-primary">فیش قبلی رد شد{bill.rejectedReason ? `: ${bill.rejectedReason}` : ""}. دوباره پرداخت کن.</div>}
            {(payment.card || payment.link || payment.holder) && (
              <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 text-sm">
                <div className="mb-1.5 font-bold">اطلاعات پرداخت</div>
                {payment.card && (
                  <div className="flex items-center justify-between gap-2">
                    <span dir="ltr" className="font-mono tracking-wider">{toFa(payment.card)}</span>
                    <button onClick={() => navigator.clipboard?.writeText(payment.card).then(() => flash("شماره کارت کپی شد")).catch(() => {})} className="shrink-0 rounded-lg bg-card px-2 py-1 text-xs font-semibold text-primary">کپی</button>
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

function OrderTracker({ order, money }: { order: Order; money: (n: number) => string }) {
  const cancelled = order.status === "cancelled";
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
