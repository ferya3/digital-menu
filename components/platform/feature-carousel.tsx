"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn, toFa } from "@/lib/utils";
import { FeatureIcon } from "@/components/platform/feature-icon";
import type { FeatureItem } from "@/lib/site-content";

/**
 * کاروسلِ دوپانله (همان الگوی «از خاک تا سازه»):
 * یک سو چرخی از چیپ‌ها که عمودی می‌چرخد و آیتمِ فعال وسطش می‌نشیند (شرحش زیرِ چیپ)؛
 * سوی دیگر دسته‌ای از کارت‌ها که کارتِ فعال جلو می‌آید و همسایه‌ها کوچک و کج پشتش می‌مانند.
 * همه‌چیز از یک عدد می‌آید: فاصلهٔ علامت‌دارِ هر آیتم تا آیتمِ فعال، پیچیده در بازهٔ [−n/2، n/2).
 */
const ITEM_H = 64;      // ارتفاعِ هر پلهٔ چرخ = ارتفاعِ چیپ
const AUTOPLAY_MS = 3400;
const TEXT_GAP = 10;    // فاصلهٔ چیپ تا شرحِ زیرش

export function FeatureCarousel({ items, label }: { items: FeatureItem[]; label: string }) {
  const count = items.length;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [room, setRoom] = useState(0);
  const wheel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const index = ((step % count) + count) % count;

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /** هر بار از نو زمان‌بندی می‌شود: وقتی کاربر خودش چیپی را می‌زند، یک لحظه بعد زیرِ دستش جلو نرود */
  const schedule = useCallback(() => {
    window.clearInterval(timer.current);
    if (reduced || paused || count < 2) return;
    timer.current = window.setInterval(() => setStep((s) => s + 1), AUTOPLAY_MS);
  }, [reduced, paused, count]);
  useEffect(() => { schedule(); return () => window.clearInterval(timer.current); }, [schedule]);

  /** ارتفاعِ شرحِ آیتمِ فعال (absolute است؛ ردیف‌های پایین‌تر به همین اندازه هل داده می‌شوند) */
  const measure = useCallback(() => {
    const text = wheel.current?.children[index]?.querySelector<HTMLElement>("[data-text]");
    setRoom(text ? text.offsetHeight + TEXT_GAP : 0);
  }, [index]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => { window.addEventListener("resize", measure, { passive: true }); return () => window.removeEventListener("resize", measure); }, [measure]);

  if (!count) return null;

  const offset = (i: number) => {
    const half = count / 2;
    return ((((i - index + half) % count) + count) % count) - half;
  };
  /** همیشه رو به جلو: ترتیبِ آیتم‌ها گم نشود */
  const select = (i: number) => {
    const ahead = (i - index + count) % count;
    if (ahead) setStep((s) => s + ahead);
    schedule();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, Home: -index, End: count - 1 - index };
    const by = moves[e.key];
    if (by === undefined) return;
    e.preventDefault();
    const next = (index + by + count) % count;
    select(next);
    requestAnimationFrame(() => wheel.current?.children[next]?.querySelector("button")?.focus());
  };

  const chipStyle = (i: number): React.CSSProperties => {
    const d = offset(i);
    return {
      // فقط ردیف‌های پایین‌ترِ آیتمِ فعال کنار می‌روند تا کلِ چرخ با هر قدم بالا و پایین نپرد
      transform: `translateY(${d * ITEM_H + (d > 0 ? room : 0)}px)`,
      opacity: Math.max(0, 1 - Math.abs(d) * 0.25),
      zIndex: d === 0 ? 10 : 1,
      pointerEvents: Math.abs(d) >= 4 ? "none" : "auto",
      height: ITEM_H,
    };
  };
  const cardStyle = (i: number): React.CSSProperties => {
    const d = offset(i);
    const near = d === -1 || d === 1;
    // راست‌به‌چپ: آیتمِ بعدی از چپ می‌آید و قبلی سمتِ راست می‌ماند
    const x = d === -1 ? 96 : d === 1 ? -96 : 0;
    const tilt = d === -1 ? 3 : d === 1 ? -3 : 0;
    const scale = d === 0 ? 1 : near ? 0.85 : 0.7;
    return {
      transform: `translateX(${x}px) rotate(${tilt}deg) scale(${scale})`,
      opacity: d === 0 ? 1 : near ? 0.4 : 0,
      zIndex: d === 0 ? 20 : near ? 10 : 0,
      pointerEvents: d === 0 ? "auto" : "none",
    };
  };

  return (
    <div
      className="mt-10 sm:mt-14"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="flex flex-col overflow-hidden rounded-[2rem] border border-border lg:aspect-[2/1] lg:flex-row lg:rounded-[2.5rem]">
        {/* چرخِ آیتم‌ها */}
        <div className="relative min-h-[21rem] w-full bg-primary lg:min-h-0 lg:w-[40%]">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 60% at 30% 0%, rgb(255 255 255 / 0.18), transparent 70%)" }} />
          <div ref={wheel} onKeyDown={onKey} role="tablist" aria-label={label} aria-orientation="vertical" className="fc-wheel absolute inset-0 flex items-center">
            {items.map((f, i) => {
              const on = offset(i) === 0;
              return (
                <div key={i} className="fc-chip absolute inset-x-0 flex" style={chipStyle(i)}>
                  <div className="relative mx-5 flex h-full flex-1 items-center justify-center gap-3 md:mx-10 lg:mx-8 lg:justify-start">
                    <span aria-hidden className={cn("w-5 shrink-0 text-end text-xs font-bold transition-colors duration-500", on ? "text-white" : "text-white/40")}>{toFa(i + 1)}</span>
                    <button
                      type="button" role="tab" id={`fc-tab-${i}`} aria-selected={on} aria-controls="fc-panel" tabIndex={on ? 0 : -1}
                      onClick={() => select(i)}
                      className={cn("flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors duration-500 md:px-6",
                        on ? "border-white bg-white text-primary" : "border-white/30 text-white/75 hover:border-white/60 hover:text-white")}
                    >
                      <FeatureIcon name={f.icon} className="size-[18px]" />
                      <span className="whitespace-nowrap text-sm font-bold">{f.title}</span>
                    </button>
                    <p data-text className="pointer-events-none absolute inset-x-0 top-full mt-2.5 px-2 text-center text-[0.8125rem] leading-[1.75] text-white/90 transition-opacity duration-500 lg:pe-4 lg:ps-8 lg:text-start" style={{ opacity: on ? 1 : 0 }}>
                      {f.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* دستهٔ کارت‌ها */}
        <div id="fc-panel" role="tabpanel" aria-labelledby={`fc-tab-${index}`} aria-live="polite"
          className="relative flex flex-1 items-center justify-center overflow-hidden border-t border-border bg-muted/60 px-6 py-10 md:px-10 lg:border-s lg:border-t-0">
          <div className="relative aspect-square w-full max-w-[17rem] md:max-w-[22rem] lg:h-full lg:w-auto lg:max-w-none">
            {items.map((f, i) => {
              const on = offset(i) === 0;
              return (
                <div key={i} className="fc-card absolute inset-0 origin-center overflow-hidden rounded-[1.75rem] border-4 border-card bg-slate-950 shadow-2xl shadow-black/25 md:rounded-[2.25rem] md:border-8" style={cardStyle(i)}>
                  <div aria-hidden className={cn("absolute inset-0 transition-[filter] duration-700", !on && "blur-[2px] brightness-75 grayscale")}
                    style={{ background: `radial-gradient(80% 70% at ${30 + ((i * 23) % 40)}% 20%, hsl(var(--primary) / 0.55), transparent 70%), radial-gradient(60% 50% at 80% 90%, hsl(var(--primary) / 0.25), transparent 70%)` }} />
                  <div aria-hidden className="pf-grid absolute inset-0 opacity-70" />
                  <div className="relative flex h-full flex-col items-center justify-center p-6 text-center text-white">
                    <span className={cn("grid size-20 place-items-center rounded-3xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition-transform duration-700 md:size-24", on ? "scale-100" : "scale-90")}>
                      <FeatureIcon name={f.icon} className="size-10 md:size-12" />
                    </span>
                    <b className="mt-5 text-lg font-black md:text-xl">{f.title}</b>
                  </div>
                  <div className="pointer-events-none absolute start-5 top-5 flex items-center gap-2 transition-opacity duration-300" style={{ opacity: on ? 1 : 0 }} aria-hidden>
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
                      <span className="relative inline-flex size-2 rounded-full bg-white" />
                    </span>
                    <span className="text-[10px] font-bold tracking-widest text-white/75">{toFa(i + 1)} از {toFa(count)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
