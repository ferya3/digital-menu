import { useEffect, useMemo, useRef, useState } from "react";
import {
  Moon,
  Sun,
  ShoppingCart,
  Plus,
  Minus,
  LayoutGrid,
  List as ListIcon,
  GalleryHorizontalEnd,
  ChevronDown,
  X,
  Coffee,
  Trash2,
  ReceiptText,
  Upload,
  Loader2,
  CheckCircle2,
  ClipboardList,
  Check,
  BellRing,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverFlowCarousel } from "@/components/ui/3-d-coverflow-carousel";
import { cn } from "@/lib/utils";
import type { Dish } from "@/data";
import {
  fetchMenu,
  createOrder,
  fetchBill,
  fetchOrder,
  uploadTableReceipt,
  createRequest,
  fetchSettings,
  submitFeedback,
  formatMoney,
  type Bill,
  type PublicSettings,
} from "@/api";
import {
  connectTable,
  STATUS_STEPS,
  STATUS_FA,
  STATUS_SHORT,
  type ServerOrder,
} from "@/socket";

/* ---------- helpers ---------- */
const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) =>
  String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
// واحد پول از تنظیمات خوانده می‌شود (قیمت‌ها بر پایهٔ تومان ذخیره می‌شوند)
let CURRENCY: "toman" | "rial" = "toman";
const money = (n: number) => formatMoney(n, CURRENCY);

