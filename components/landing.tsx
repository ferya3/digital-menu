"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmoothScroll, scrollToId } from "@/components/fx/smooth-scroll";
import dynamic from "next/dynamic";
import { MobileMenu } from "@/components/fx/mobile-menu";
import { MenuView } from "@/components/menu/menu-view";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { CafeInfo, Menu, PaymentInfo } from "@/lib/types";

// صحنهٔ سه‌بعدی جدا و بعد از بارگذاری صفحه لود می‌شود (Three.js سنگین است)
const Hero3D = dynamic(() => import("@/components/fx/hero-3d").then((m) => m.Hero3D), { ssr: false });

const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
const ease = [0.22, 1, 0.36, 1] as const;

export function Landing({
  menu,
  table,
  cafe,
  payment,
}: {
  menu: Menu;
  table: string;
  cafe: CafeInfo;
  payment: PaymentInfo;
}) {
  const openPicks = useUI((s) => s.setPicks);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // خطایی که قبل از hydrate رخ داده باشد (مثلاً فرمتِ پشتیبانی‌نشده) هم به صحنهٔ سه‌بعدی برمی‌گردد
  useEffect(() => {
    if (videoRef.current?.error) setVideoFailed(true);
  }, []);
  // اگر ویدیو آپلود شده باشد پخش می‌شود؛ وگرنه (یا اگر خطا داد) همان صحنهٔ سه‌بعدی
  const video = cafe.heroVideo && !videoFailed ? cafe.heroVideo : "";

  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} />

      {/* ===== HERO (ویدیو یا Three.js) ===== */}
      <section id="top" className={cn("relative isolate flex min-h-[100svh] flex-col overflow-hidden", video && "text-white")}>
        {video ? (
          <>
            <video
              ref={videoRef}
              src={video}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 -z-20 size-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/25 to-black/70" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent" />
          </>
        ) : (
          <Hero3D />
        )}

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
          <span className={cn("mt-3 h-px w-24 bg-gradient-to-l from-transparent to-transparent", video ? "via-white/70" : "via-primary/70")} />
        </motion.header>

        <div className="relative z-10 flex flex-1 items-end px-4 pb-24 sm:items-center sm:pb-12">
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
              <Button size="lg" className="rounded-full px-7" onClick={() => scrollToId("menu")}>
                مشاهدهٔ منو <ArrowLeft className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={cn("rounded-full px-7", video && "border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white")}
                onClick={() => openPicks(true)}
              >
                <Sparkles className="size-4" /> منتخب باریستا
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.button
          onClick={() => scrollToId("menu")}
          aria-label="رفتن به منو"
          className={cn("absolute bottom-6 left-1/2 z-10 -translate-x-1/2", video ? "text-white/80" : "text-muted-foreground")}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <ChevronDown className="size-7" />
        </motion.button>
      </section>

      {/* ===== MENU + ordering (پنل منتخب‌ها هم داخل همین است تا به همان سبد اضافه شود) ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} />
      </div>
    </SmoothScroll>
  );
}
