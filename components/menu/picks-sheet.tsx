"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type Lenis from "lenis";
import { Sparkles, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/menu/menu-modes";
import { thumb, num } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

/** Full-screen "Barista's picks" panel — opened from the hero button or the side menu */
export function PicksSheet({
  open,
  onClose,
  items,
  money,
  qtyOf,
  onAdd,
  onDec,
  onImage,
  count,
  total,
  onCart,
  onMenu,
  title = "Barista's picks",
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  money: (n: number) => string;
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onImage: (item: MenuItem) => void;
  count: number;
  total: number;
  onCart: () => void;
  onMenu: () => void;
  title?: string;
}) {
  // Pause background page scrolling (Lenis) while the panel is open
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    if (!open) return;
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div aria-hidden className="cf-stage fixed inset-0 -z-10 !rounded-none !shadow-none" />
          <div aria-hidden className="cf-dots fixed inset-0 -z-10" />
          <PicksBody
            title={title}
            items={items}
            money={money}
            qtyOf={qtyOf}
            onAdd={onAdd}
            onDec={onDec}
            onImage={onImage}
            onClose={onClose}
            onMenu={onMenu}
          />
          <AnimatePresence>
            {count > 0 && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="sticky bottom-0 mt-auto border-t border-border/60 bg-background/80 backdrop-blur-xl"
              >
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm">
                    <span className="font-bold">{num(count)}</span>
                    <span className="text-muted-foreground"> {count === 1 ? "item" : "items"} · </span>
                    <span className="font-extrabold text-primary">{money(total)}</span>
                  </div>
                  <Button size="lg" className="rounded-full" onClick={onCart}>
                    <ShoppingBag className="size-4" /> View cart
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PicksBody({
  title,
  items,
  money,
  qtyOf,
  onAdd,
  onDec,
  onImage,
  onClose,
  onMenu,
}: {
  title: string;
  items: MenuItem[];
  money: (n: number) => string;
  qtyOf: (id: string) => number;
  onAdd: (id: string) => void;
  onDec: (id: string) => void;
  onImage: (item: MenuItem) => void;
  onClose: () => void;
  onMenu: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  // Staggered card entrance with GSAP
  useGSAP(
    () => {
      gsap.from(".pick-card", { y: 60, opacity: 0, rotateX: -12, duration: 0.8, stagger: 0.08, ease: "power3.out", delay: 0.1 });
      gsap.from(".pick-head > *", { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:pt-8">
      <div className="mb-2 flex justify-end">
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full border border-black/5 bg-white/80 text-stone-800 shadow-lg shadow-black/10 backdrop-blur transition hover:bg-primary hover:text-white dark:border-white/15 dark:bg-white/10 dark:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <header className="pick-head mb-8 text-center">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
          <Sparkles className="size-3.5" /> Our signature
        </span>
        <h2 className="text-4xl font-black sm:text-5xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">A few crowd favorites you'll love — add them to your cart right here.</p>
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No picks yet.</p>
      ) : (
        <div
          className="-mx-4 -mb-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-16 [scrollbar-width:none] sm:mx-0 sm:mb-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-8 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
          style={{ perspective: 1200 }}
        >
          {items.map((d) => {
            const qty = qtyOf(d.id);
            return (
              <article
                key={d.id}
                className="pick-card group relative flex w-[78vw] max-w-[340px] shrink-0 snap-center flex-col overflow-hidden rounded-[26px] border border-black/5 bg-card shadow-[0_30px_60px_-28px_rgba(92,52,25,.55)] sm:w-auto sm:max-w-none dark:border-white/10 dark:shadow-[0_30px_60px_-24px_rgba(0,0,0,.7)]"
              >
                <button
                  onClick={() => d.image && onImage(d)}
                  className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#f3d9b8,#d39a68_50%,#7b4a2b)] sm:aspect-[4/3.6]"
                  aria-label={d.name}
                >
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb(d.image, 720)} alt={d.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
                  ) : (
                    <span className="text-[7rem] drop-shadow-xl transition duration-500 group-hover:scale-110">{d.emoji || "☕"}</span>
                  )}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
                  {d.tag && (
                    <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">{d.tag}</span>
                  )}
                  <span className="absolute bottom-3 left-4 rounded-full bg-white/90 px-3 py-1 text-sm font-black text-stone-900 shadow">
                    {d.oldPrice && d.oldPrice > d.price && <s className="me-1.5 text-xs font-medium opacity-50">{money(d.oldPrice)}</s>}
                    {money(d.price)}
                  </span>
                </button>
                <div className="flex flex-1 items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-extrabold">{d.name}</h3>
                    {d.desc && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.desc}</p>}
                  </div>
                  <Stepper qty={qty} onAdd={() => onAdd(d.id)} onDec={() => onDec(d.id)} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-2 text-center">
        <Button variant="outline" className="rounded-full bg-card/70 px-6 backdrop-blur" onClick={onMenu}>
          See the full menu
        </Button>
      </div>
    </div>
  );
}
