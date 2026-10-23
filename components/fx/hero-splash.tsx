"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import type Lenis from "lenis";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/store/ui";
import { cn, num } from "@/lib/utils";
import type { CafeInfo } from "@/lib/types";
import { picksTitle } from "@/lib/seeds";

// The 3D scene is code-split (Three.js is heavy) and only loaded while the splash is open
const Hero3D = dynamic(() => import("@/components/fx/hero-3d").then((m) => m.Hero3D), { ssr: false });

const SEEN_KEY = "cafe_splash_seen";
const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
const ease = [0.22, 1, 0.36, 1] as const;

/** Default tagline and headline per venue kind (cafe / restaurant / fastfood / other) */
const KIND_COPY: Record<string, { tagline: string; headline: string }> = {
  cafe: { tagline: "Freshly brewed, made with care", headline: "Coffee worth coming back for" },
  restaurant: { tagline: "Seasonal ingredients, cooked with care", headline: "Flavors worth remembering" },
  fastfood: { tagline: "Hot, fresh and fast", headline: "Your cravings, sorted" },
  other: { tagline: "Made fresh, just for you", headline: "Flavors worth remembering" },
};

/** Welcome splash (hero): shown only the first time the link/QR is opened in each session */
export function HeroSplash({ cafe, table }: { cafe: CafeInfo; table: string }) {
  const open = useUI((s) => s.splash);
  const setSplash = useUI((s) => s.setSplash);
  const setPicks = useUI((s) => s.setPicks);
  const [ready, setReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  // The 3D scene loads once the page is ready and the device is idle, so buttons respond sooner
  const [show3D, setShow3D] = useState(false);
  const [scene3D, setScene3D] = useState(false);

  // Before first paint: keep it closed if already seen this session
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setSplash(false);
    } catch {}
    document.documentElement.classList.remove("splash-seen");
    setReady(true);
  }, [setSplash]);

  useEffect(() => {
    // The 3D scene (coffee) is for cafes only; other venues get the lightweight version
    if (!ready || !open || cafe.heroVideo || (cafe.kind && cafe.kind !== "cafe")) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
    const lite =
      nav.connection?.saveData ||
      /(^|-)2g|3g/.test(nav.connection?.effectiveType || "") ||
      (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lite) return; // low-end devices / slow connections keep the lightweight version
    let idle = 0;
    const go = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      idle = w.requestIdleCallback ? w.requestIdleCallback(() => setShow3D(true), { timeout: 2500 }) : window.setTimeout(() => setShow3D(true), 400);
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle); else window.clearTimeout(idle);
    };
  }, [ready, open, cafe.heroVideo]);

  // Lock background scrolling while open
  useEffect(() => {
    if (!ready || !open) return;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => (window as unknown as { __lenis?: Lenis }).__lenis?.stop());
    return () => {
      cancelAnimationFrame(raf);
      html.style.overflow = "";
      (window as unknown as { __lenis?: Lenis }).__lenis?.start();
    };
  }, [ready, open]);

  function close(then?: () => void) {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setSplash(false);
    if (then) window.setTimeout(then, 350);
  }

  const video = cafe.heroVideo && !videoFailed ? cafe.heroVideo : "";
  const copy = KIND_COPY[cafe.kind || "cafe"] || KIND_COPY.other;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="hero-splash"
          role="dialog"
          aria-modal="true"
          aria-label={`Welcome to ${cafe.name}`}
          data-lenis-prevent
          initial={ready ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease }}
          className={cn("fixed inset-0 z-[80] isolate flex flex-col overflow-hidden bg-background", video && "text-white")}
        >
          {/* Lightweight CSS version: visible from the server HTML; fades out once the 3D scene is ready */}
          {!cafe.heroVideo && (
            <div aria-hidden className={cn("hero-lite pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700", scene3D && "opacity-0")}>
              <span className="hero-lite-ring" />
              <span className="hero-lite-ball" />
            </div>
          )}
          {ready &&
            (video ? (
              <>
                <video
                  src={video}
                  poster={cafe.heroPoster || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  onError={() => setVideoFailed(true)}
                  className="absolute inset-0 -z-20 size-full object-cover"
                />
                <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/25 to-black/75" />
              </>
            ) : (
              <>
                {show3D && (
                  <div className={cn("absolute inset-0 -z-10 transition-opacity duration-700", scene3D ? "opacity-100" : "opacity-0")}>
                    <Hero3D onReady={() => setScene3D(true)} />
                  </div>
                )}
              </>
            ))}

          <button
            onClick={() => close()}
            aria-label="Close"
            className={cn(
              "absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border backdrop-blur transition hover:bg-primary hover:text-white",
              video ? "border-white/25 bg-white/10 text-white" : "border-border bg-card/70 text-muted-foreground"
            )}
          >
            <X className="size-5" />
          </button>

          {/* Venue name — top of the hero */}
          <header className="rise-down relative z-10 flex flex-col items-center px-4 pt-8 text-center sm:pt-12"
          >
            <span
              className={cn(
                "mb-3 grid size-16 place-items-center overflow-hidden rounded-[1.4rem] text-4xl shadow-lg ring-1 sm:size-20 sm:text-5xl",
                video ? "bg-white/15 ring-white/25 backdrop-blur" : "bg-card/80 ring-border backdrop-blur"
              )}
            >
              {isImg(cafe.logo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cafe.logo} alt="" className="size-full object-cover" />
              ) : (
                cafe.logo || "☕"
              )}
            </span>
            <h1
              className={cn(
                "text-balance text-4xl font-black leading-tight tracking-tight sm:text-6xl",
                video
                  ? "drop-shadow-[0_4px_18px_rgba(0,0,0,.45)]"
                  : "bg-gradient-to-l from-foreground via-primary to-foreground bg-clip-text text-transparent"
              )}
            >
              {cafe.name}
            </h1>
            {table ? (
              <span className={cn("mt-3 rounded-full px-3 py-0.5 text-xs font-bold", video ? "bg-white/15 text-white" : "bg-primary/10 text-primary")}>
                Table {num(table)}
              </span>
            ) : (
              <span className={cn("mt-3 h-px w-24 bg-gradient-to-l from-transparent to-transparent", video ? "via-white/70" : "via-primary/70")} />
            )}
          </header>

          <div className="relative z-10 flex flex-1 items-end px-4 pb-14 sm:items-center sm:pb-12">
            <div className="relative mx-auto w-full max-w-xl text-center sm:me-auto sm:ms-[8vw] sm:max-w-lg sm:text-left">
              {!video && <div aria-hidden className="absolute -inset-8 -z-10 rounded-full bg-background/70 blur-2xl" />}
              <div style={{ animationDelay: "150ms" }} className={cn("rise", 
                  "mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur",
                  video ? "border-white/30 bg-white/10 text-white" : "border-border bg-card/70 text-primary"
                )}
              >
                <Sparkles className="size-3.5" /> {cafe.tagline || copy.tagline}
              </div>
              <h2 style={{ animationDelay: "200ms" }} className={cn("rise", "text-balance text-3xl font-black leading-snug sm:text-5xl", video && "drop-shadow-[0_3px_14px_rgba(0,0,0,.5)]")}
              >
                {copy.headline}
              </h2>
              <p style={{ animationDelay: "300ms" }} className={cn("rise", "mx-auto mt-3 max-w-md text-balance text-base sm:mx-0 sm:text-lg", video ? "text-white/85" : "text-muted-foreground")}
              >
                Browse the menu and order right from your table.
              </p>
              <div style={{ animationDelay: "400ms" }} className="rise mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start"
              >
                <Button size="lg" className="rounded-full px-7" onClick={() => close()}>
                  View menu <ArrowRight className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={cn("rounded-full px-7", video && "border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white")}
                  onClick={() => close(() => setPicks(true))}
                >
                  <Sparkles className="size-4" /> {picksTitle(cafe.kind)}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
