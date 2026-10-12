"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import type Lenis from "lenis";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/store/ui";
import { cn, toFa } from "@/lib/utils";
import type { CafeInfo } from "@/lib/types";

// صحنهٔ سه‌بعدی جدا لود می‌شود (Three.js سنگین است) و فقط وقتی پاپ‌آپ باز است
const Hero3D = dynamic(() => import("@/components/fx/hero-3d").then((m) => m.Hero3D), { ssr: false });

const SEEN_KEY = "cafe_splash_seen";
const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
const ease = [0.22, 1, 0.36, 1] as const;

/** پاپ‌آپِ خوش‌آمد (هیرو): فقط بار اولِ بازکردنِ لینک/QR در هر نشست نمایش داده می‌شود */
export function HeroSplash({ cafe, table }: { cafe: CafeInfo; table: string }) {
  const open = useUI((s) => s.splash);
  const setSplash = useUI((s) => s.setSplash);
  const setPicks = useUI((s) => s.setPicks);
  const [ready, setReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  // قبل از اولین نقاشی: اگر در این نشست دیده شده، بسته بماند
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setSplash(false);
    } catch {}
    document.documentElement.classList.remove("splash-seen");
    setReady(true);
  }, [setSplash]);

  // تا وقتی باز است صفحهٔ پشت اسکرول نشود
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="hero-splash"
          role="dialog"
          aria-modal="true"
          aria-label={`خوش آمدید به ${cafe.name}`}
          data-lenis-prevent
          initial={ready ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease }}
          className={cn("fixed inset-0 z-[80] isolate flex flex-col overflow-hidden bg-background", video && "text-white")}
        >
          {ready &&
            (video ? (
              <>
                <video
                  src={video}
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
              <Hero3D />
            ))}

          <button
            onClick={() => close()}
            aria-label="بستن"
            className={cn(
              "absolute left-4 top-4 z-20 grid size-10 place-items-center rounded-full border backdrop-blur transition hover:bg-primary hover:text-white",
              video ? "border-white/25 bg-white/10 text-white" : "border-border bg-card/70 text-muted-foreground"
            )}
          >
            <X className="size-5" />
          </button>

          {/* نام کافه — بالای هیرو */}
          <motion.header
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="relative z-10 flex flex-col items-center px-4 pt-8 text-center sm:pt-12"
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
                میز {toFa(table)}
              </span>
            ) : (
              <span className={cn("mt-3 h-px w-24 bg-gradient-to-l from-transparent to-transparent", video ? "via-white/70" : "via-primary/70")} />
            )}
          </motion.header>

          <div className="relative z-10 flex flex-1 items-end px-4 pb-14 sm:items-center sm:pb-12">
            <div className="relative mx-auto w-full max-w-xl text-center sm:me-auto sm:ms-[8vw] sm:max-w-lg sm:text-right">
              {!video && <div aria-hidden className="absolute -inset-8 -z-10 rounded-full bg-background/70 blur-2xl" />}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className={cn(
                  "mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur",
                  video ? "border-white/30 bg-white/10 text-white" : "border-border bg-card/70 text-primary"
                )}
              >
                <Sparkles className="size-3.5" /> {cafe.tagline || "قهوهٔ تازه، تجربهٔ متفاوت"}
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease }}
                className={cn("text-balance text-3xl font-black leading-snug sm:text-5xl", video && "drop-shadow-[0_3px_14px_rgba(0,0,0,.5)]")}
              >
                طعمی که به یاد می‌ماند
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={cn("mx-auto mt-3 max-w-md text-balance text-base sm:mx-0 sm:text-lg", video ? "text-white/85" : "text-muted-foreground")}
              >
                منو را ببین و همین‌جا، از روی میز، سفارش بده.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start"
              >
                <Button size="lg" className="rounded-full px-7" onClick={() => close()}>
                  مشاهدهٔ منو <ArrowLeft className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={cn("rounded-full px-7", video && "border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white")}
                  onClick={() => close(() => setPicks(true))}
                >
                  <Sparkles className="size-4" /> منتخب باریستا
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
