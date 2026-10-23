"use client";

import { useEffect, useState } from "react";
import {
  CakeSlice, Check, ChevronDown, Coffee, Croissant, CupSoda, GalleryHorizontalEnd, IceCreamCone, LayoutGrid,
  List as ListIcon, Plus, Share2, type LucideIcon,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { SiteContent } from "@/lib/site-content";

/**
 * Showcases the three menu display modes on the home page: pick a mode (or autoplay) with a live phone preview.
 * The previews are miniature versions of the real menu's 3D carousel, grid and list.
 */
const MODES: { id: "carousel" | "grid" | "list"; icon: LucideIcon; short: string }[] = [
  { id: "carousel", icon: GalleryHorizontalEnd, short: "Carousel" },
  { id: "grid", icon: LayoutGrid, short: "Grid" },
  { id: "list", icon: ListIcon, short: "List" },
];
const AUTOPLAY_MS = 5000;

const DISHES: { name: string; price: number; icon: LucideIcon; tone: string; desc: string }[] = [
  { name: "Cappuccino", price: 4.5, icon: Coffee, tone: "from-amber-200 to-orange-500", desc: "Double espresso with velvety milk foam" },
  { name: "Cheesecake", price: 6, icon: CakeSlice, tone: "from-rose-200 to-pink-500", desc: "New York cheesecake with strawberry sauce" },
  { name: "Mojito", price: 5.5, icon: CupSoda, tone: "from-lime-200 to-emerald-500", desc: "Lime, fresh mint and soda" },
  { name: "Croissant", price: 3.75, icon: Croissant, tone: "from-yellow-100 to-amber-500", desc: "Buttery and fresh, baked every morning" },
  { name: "Ice cream", price: 4.95, icon: IceCreamCone, tone: "from-sky-200 to-indigo-400", desc: "Three scoops with your choice of toppings" },
  { name: "Latte", price: 4.75, icon: Coffee, tone: "from-orange-100 to-amber-700", desc: "Espresso with steamed milk" },
];

export function MenuModesShowcase({ v, cafeName }: { v: SiteContent["views"]; cafeName: string }) {
  const [mode, setMode] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const auto = !reduced && !paused;
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => setMode((m) => (m + 1) % MODES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [auto, mode]);

  const items = MODES.map((m, i) => ({ ...m, title: v.items[i]?.title || m.short, text: v.items[i]?.text || "" }));
  const active = items[mode];

  return (
    <div
      className="mt-10 grid items-center gap-x-16 gap-y-6 sm:mt-14 lg:grid-cols-[1fr_auto]"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      {/* Mode picker: three side-by-side buttons on mobile, three descriptive cards on desktop */}
      <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
        <div role="tablist" aria-label="Menu display modes" className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
          {items.map((m, i) => {
            const on = i === mode;
            return (
              <button
                key={m.id} type="button" role="tab" aria-selected={on} onClick={() => setMode(i)}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 text-center transition-[border-color,background-color,box-shadow] duration-300 lg:flex-row lg:items-start lg:gap-4 lg:rounded-3xl lg:p-5 lg:text-start",
                  on ? "border-primary/40 bg-card shadow-xl shadow-primary/10" : "border-border bg-card/60 hover:border-primary/25 hover:bg-card",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 lg:size-12 lg:rounded-2xl", on ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-primary/10 text-primary")}>
                  <m.icon className="size-5 lg:size-6" />
                </span>
                <span className="min-w-0">
                  <b className="block text-xs font-extrabold sm:text-sm lg:text-lg">{m.title}</b>
                  {m.text && <span className="mt-1 hidden text-sm leading-7 text-muted-foreground lg:block">{m.text}</span>}
                </span>
                {/* Autoplay progress bar */}
                {on && auto && <span key={mode} aria-hidden className="mm-progress absolute inset-x-0 bottom-0 h-[3px] origin-left bg-primary" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live phone preview (mobile: between the buttons and the description) */}
      <div className="relative mx-auto lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-hidden>
        <div className="absolute inset-x-6 bottom-6 top-10 -z-10 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative w-[16.5rem] rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/30 ring-1 ring-black/5 sm:w-[17.5rem]">
          <div className="absolute left-1/2 top-3.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="relative h-[31rem] overflow-hidden rounded-[2.2rem] bg-stone-50 text-slate-900 sm:h-[33rem]">
            <div className="flex items-center justify-between px-4 pb-2 pt-9">
              <b className="text-sm">{cafeName}</b>
              <span className="flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                {MODES.map((m, i) => (
                  <span key={m.id} className={cn("grid size-6 place-items-center rounded-full transition-colors duration-300", i === mode ? "bg-primary text-white" : "text-slate-400")}>
                    <m.icon className="size-3.5" />
                  </span>
                ))}
              </span>
            </div>
            <div className="flex gap-1.5 px-4 pb-3 text-[10px] font-bold">
              {["All", "Drinks", "Cakes", "Breakfast"].map((x, i) => (
                <span key={x} className={i === 0 ? "rounded-full bg-primary px-2.5 py-1 text-white" : "rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-600"}>{x}</span>
              ))}
            </div>
            <div className="relative h-[calc(100%-5.75rem)]">
              <Layer on={mode === 0}><MiniCarousel run={mode === 0 && !reduced} name={cafeName} /></Layer>
              <Layer on={mode === 1}><MiniGrid /></Layer>
              <Layer on={mode === 2}><MiniList run={mode === 2 && !reduced} /></Layer>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
        {active.text && <p className="min-h-14 text-center text-sm leading-7 text-muted-foreground lg:hidden" aria-live="polite">{active.text}</p>}
        {v.bullets.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-2 lg:mt-8 lg:justify-start">
            {v.bullets.map((b) => (
              <li key={b} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold sm:text-sm"><Check className="size-3.5 text-primary" /> {b}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Layer({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("absolute inset-0 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none", on ? "opacity-100" : "pointer-events-none translate-y-3 scale-[0.97] opacity-0")}>
      {children}
    </div>
  );
}

function Tile({ d, className, iconClass = "size-8" }: { d: (typeof DISHES)[number]; className?: string; iconClass?: string }) {
  return (
    <span className={cn("grid place-items-center bg-gradient-to-br text-white", d.tone, className)}>
      <d.icon className={cn("drop-shadow", iconClass)} />
    </span>
  );
}

/** Mini 3D carousel: large center card, side cards angled and faded */
function MiniCarousel({ run, name }: { run: boolean; name: string }) {
  const n = 5;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % n), 1700);
    return () => window.clearInterval(t);
  }, [run]);
  const pose = (i: number) => {
    const off = (i - idx + n) % n;
    if (off === 0) return { t: "translateX(0) scale(1) rotateY(0deg)", o: 1, z: 30, f: "none" };
    // LTR: the next card waits on the right, the previous one on the left
    if (off === 1) return { t: "translateX(118px) scale(.8) rotateY(-28deg)", o: 0.75, z: 20, f: "brightness(.9)" };
    if (off === n - 1) return { t: "translateX(-118px) scale(.8) rotateY(28deg)", o: 0.75, z: 20, f: "brightness(.9)" };
    return { t: "translateX(0) scale(.5)", o: 0, z: 0, f: "none" };
  };
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center" style={{ perspective: 900 }}>
        {DISHES.slice(0, n).map((d, i) => {
          const p = pose(i);
          return (
            <div key={d.name} className="absolute h-[19rem] w-[10.5rem] overflow-hidden rounded-[1.4rem] shadow-xl shadow-black/25 sm:h-[20.5rem] sm:w-[11rem]"
              style={{ transform: p.t, opacity: p.o, zIndex: p.z, filter: p.f, transition: "transform 800ms cubic-bezier(.22,1,.36,1), opacity 800ms ease, filter 800ms ease" }}>
              <Tile d={d} className="absolute inset-0 pb-20" iconClass="size-16" />
              <span className="absolute inset-0 grid -rotate-[20deg] place-items-center text-xs font-bold text-white/25">{name}</span>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
              <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-black/30 text-white backdrop-blur"><Share2 className="size-3" /></span>
              <div className="absolute inset-x-0 bottom-0 p-3 text-center text-white">
                <b className="block text-base font-black">{d.name}</b>
                <span className="mx-auto my-1.5 block h-[2px] w-8 rounded bg-white/70" />
                <span className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/15 py-1 pe-1 ps-3 text-[11px] font-extrabold backdrop-blur">
                  {formatMoney(d.price, "USD")}<span className="grid size-5 place-items-center rounded-full bg-primary"><Plus className="size-3" /></span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-1.5 pb-5">
        {Array.from({ length: n }, (_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all duration-500", i === idx ? "w-5 bg-primary" : "w-1.5 bg-slate-300")} />)}
      </div>
    </div>
  );
}

/** Two-column grid of image cards */
function MiniGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 px-3">
      {DISHES.map((d) => (
        <div key={d.name} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <Tile d={d} className="aspect-[4/3.4]" iconClass="size-9" />
          <div className="p-2">
            <b className="block text-[11px]">{d.name}</b>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-primary">{formatMoney(d.price, "USD")}</span>
              <span className="grid size-5 place-items-center rounded-full bg-primary text-white"><Plus className="size-3" /></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact list; one row expands to show the image and description */
function MiniList({ run }: { run: boolean }) {
  const [open, setOpen] = useState(1);
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => setOpen((o) => (o + 1) % 4), 1800);
    return () => window.clearInterval(t);
  }, [run]);
  return (
    <div className="space-y-1.5 px-3">
      {DISHES.slice(0, 5).map((d, i) => {
        const on = i === open;
        return (
          <div key={d.name} className={cn("overflow-hidden rounded-xl border bg-white transition-shadow duration-300", on ? "border-primary/30 shadow-md" : "border-slate-200/80 shadow-sm")}>
            <div className="flex items-center gap-2 px-3 py-2.5 text-[11px]">
              <b className="flex-1">{d.name}</b>
              <span className="font-extrabold text-primary">{formatMoney(d.price, "USD")}</span>
              <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform duration-300", on && "rotate-180")} />
            </div>
            <div className={cn("grid transition-[grid-template-rows] duration-500 ease-out", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <div className="border-t border-slate-100 p-2">
                  <Tile d={d} className="aspect-[16/8] rounded-lg" iconClass="size-9" />
                  <p className="mt-1.5 text-[10px] leading-5 text-slate-500">{d.desc}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
