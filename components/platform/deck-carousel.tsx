"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card deck: the active card comes forward and its neighbors sit smaller and tilted behind it.
 * Everything derives from one number: each card's signed distance to the active card, wrapped into [−n/2, n/2).
 * Slide content is passed in (can be server-rendered); the active card gets data-on="true"
 * so content can react to it with group-data-[on=true]:.
 */
export function DeckCarousel({
  slides, titles, label, start = 0, autoplay = 0, stageClass, cardClass, slideClass = [], dimClass = "bg-slate-950", dim = [0.45, 0.7], spread = [0.62, 0.62], className,
}: {
  slides: React.ReactNode[];
  /** Name of each card, for the dot buttons and screen readers */
  titles: string[];
  label: string;
  start?: number;
  /** Autoplay interval (ms); 0 = off */
  autoplay?: number;
  /** Stage height */
  stageClass: string;
  /** Card frame size and look (width must suit the stage height) */
  cardClass: string;
  /** Extra class per card (e.g. dark for the popular plan) */
  slideClass?: string[];
  /** Dimming overlay for the back cards and its strength at distance 1 and 2 */
  dimClass?: string;
  dim?: [number, number];
  /** Side-card offset relative to card width: [mobile, desktop] */
  spread?: [number, number];
  className?: string;
}) {
  const count = slides.length;
  const [step, setStep] = useState(start);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [cw, setCw] = useState(300);
  const [wide, setWide] = useState(false);
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

  /** Card width; side-card offsets are a fraction of it */
  useEffect(() => {
    const measure = () => { setCw(probe.current?.offsetWidth || 300); setWide(window.innerWidth >= 1024); };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  /** Rescheduled on every move, so autoplay doesn't advance right after the user navigates */
  const schedule = useCallback(() => {
    window.clearInterval(timer.current);
    if (!autoplay || reduced || paused || count < 2) return;
    timer.current = window.setInterval(() => setStep((s) => s + 1), autoplay);
  }, [autoplay, reduced, paused, count]);
  useEffect(() => { schedule(); return () => window.clearInterval(timer.current); }, [schedule]);

  if (!count) return null;

  const offset = (i: number) => {
    const half = count / 2;
    return ((((i - index + half) % count) + count) % count) - half;
  };
  const move = (by: number) => { setStep((s) => s + by); schedule(); };
  const select = (i: number) => move(offset(i));
  const onKey = (e: React.KeyboardEvent) => {
    // LTR: right = next
    const by = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (by === undefined) return;
    e.preventDefault();
    move(by);
  };

  const k = wide ? spread[1] : spread[0];
  const cardStyle = (i: number): React.CSSProperties => {
    const d = offset(i);
    const a = Math.abs(d);
    // LTR: the next card comes from the right and the previous one stays on the left
    const x = Math.sign(d) * (a === 1 ? cw * k : a === 2 ? cw * (k + 0.46) : 0);
    const tilt = Math.sign(d) * (a === 1 ? 4 : a === 2 ? 7 : 0);
    const scale = a === 0 ? 1 : a === 1 ? 0.84 : a === 2 ? 0.7 : 0.6;
    return {
      transform: `translateX(${x}px) rotate(${tilt}deg) scale(${scale})`,
      // Back cards stay opaque (not translucent) so layers don't show through; the inner overlay does the dimming
      opacity: a <= 2 ? 1 : 0,
      zIndex: 30 - a * 10,
      pointerEvents: a === 1 ? "auto" : "none",
    };
  };

  const ARROW = "grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors duration-200 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25";

  return (
    <div
      className={className}
      role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={onKey}
    >
      <div
        className={cn("relative -mx-4 flex items-center justify-center overflow-hidden sm:mx-0", stageClass)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
          setPaused(false);
        }}
      >
        {/* Brand-color glow behind the cards; a radial gradient fades fully before the stage edges (blur left hard edges in a clipped frame) */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[44rem] max-w-full -translate-x-1/2" style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.16), transparent)" }} />
        <div ref={probe} aria-hidden className={cn("pointer-events-none invisible absolute !h-0", cardClass)} />
        {slides.map((s, i) => {
          const on = offset(i) === 0;
          const a = Math.abs(offset(i));
          return (
            <article
              key={i}
              data-on={on}
              aria-hidden={!on}
              onClick={() => !on && select(i)}
              className={cn("fc-card group absolute origin-center overflow-hidden", cardClass, slideClass[i], !on && "cursor-pointer")}
              style={cardStyle(i)}
            >
              {/* Back-card content is inert; a click reaches the card itself and brings it forward */}
              <div inert={!on} className="h-full">{s}</div>
              <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-500", dimClass)} style={{ opacity: on ? 0 : a === 1 ? dim[0] : dim[1] }} />
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => move(-1)} aria-label="Previous" className={ARROW}><ChevronLeft className="size-5" /></button>
          <div className="flex items-center gap-1.5">
            {titles.map((t, i) => (
              <button key={i} type="button" onClick={() => select(i)} aria-label={t} aria-current={i === index}
                className={cn("h-2 cursor-pointer rounded-full transition-all duration-300", i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-primary/40")} />
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next" className={ARROW}><ChevronRight className="size-5" /></button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{titles[index]}</p>
    </div>
  );
}
