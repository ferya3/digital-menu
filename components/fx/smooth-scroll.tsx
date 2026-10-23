"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Lenis runs its own requestAnimationFrame loop (no GSAP needed on first load)
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      // On touch, native scrolling feels more natural
      touchMultiplier: 1.5,
      autoRaf: true,
    });
    // Exposed to other components for smooth scrolling to anchors
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

/** Smooth-scroll to an element (via Lenis when active) */
export function scrollToId(id: string, offset = -60) {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(el, { offset });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: "smooth" });
}