type ViewMode = "coverflow" | "grid" | "list";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- app ---------- */
export default function App() {
  const table = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("table") || "1";
    } catch {
      return "1";
    }
  }, []);

  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );
  const [view, setView] = useState<ViewMode>("coverflow");
  const [cat, setCat] = useState<string>("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // menu (from server, with local fallback)
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  // feedback
  const [fbOrder, setFbOrder] = useState<string | null>(null);
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState("");
  const [fbSending, setFbSending] = useState(false);

  // ordering + bill
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [toast, setToast] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // live order tracking (Phase 3)
  const [myOrders, setMyOrders] = useState<ServerOrder[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqSending, setReqSending] = useState<"waiter" | "invoice" | null>(null);
  const billOpenRef = useRef(false);
  billOpenRef.current = billOpen;
  const myOrdersRef = useRef<ServerOrder[]>([]);
  myOrdersRef.current = myOrders;
  const ordersKey = "cafe_orders_" + table;

  useEffect(() => {
    fetchMenu().then((m) => {
      setCats(m.categories);
      setAllDishes(m.dishes);
      setOnline(m.online);
      setLoading(false);
    });
    fetchSettings()
      .then((s) => {
        CURRENCY = s.currency || "toman";
        setSettings(s);
      })
      .catch(() => {});
  }, []);

  const cafeName = settings?.cafe?.name || "کافه";
  const cafeLogo = settings?.cafe?.logo || "";
  const payment = settings?.payment;

  async function sendFeedback() {
    if (!online) {
      flash("ثبت نظر با اتصال به سرور ممکن است.");
      return;
    }
    setFbSending(true);
    try {
      await submitFeedback({ table, orderId: fbOrder || undefined, rating: fbRating, comment: fbComment });
      setFbOrder(null);
      setFbComment("");
      setFbRating(5);
      flash("نظرت ثبت شد، ممنون 🙏");
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ثبت نظر");
    } finally {
      setFbSending(false);
    }
  }

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
  };

  const persistIds = (list: ServerOrder[]) => {
    try {
      localStorage.setItem(
        ordersKey,
        JSON.stringify(list.slice(0, 12).map((o) => o.id))
      );
    } catch {
      /* ignore */
    }
  };

  // real-time: rehydrate tracked orders + subscribe to live status updates
  useEffect(() => {
    if (!online) return;

    // rehydrate previously placed orders (survives refresh)
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(ordersKey) || "[]");
    } catch {
      ids = [];
    }
    if (ids.length) {
      Promise.all(ids.map((id) => fetchOrder(id).catch(() => null))).then(
        (list) => {
          const ok = list.filter(Boolean) as ServerOrder[];
          ok.sort((a, b) => b.number - a.number);
          setMyOrders(ok);
        }
      );
    }

    const socket = connectTable(table, (order) => {
      const prev = myOrdersRef.current.find((o) => o.id === order.id);
      if (!prev) return; // فقط سفارش‌های همین مشتری
      if (order.status === "ready" && prev.status !== "ready")
        flash("سفارش شما آماده است ✅");
      if (order.status === "served" && prev.status !== "served")
        flash("نوش جان! سفارش سرو شد");
      if (order.status === "cancelled" && prev.status !== "cancelled")
        flash("سفارش لغو شد");
      if (order.payStatus === "confirmed" && prev.payStatus !== "confirmed")
        flash("پرداخت شما تأیید شد ✅");
      if (order.payStatus === "rejected" && prev.payStatus !== "rejected")
        flash("فیش تأیید نشد — دوباره ارسال کن ❌");
      setMyOrders((l) => l.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
      if (billOpenRef.current) fetchBill(table).then(setBill).catch(() => {});
    }, () => {
      // منوی مدیر تغییر کرد → منو را زنده تازه کن
      fetchMenu().then((m) => {
        setCats(m.categories);
        setAllDishes(m.dishes);
      });
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, table]);

  const toggleDark = () => {
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
  };

  const TABS = useMemo(() => [{ id: "all", name: "همه" }, ...cats], [cats]);
  const dishes = useMemo(
    () => (cat === "all" ? allDishes : allDishes.filter((d) => d.category === cat)),
    [cat, allDishes]
  );

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id: string) =>
    setCart((c) => {
      const q = (c[id] || 0) - 1;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((sum, [id, q]) => {
    const d = allDishes.find((x) => x.id === id);
    return sum + (d ? d.price * q : 0);
  }, 0);
  const activeOrders = myOrders.filter(
    (o) => o.status !== "served" && o.status !== "cancelled"
  ).length;

  async function submitOrder() {
    if (count === 0) return;
    if (!online) {
      flash("حالت نمایشی است؛ برای ثبت واقعی سفارش، سرور را وصل کن.");
      return;
    }
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      const ord = await createOrder({ table, items });
      setMyOrders((l) => {
        const next = [ord, ...l.filter((o) => o.id !== ord.id)];
        persistIds(next);
        return next;
      });
      setCart({});
      setCartOpen(false);
      setPlaced(ord.number);
      flash(`سفارش شماره ${toFa(ord.number)} ثبت شد.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  }

  async function openBill() {
    if (!online) {
      flash("صورتحساب فقط با اتصال به سرور در دسترس است.");
      return;
    }
    setBillOpen(true);
    setBillLoading(true);
    try {
      setBill(await fetchBill(table));
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در دریافت صورتحساب");
      setBillOpen(false);
    } finally {
      setBillLoading(false);
    }
  }

  async function sendRequest(type: "waiter" | "invoice") {
    if (!online) {
      flash("درخواست فقط با اتصال به سرور کار می‌کند.");
      return;
    }
    setReqSending(type);
    try {
      await createRequest({ table, type });
      setReqOpen(false);
      flash(type === "waiter" ? "گارسون خبر شد ✅" : "درخواست فاکتور ثبت شد ✅");
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ثبت درخواست");
    } finally {
      setReqSending(null);
    }
  }

  async function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      await uploadTableReceipt(table, dataUrl);
      flash("رسید ارسال شد؛ منتظر تأیید صندوق.");
      setBill(await fetchBill(table));
    } catch (err) {
      flash(err instanceof Error ? err.message : "خطا در ارسال رسید");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {/^https?:|^data:|^\/images\//.test(cafeLogo) ? (
              <img src={cafeLogo} alt="" className="h-10 w-10 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-lg shadow-primary/25">
                {cafeLogo || <Coffee className="h-5 w-5" />}
              </span>
            )}
            <div className="leading-tight">
              <h1 className="text-lg font-extrabold tracking-tight">{cafeName}</h1>
              <p className="text-[11px] text-muted-foreground">
                {settings?.cafe?.tagline || "منوی دیجیتال"} · میز {toFa(table)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setReqOpen(true)} aria-label="درخواست">
              <BellRing className="h-5 w-5" />
            </Button>
            {myOrders.length > 0 && (
              <button
                onClick={() => setStatusOpen(true)}
                className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-muted"
                aria-label="وضعیت سفارش"
              >
                <ClipboardList className="h-5 w-5" />
                {activeOrders > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-green-600 px-1 text-[11px] font-bold text-white">
                    {toFa(activeOrders)}
                  </span>
                )}
              </button>
            )}
            <Button variant="ghost" size="icon" onClick={openBill} aria-label="صورتحساب">
              <ReceiptText className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="حالت شب">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <button
              onClick={() => setCartOpen(true)}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition hover:bg-muted"
              aria-label="سبد خرید"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {toFa(count)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* category tabs */}
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setCat(t.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition",
                cat === t.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </header>

      {/* offline / demo banner */}
      {!loading && !online && (
        <div className="mx-auto mt-3 max-w-5xl px-4">
          <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-center text-xs text-muted-foreground">
            حالت نمایشی — به سرور وصل نیست؛ داده‌ها نمونه‌اند.
          </div>
        </div>
      )}

      {/* ===== View switch ===== */}
      <div className="mx-auto mt-4 flex max-w-5xl items-center justify-center gap-1.5 px-4">
        <ViewBtn active={view === "coverflow"} onClick={() => setView("coverflow")} icon={<GalleryHorizontalEnd className="h-4 w-4" />} label="کاروسل" />
        <ViewBtn active={view === "grid"} onClick={() => setView("grid")} icon={<LayoutGrid className="h-4 w-4" />} label="شبکه‌ای" />
        <ViewBtn active={view === "list"} onClick={() => setView("list")} icon={<ListIcon className="h-4 w-4" />} label="لیستی" />
      </div>

      {/* ===== Body ===== */}
      <main className="mx-auto max-w-5xl px-4">
        {loading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : dishes.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">محصولی در این دسته نیست.</p>
        ) : (
          <>
            {view === "coverflow" && (
              <div className="mt-4 overflow-hidden rounded-3xl">
                <CoverFlowCarousel
                  key={cat}
                  items={dishes}
                  sectionLabel={TABS.find((t) => t.id === cat)?.name || "منو"}
                  onCtaClick={(item) => add((item as Dish).id)}
                />
              </div>
            )}

            {view === "grid" && (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {dishes.map((d) => (
                  <article key={d.id} className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:shadow-md">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img src={d.img} alt={d.titleLine1} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <span className="pointer-events-none absolute inset-0 grid place-items-center text-center text-white/10 text-lg font-black">
                        {cafeName}
                      </span>
                      {d.tag && (
                        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                          {d.tag}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold leading-tight">{d.titleLine1}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.desc}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="leading-tight">
                          <div className="text-sm font-extrabold text-primary">{money(d.price)}</div>
                          {d.oldPrice && (
                            <div className="text-[11px] text-muted-foreground line-through">{money(d.oldPrice)}</div>
                          )}
                        </div>
                        <Stepper qty={cart[d.id] || 0} onAdd={() => add(d.id)} onDec={() => dec(d.id)} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {view === "list" && (
              <div className="mt-5 space-y-3">
                {dishes.map((d) => {
                  const open = openItem === d.id;
                  return (
                    <article key={d.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                      <button onClick={() => setOpenItem(open ? null : d.id)} className="flex w-full items-center gap-3 p-3 text-right">
                        <img src={d.img} alt={d.titleLine1} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-bold">{d.titleLine1}</h3>
                          <div className="text-sm font-extrabold text-primary">{money(d.price)}</div>
                        </div>
                        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "animate-bounce")} />
                      </button>
                      {open && (
                        <div className="border-t border-border/70 p-3">
                          <p className="text-sm text-muted-foreground">{d.desc}</p>
                          <div className="mt-3 flex items-center justify-between">
                            {d.oldPrice ? (
                              <span className="text-xs text-muted-foreground line-through">{money(d.oldPrice)}</span>
                            ) : (
                              <span />
                            )}
                            <Stepper qty={cart[d.id] || 0} onAdd={() => add(d.id)} onDec={() => dec(d.id)} />
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== Bottom cart bar ===== */}
      {count > 0 && !cartOpen && !billOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm">
              <span className="font-bold">{toFa(count)}</span>
              <span className="text-muted-foreground"> کالا · </span>
              <span className="font-extrabold text-primary">{money(total)}</span>
            </div>
            <Button onClick={() => setCartOpen(true)} className="rounded-full px-6">
              مشاهده سبد خرید
            </Button>
          </div>
        </div>
      )}

      {/* ===== Cart drawer ===== */}
      {cartOpen && (
        <Drawer title="سبد خرید" onClose={() => setCartOpen(false)}>
          {count === 0 ? (
            <p className="py-10 text-center text-muted-foreground">سبد خرید خالی است.</p>
          ) : (
            <>
              <div className="space-y-3">
                {Object.entries(cart).map(([id, q]) => {
                  const d = allDishes.find((x) => x.id === id)!;
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <img src={d.img} alt={d.titleLine1} className="h-14 w-14 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{d.titleLine1}</div>
                        <div className="text-sm text-primary">{money(d.price)}</div>
                      </div>
                      <Stepper qty={q} onAdd={() => add(id)} onDec={() => dec(id)} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-muted-foreground">مجموع</span>
                <span className="text-xl font-black text-primary">{money(total)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="icon" onClick={() => setCart({})} aria-label="خالی کردن سبد">
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button className="h-11 flex-1 rounded-xl text-base" onClick={submitOrder} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "ثبت سفارش"}
                </Button>
              </div>
            </>
          )}
        </Drawer>
      )}

      {/* ===== Bill drawer (sum of all unpaid orders) ===== */}
      {billOpen && (
        <Drawer title="صورتحساب میز" onClose={() => setBillOpen(false)}>
          {billLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !bill || bill.count === 0 ? (
            <p className="py-10 text-center text-muted-foreground">صورتحساب بازی برای این میز نیست.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {toFa(bill.count)} سفارش پرداخت‌نشده روی این میز — همه با هم:
              </p>
              <div className="space-y-3">
                {bill.orders.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold">سفارش #{toFa(o.number)}</span>
                      <span className="text-sm font-extrabold text-primary">{money(o.total)}</span>
                    </div>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{it.name} × {toFa(it.qty)}</span>
                          <span>{money(it.price * it.qty)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-muted-foreground">جمع کل بدهی</span>
                <span className="text-2xl font-black text-primary">{money(bill.total)}</span>
              </div>

              {bill.payStatus === "pending" && (
                <div className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-600 dark:text-amber-400">
                  رسید ارسال شد؛ در انتظار تأیید صندوق.
                </div>
              )}
              {bill.payStatus === "rejected" && (
                <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-center text-sm text-primary">
                  رسید قبلی رد شد{bill.rejectedReason ? `: ${bill.rejectedReason}` : ""}. دوباره پرداخت کن.
                </div>
              )}

              {payment && (payment.card || payment.link || payment.holder) && (
                <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
                  <div className="mb-1.5 font-bold">اطلاعات پرداخت</div>
                  {payment.card && (
                    <div className="flex items-center justify-between gap-2">
                      <span dir="ltr" className="font-mono tracking-wider">{toFa(payment.card)}</span>
                      <button
                        onClick={() =>
                          navigator.clipboard?.writeText(String(payment.card)).then(() => flash("شماره کارت کپی شد")).catch(() => {})
                        }
                        className="shrink-0 rounded-lg bg-card px-2 py-1 text-xs font-semibold text-primary"
                      >
                        کپی
                      </button>
                    </div>
                  )}
                  {payment.holder && <div className="mt-0.5 text-xs text-muted-foreground">به نام {payment.holder}</div>}
                  {payment.note && <div className="mt-0.5 text-xs text-muted-foreground">{payment.note}</div>}
                  {payment.link && (
                    <a href={payment.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      پرداخت آنلاین ↗
                    </a>
                  )}
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickReceipt} />
              <Button className="mt-3 h-11 w-full rounded-xl text-base" onClick={() => fileRef.current?.click()}>
                <Upload className="h-5 w-5" />
                ارسال رسید پرداخت
              </Button>
            </>
          )}
        </Drawer>
      )}

      {/* ===== Request drawer (call waiter / ask invoice) ===== */}
      {reqOpen && (
        <Drawer title="درخواست" onClose={() => setReqOpen(false)}>
          <p className="mb-3 text-sm text-muted-foreground">چه کمکی از ما برمی‌آید؟</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => sendRequest("waiter")}
              disabled={reqSending !== null}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-secondary/50 p-5 font-bold transition hover:bg-muted disabled:opacity-60"
            >
              {reqSending === "waiter" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <BellRing className="h-7 w-7 text-amber-500" />
              )}
              صدا زدن گارسون
            </button>
            <button
              onClick={() => sendRequest("invoice")}
              disabled={reqSending !== null}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-secondary/50 p-5 font-bold transition hover:bg-muted disabled:opacity-60"
            >
              {reqSending === "invoice" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <ReceiptText className="h-7 w-7 text-primary" />
              )}
              درخواست فاکتور
            </button>
          </div>
        </Drawer>
      )}

      {/* ===== Live order status drawer (Phase 3) ===== */}
      {statusOpen && (
        <Drawer title="وضعیت سفارش" onClose={() => setStatusOpen(false)}>
          {myOrders.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">هنوز سفارشی ثبت نکرده‌ای.</p>
          ) : (
            <div className="space-y-4">
              {myOrders.map((o) => (
                <OrderTracker key={o.id} order={o} />
              ))}
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setFbOrder(myOrders[0]?.id || "")}>
                <Star className="h-4 w-4" /> ثبت نظر و امتیاز
              </Button>
              <p className="pt-1 text-center text-[11px] text-muted-foreground">
                وضعیت به‌صورت زنده به‌روزرسانی می‌شود.
              </p>
            </div>
          )}
        </Drawer>
      )}

      {/* ===== Feedback drawer ===== */}
      {fbOrder !== null && (
        <Drawer title="نظر و امتیاز" onClose={() => setFbOrder(null)}>
          <p className="mb-3 text-sm text-muted-foreground">تجربه‌ات از {cafeName} چطور بود؟</p>
          <div className="mb-4 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} onClick={() => setFbRating(i)} aria-label={`${i} ستاره`}>
                <Star className={cn("h-9 w-9 transition", i <= fbRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
              </button>
            ))}
          </div>
          <textarea
            value={fbComment}
            onChange={(e) => setFbComment(e.target.value)}
            placeholder="توضیح (اختیاری)…"
            className="min-h-[80px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button className="mt-3 h-11 w-full rounded-xl text-base" onClick={sendFeedback} disabled={fbSending}>
            {fbSending ? <Loader2 className="h-5 w-5 animate-spin" /> : "ثبت نظر"}
          </Button>
        </Drawer>
      )}

      {/* ===== order placed toast card ===== */}
      {placed !== null && (
        <button
          onClick={() => {
            setPlaced(null);
            setStatusOpen(true);
          }}
          className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xl"
          style={{ insetInline: 0, width: "fit-content" }}
        >
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          سفارش #{toFa(placed)} ثبت شد — پیگیری وضعیت
        </button>
      )}

      {/* ===== toast ===== */}
      {toast && (
        <div className="fixed inset-x-0 top-4 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-foreground px-5 py-2 text-center text-sm font-semibold text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- small components ---------- */
function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="max-h-[82vh] overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition",
        active ? "bg-foreground text-background shadow" : "bg-secondary text-secondary-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Stepper({
  qty,
  onAdd,
  onDec,
}: {
  qty: number;
  onAdd: () => void;
  onDec: () => void;
}) {
  if (qty === 0) {
    return (
      <Button size="icon" className="h-9 w-9 rounded-full" onClick={onAdd} aria-label="افزودن">
        <Plus className="h-5 w-5" />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
      <button onClick={onAdd} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="بیشتر">
        <Plus className="h-4 w-4" />
      </button>
      <span className="min-w-5 text-center text-sm font-bold">{toFa(qty)}</span>
      <button onClick={onDec} className="grid h-7 w-7 place-items-center rounded-full bg-card text-foreground" aria-label="کمتر">
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}

function OrderTracker({ order }: { order: ServerOrder }) {
  const cancelled = order.status === "cancelled";
  const idx = STATUS_STEPS.indexOf(order.status);
  const itemsText = order.items
    .map((it) => `${it.name}×${toFa(it.qty)}`)
    .join("، ");

  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">سفارش #{toFa(order.number)}</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-bold",
            cancelled
              ? "bg-primary/10 text-primary"
              : order.status === "ready"
              ? "bg-green-600/15 text-green-600 dark:text-green-400"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {STATUS_FA[order.status]}
        </span>
      </div>

      {!cancelled && (
        <div className="flex items-center">
          {STATUS_STEPS.map((s, i) => {
            const done = i <= idx;
            const active = i === idx;
            return (
              <div key={s} className="contents">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition",
                      done
                        ? "bg-green-600 text-white"
                        : "bg-secondary text-muted-foreground",
                      active && "ring-2 ring-green-600/40"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : toFa(i + 1)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      done ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {STATUS_SHORT[s]}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <span
                    className={cn(
                      "mx-1 mb-4 h-0.5 flex-1 rounded",
                      i < idx ? "bg-green-600" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{itemsText}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-extrabold text-primary">{money(order.total)}</span>
        {order.payStatus === "pending" && (
          <span className="text-xs text-amber-600 dark:text-amber-400">در انتظار تأیید صندوق ⏳</span>
        )}
        {order.payStatus === "confirmed" && (
          <span className="text-xs text-green-600 dark:text-green-400">پرداخت تأیید شد ✅</span>
        )}
        {order.payStatus === "rejected" && (
          <span className="text-xs text-primary">
            فیش رد شد{order.rejectedReason ? `: ${order.rejectedReason}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
