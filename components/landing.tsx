"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmoothScroll, scrollToId } from "@/components/fx/smooth-scroll";
import dynamic from "next/dynamic";
import { SignatureScroll } from "@/components/fx/signature-scroll";
import { MobileMenu } from "@/components/fx/mobile-menu";
import { MenuView } from "@/components/menu/menu-view";
import { formatMoney } from "@/lib/utils";
import type { CafeInfo, Menu, PaymentInfo } from "@/lib/types";

// صحنهٔ سه‌بعدی جدا و بعد از بارگذاری صفحه لود می‌شود (Three.js سنگین است)
const Hero3D = dynamic(() => import("@/components/fx/hero-3d").then((m) => m.Hero3D), { ssr: false });

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
  const money = (n: number) => formatMoney(n, cafe.currency);
  const tagged = menu.items.filter((i) => i.tag);
  const featured = (tagged.length >= 3 ? tagged : menu.items).slice(0, 5);

  return (
    <SmoothScroll>
      <MobileMenu cafeName={cafe.name} />

      {/* ===== HERO (Three.js) ===== */}
      <section id="top" className="relative grid min-h-screen place-items-center overflow-hidden pt-[22vh] sm:pt-0">
        <Hero3D />
        <div className="relative z-10 px-4 text-center sm:me-auto sm:ms-[8vw] sm:max-w-xl sm:text-right">
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-background/70 blur-2xl" />
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-bold text-primary backdrop-blur"
          >
            <Sparkles className="size-3.5" /> {cafe.tagline || "قهوهٔ تازه، تجربهٔ متفاوت"}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance text-5xl font-black leading-[1.05] drop-shadow-sm sm:text-7xl"
          >
            {cafe.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
            className="mx-auto mt-4 max-w-md text-balance text-lg text-muted-foreground sm:mx-0"
          >
            طعمی که به یاد می‌ماند — منو را ببین و همین‌جا سفارش بده.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:justify-start"
          >
            <Button size="lg" className="rounded-full px-7" onClick={() => scrollToId("menu")}>
              مشاهدهٔ منو <ArrowLeft className="size-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-7" onClick={() => scrollToId("signature")}>
              منتخب باریستا
            </Button>
          </motion.div>
        </div>
        <motion.button
          onClick={() => scrollToId("signature")}
          aria-label="پایین"
          className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-muted-foreground"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <ChevronDown className="size-7" />
        </motion.button>
      </section>

      {/* ===== SIGNATURE (GSAP pinned horizontal) ===== */}
      <div id="signature">
        <SignatureScroll items={featured} money={money} />
      </div>

      {/* ===== MENU + ordering ===== */}
      <div id="menu">
        <MenuView menu={menu} table={table} cafe={cafe} payment={payment} />
      </div>
    </SmoothScroll>
  );
}
