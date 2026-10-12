"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronLeft, ChevronRight, GalleryHorizontalEnd, LayoutGrid,
  List as ListIcon, Minus, Plus, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, thumb, toFa } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

export type ViewMode = "carousel" | "grid" | "list";

/* ---------- انتخاب حالت نمایش ---------- */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "carousel", label: "کاروسل", icon: <GalleryHorizontalEnd className="size-4" /> },
    { id: "grid", label: "شبکه‌ای", icon: <LayoutGrid className="size-4" /> },
    { id: "list", label: "لیستی", icon: <ListIcon className="size-4" /> },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm" role="radiogroup" aria-label="حالت نمایش منو">
      {opts.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
            value === o.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- کنترل تعداد ---------- */
export function Stepper({ qty, onAdd, onDec, dark }: { qty: number; onAdd: () => void; onDec: () => void; dark?: boolean }) {
  if (qty === 0) {
    return (
      <Button size="icon" className="size-9 rounded-full" onClick={(e) => { e.stopPropagation(); onAdd(); }} aria-label="افزودن">
        <Plus />
      </Button>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 rounded-full p-1", dark ? "bg-white/15" : "bg-muted")} onClick={(e) => e.stopPropagation()}>
      <button onClick={onAdd} className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="بیشتر">
        <Plus className="size-4" />
      </button>
      <span className={cn("min-w-5 text-center text-sm font-bold", dark && "text-white")}>{toFa(qty)}</span>
      <button onClick={onDec} className={cn("grid size-7 place-items-center rounded-full", dark ? "bg-white/90 text-black" : "bg-card")} aria-label="کمتر">
        <Minus className="size-4" />
      </button>
    </div>
  );
}

function Price({ item, money, className }: { item: MenuItem; money: (n: number) => string; className?: string }) {
  const onSale = item.oldPrice && item.oldPrice > item.price;
  return (
    <span className={cn("leading-tight", className)}>
      {onSale && <s className="me-1.5 text-[0.8em] font-medium opacity-60">{money(item.oldPrice!)}</s>}
      {money(item.price)}
    </span>
  );
}

interface ItemActions {
  money: (n: number) => string;
  cafeName: string;
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onImage: (item: MenuItem) => void;
  onShare: (item: MenuItem) => void;
}

const ARROW =
  "absolute top-1/2 z-40 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-black/5 bg-white/80 text-stone-800 shadow-lg shadow-black/10 backdrop-blur transition hover:bg-primary hover:text-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:shadow-black/30";

/* =====================================================================
   حالت ۱: کاروسل سه‌بعدی (کارت وسط بزرگ، کناری‌ها کج و محو)
   ===================================================================== */
export function CoverflowCarousel({ items, ...a }: { items: MenuItem[] } & ItemActions) {
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const [cw, setCw] = useState(300);
  const probe = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);
  const total = items.length;

  useEffect(() => {
    const measure = () => setCw(probe.current?.offsetWidth || 300);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // پخش خودکار؛ روی هاور یا لمس متوقف می‌شود
  useEffect(() => {
    if (hover || total < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [hover, total]);

  const go = (n: number) => setIdx(((n % total) + total) % total);
  const d1 = Math.round(cw * 0.72);
  const d2 = Math.round(cw * 1.28);
  const current = items[idx];

  function pose(i: number) {
    const off = (i - idx + total) % total;
    if (off === 0) return { x: 0, s: 1, ry: 0, op: 1, z: 30, f: "none" };
    if (off === 1) return { x: d1, s: 0.82, ry: -26, op: 0.8, z: 20, f: "saturate(.85) brightness(.9)" };
    if (off === total - 1) return { x: -d1, s: 0.82, ry: 26, op: 0.8, z: 20, f: "saturate(.85) brightness(.9)" };
    if (off === 2) return { x: d2, s: 0.66, ry: -40, op: 0.45, z: 10, f: "saturate(.7) brightness(.85) blur(1.5px)" };
    if (off === total - 2) return { x: -d2, s: 0.66, ry: 40, op: 0.45, z: 10, f: "saturate(.7) brightness(.85) blur(1.5px)" };
    return { x: 0, s: 0.4, ry: 0, op: 0, z: 0, f: "none" };
  }

  return (
    <div
      className="cf-stage relative isolate overflow-hidden rounded-[28px] pb-5 pt-6"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* پس‌زمینهٔ محوِ عکسِ کارت وسط */}
      {current?.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={thumb(current.image, 160)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-[-12%] -z-10 size-[124%] scale-110 object-cover transition-opacity duration-700"
          style={{ opacity: "var(--cf-ambient-opacity)", filter: "var(--cf-ambient-filter)" }}
        />
      )}
      <div aria-hidden className="cf-dots pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="cf-vignette pointer-events-none absolute inset-0 -z-10" />

      <div
        dir="ltr"
        className="relative flex h-[440px] items-center justify-center sm:h-[500px]"
        style={{ perspective: 1500 }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setHover(true); }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 45) go(dx < 0 ? idx + 1 : idx - 1);
          setHover(false);
        }}
      >
        {/* هالهٔ نورِ کاراملی پشت کارت وسط + سایهٔ «زمین» زیرش */}
        <div className="pointer-events-none absolute size-[360px] rounded-full blur-2xl" style={{ background: "radial-gradient(circle, rgba(214,150,88,.42), rgba(225,29,42,.1) 45%, transparent 70%)" }} />
        <div className="cf-floor pointer-events-none absolute bottom-1 h-10 w-[min(420px,90%)] sm:bottom-2" />
        {/* اندازه‌گیری عرض کارت */}
        <div ref={probe} aria-hidden className="pointer-events-none invisible absolute h-0 w-[min(290px,72vw)]" />

        {items.map((it, i) => {
          const p = pose(i);
          const on = p.z === 30;
          const qty = a.qtyOf(it.id);
          return (
            <article
              key={it.id}
              onClick={() => (on ? it.image && a.onImage(it) : go(i))}
              className={cn(
                "absolute h-[410px] w-[min(290px,72vw)] overflow-hidden rounded-[24px] bg-[#3b2618] will-change-transform sm:h-[468px]",
                on ? "cursor-zoom-in" : "cursor-pointer"
              )}
              style={{
                transform: `translateX(${p.x}px) scale(${p.s}) rotateY(${p.ry}deg)`,
                opacity: p.op,
                zIndex: p.z,
                filter: p.f,
                transition: "transform 820ms cubic-bezier(.22,1,.36,1), opacity 820ms ease, filter 820ms ease",
                boxShadow: on ? "var(--cf-shadow-on)" : "var(--cf-shadow)",
              }}
            >
              {it.image && p.op > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(it.image, 720)} alt={it.name} loading="lazy" decoding="async" className={cn("absolute inset-0 size-full object-cover transition-transform duration-[7s]", on ? "scale-110" : "scale-[1.02]")} />
              ) : it.image ? (
                <div className="absolute inset-0 bg-[#3b2618]" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_32%,#f3d9b8,#d39a68_45%,#7b4a2b)] pb-24 text-8xl drop-shadow-xl">{it.emoji || "🍽️"}</div>
              )}
              {it.image && (
                <span className="pointer-events-none absolute inset-0 grid -rotate-[20deg] place-items-center text-xl font-bold text-white/15">{a.cafeName}</span>
              )}
              <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 22%), linear-gradient(180deg, rgba(0,0,0,.3) 0%, rgba(0,0,0,.04) 30%, rgba(43,24,13,.6) 62%, rgba(30,17,10,.95) 100%)" }} />
              {it.oldPrice && it.oldPrice > it.price && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-br from-primary to-red-800 px-3 py-1 text-[11px] font-extrabold text-white shadow">تخفیف</span>
              )}

              <div dir="rtl" className={cn("absolute inset-0 z-10 flex flex-col justify-end p-4 pb-5 text-center transition-all duration-500", on ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
                <button
                  onClick={(e) => { e.stopPropagation(); a.onShare(it); }}
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur"
                  aria-label="اشتراک‌گذاری"
                >
                  <Share2 className="size-4" />
                </button>
                <h3 className="text-2xl font-black leading-tight text-white drop-shadow-lg">{it.name}</h3>
                <span className="mx-auto my-2 h-[3px] w-12 rounded bg-gradient-to-r from-transparent via-primary to-transparent" />
                {it.desc && <p className="mx-auto mb-3 line-clamp-2 max-w-[250px] text-sm text-white/85">{it.desc}</p>}
                <div className="mx-auto flex items-center gap-3 rounded-full border border-white/15 bg-white/10 py-1.5 pe-1.5 ps-4 backdrop-blur-md">
                  <Price item={it} money={a.money} className="text-[15px] font-extrabold text-white" />
                  <Stepper qty={qty} onAdd={() => a.onAdd(it.id)} onDec={() => a.onDec(it.id)} dark />
                </div>
              </div>
            </article>
          );
        })}

        {total > 1 && (
          <>
            <button onClick={() => go(idx - 1)} aria-label="قبلی" className={ARROW + " left-3"}>
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => go(idx + 1)} aria-label="بعدی" className={ARROW + " right-3"}>
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2" dir="ltr">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`اسلاید ${i + 1}`}
              className={cn("h-[7px] rounded-full transition-all", i === idx ? "w-7 bg-primary shadow-[0_0_12px_rgba(225,29,42,.55)]" : "w-[7px] bg-[var(--cf-dot)] hover:bg-primary/50")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   حالت ۲: شبکه‌ای (کارت‌ها)
   ===================================================================== */
export function GridCard({ item, index, ...a }: { item: MenuItem; index: number } & ItemActions) {
  const qty = a.qtyOf(item.id);
  return (
    <motion.article
      // ورودِ کارت با CSS (بدون انتظار برای جاوااسکریپت)؛ هاور با framer
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
      whileHover={{ y: -4 }}
      className="rise group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <button
        className={cn("relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-gradient-to-br from-muted to-card", item.image && "cursor-zoom-in")}
        onClick={() => item.image && a.onImage(item)}
        aria-label={item.image ? `بزرگ‌نمایی عکس ${item.name}` : item.name}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb(item.image, 480)} alt={item.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span className="text-6xl transition group-hover:scale-110">{item.emoji}</span>
        )}
        {item.image && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-black text-white/15">{a.cafeName}</span>}
        {item.tag && <span className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{item.tag}</span>}
        {item.oldPrice && item.oldPrice > item.price && <span className="absolute left-2 top-2 rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-bold text-white">تخفیف</span>}
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold leading-tight">{item.name}</h4>
          <button onClick={() => a.onShare(item)} className="shrink-0 text-muted-foreground hover:text-primary" aria-label="اشتراک‌گذاری">
            <Share2 className="size-4" />
          </button>
        </div>
        {item.desc && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.desc}</p>}
        <div className="mt-3 flex items-center justify-between">
          <Price item={item} money={a.money} className="text-sm font-extrabold text-primary" />
          <Stepper qty={qty} onAdd={() => a.onAdd(item.id)} onDec={() => a.onDec(item.id)} />
        </div>
      </div>
    </motion.article>
  );
}

/* =====================================================================
   حالت ۳: لیستی (ردیف؛ با کلیک زیرش باز می‌شود و عکس را نشان می‌دهد)
   ===================================================================== */
export function ListRow({ item, ...a }: { item: MenuItem } & ItemActions) {
  const [open, setOpen] = useState(false);
  const qty = a.qtyOf(item.id);
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-shadow", open ? "border-primary/30 shadow-md" : "border-border shadow-sm")}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-right">
        <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
        {qty > 0 && <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{toFa(qty)}</span>}
        <Price item={item} money={a.money} className="shrink-0 text-sm font-extrabold text-primary" />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); a.onShare(item); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); a.onShare(item); } }}
          className="shrink-0 text-muted-foreground hover:text-primary"
          aria-label="اشتراک‌گذاری"
        >
          <Share2 className="size-4" />
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "animate-bounce")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-border/70 p-3">
              <button
                onClick={() => item.image && a.onImage(item)}
                className={cn("relative grid aspect-[16/10] w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-muted to-card", item.image && "cursor-zoom-in")}
                aria-label={item.image ? `بزرگ‌نمایی عکس ${item.name}` : item.name}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(item.image, 720)} alt={item.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="text-7xl">{item.emoji || "🍽️"}</span>
                )}
                {item.image && <span className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-black text-white/15">{a.cafeName}</span>}
              </button>
              {item.desc && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.desc}</p>}
              <div className="mt-3 flex items-center justify-between">
                <Price item={item} money={a.money} className="font-extrabold text-primary" />
                <Stepper qty={qty} onAdd={() => a.onAdd(item.id)} onDec={() => a.onDec(item.id)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
