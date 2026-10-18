"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import { FeatureIcon } from "@/components/platform/feature-icon";
import type { FeatureItem } from "@/lib/site-content";

/**
 * دستهٔ کارت‌های امکانات: کارتِ فعال جلو می‌آید و همسایه‌ها کوچک و کج پشتش می‌مانند.
 * همه‌چیز از یک عدد می‌آید: فاصلهٔ علامت‌دارِ هر کارت تا کارتِ فعال، پیچیده در بازهٔ [−n/2، n/2).
 */
const AUTOPLAY_MS = 3400;

export function FeatureCarousel({ items, label }: { items: FeatureItem[]; label: string }) {
  const count = items.length;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [cw, setCw] = useState(300);
  const probe = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const touchX = useRef(0);
  const index = ((step % count) + count) % count;

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /** عرضِ کارت؛ فاصلهٔ کارت‌های کناری نسبتی از آن است */
  useEffect(() => {
    const measure = () => setCw(probe.current?.offsetWidth || 300);
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  /** هر بار از نو زمان‌بندی می‌شود: وقتی کاربر خودش جابه‌جا می‌کند، یک لحظه بعد زیرِ دستش جلو نرود */
  const schedule = useCallback(() => {
    window.clearInterval(timer.current);
    if (reduced || paused || count < 2) return;
    timer.current = window.setInterval(() => setStep((s) => s + 1), AUTOPLAY_MS);
  }, [reduced, paused, count]);
  useEffect(() => { schedule(); return () => window.clearInterval(timer.current); }, [schedule]);

  if (!count) return null;

  const offset = (i: number) => {
    const half = count / 2;
    return ((((i - index + half) % count) + count) % count) - half;
  };
  const move = (by: number) => { setStep((s) => s + by); schedule(); };
  const select = (i: number) => move(offset(i));
  const onKey = (e: React.KeyboardEvent) => {
    // راست‌به‌چپ: چپ = بعدی
    const by = ({ ArrowLeft: 1, ArrowRight: -1 } as Record<string, number>)[e.key];
    if (by === undefined) return;
    e.preventDefault();
    move(by);
  };

  const cardStyle = (i: number): React.CSSProperties => {
    const d = offset(i);
    const a = Math.abs(d);
    // راست‌به‌چپ: کارتِ بعدی از چپ می‌آید و قبلی سمتِ راست می‌ماند
    const x = -Math.sign(d) * (a === 1 ? cw * 0.62 : a === 2 ? cw * 1.08 : 0);
    const tilt = -Math.sign(d) * (a === 1 ? 4 : a === 2 ? 7 : 0);
    const scale = a === 0 ? 1 : a === 1 ? 0.84 : a === 2 ? 0.7 : 0.6;
    return {
      transform: `translateX(${x}px) rotate(${tilt}deg) scale(${scale})`,
      // کارت‌های پشتی مات می‌مانند (نه نیمه‌شفاف) تا لایه‌ها در هم دیده نشوند؛ تیرگی را لایهٔ سایهٔ داخلِ کارت می‌دهد
      opacity: a <= 2 ? 1 : 0,
      zIndex: 30 - a * 10,
      pointerEvents: a === 1 ? "auto" : "none",
    };
  };

  const ARROW = "grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors duration-200 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25";

  return (
    <div
      className="mt-10 sm:mt-14"
      role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={onKey}
    >
      <div
        className="relative -mx-4 flex h-[23rem] items-center justify-center overflow-hidden sm:mx-0 sm:h-[26rem]"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) move(dx < 0 ? -1 : 1);
          setPaused(false);
        }}
      >
        <div aria-hidden className="pointer-events-none absolute size-[26rem] rounded-full bg-primary/15 blur-[90px]" />
        <div ref={probe} aria-hidden className="pointer-events-none invisible absolute h-0 w-[min(19rem,74vw)] sm:w-[22rem]" />
        {items.map((f, i) => {
          const on = offset(i) === 0;
          return (
            <article
              key={i}
              aria-hidden={!on}
              onClick={() => !on && select(i)}
              className={cn("fc-card absolute h-[21rem] w-[min(19rem,74vw)] origin-center overflow-hidden rounded-[1.75rem] border-4 border-card bg-slate-950 text-white shadow-2xl shadow-black/25 sm:h-[24rem] sm:w-[22rem] sm:rounded-[2.25rem] sm:border-8", !on && "cursor-pointer")}
              style={cardStyle(i)}
            >
              <div aria-hidden className="absolute inset-0"
                style={{ background: `radial-gradient(80% 70% at ${30 + ((i * 23) % 40)}% 15%, hsl(var(--primary) / 0.6), transparent 70%), radial-gradient(60% 50% at 80% 95%, hsl(var(--primary) / 0.28), transparent 70%)` }} />
              <div aria-hidden className="pf-grid absolute inset-0 opacity-70" />
              <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
                <span className={cn("grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition-transform duration-700 sm:size-20 sm:rounded-3xl", on ? "scale-100" : "scale-90")}>
                  <FeatureIcon name={f.icon} className="size-8 sm:size-10" />
                </span>
                <h3 className="mt-5 text-lg font-black sm:text-xl">{f.title}</h3>
                <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-6 text-white/75 sm:text-sm sm:leading-7">{f.text}</p>
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-slate-950 transition-opacity duration-500" style={{ opacity: on ? 0 : Math.abs(offset(i)) === 1 ? 0.45 : 0.7 }} />
              <span aria-hidden className="absolute start-5 top-5 flex items-center gap-2 transition-opacity duration-300" style={{ opacity: on ? 1 : 0 }}>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                <span className="text-[10px] font-bold tracking-widest text-white/75">{toFa(i + 1)} از {toFa(count)}</span>
              </span>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => move(-1)} aria-label="قبلی" className={ARROW}><ChevronRight className="size-5" /></button>
          <div className="flex items-center gap-1.5">
            {items.map((f, i) => (
              <button key={i} type="button" onClick={() => select(i)} aria-label={f.title} aria-current={i === index}
                className={cn("h-2 cursor-pointer rounded-full transition-all duration-300", i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-primary/40")} />
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="بعدی" className={ARROW}><ChevronLeft className="size-5" /></button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{items[index].title}</p>
    </div>
  );
}
