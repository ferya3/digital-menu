"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Lenis خودش حلقهٔ requestAnimationFrame را می‌گرداند (بدون نیاز به GSAP در بارگذاری اول)
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      // روی لمس، اسکرولِ بومی طبیعی‌تر است
      touchMultiplier: 1.5,
      autoRaf: true,
    });
    // در دسترسِ بقیهٔ کامپوننت‌ها برای اسکرول نرم به لنگرها
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

/** اسکرول نرم به یک المنت (با Lenis اگر فعال باشد) */
export function scrollToId(id: string, offset = -60) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(el, { offset });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: "smooth" });
}
