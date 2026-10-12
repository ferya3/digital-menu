"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { MenuItem } from "@/lib/types";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export function SignatureScroll({
  items,
  money,
}: {
  items: MenuItem[];
  money: (n: number) => string;
}) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = track.current;
      const sec = root.current;
      if (!el || !sec || items.length === 0) return;
      const getDist = () => Math.max(0, el.scrollWidth - window.innerWidth);
      gsap.to(el, {
        x: () => -getDist(),
        ease: "none",
        scrollTrigger: {
          trigger: sec,
          start: "top top",
          end: () => "+=" + getDist(),
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    },
    { scope: root, dependencies: [items.length] }
  );

  if (items.length === 0) return null;

  return (
    <section ref={root} className="relative h-screen overflow-hidden bg-gradient-to-b from-background to-muted/40">
      <div ref={track} dir="ltr" className="flex h-full items-center gap-6 px-[8vw] will-change-transform">
        {/* intro panel */}
        <div className="sig-panel flex h-[70vh] w-[78vw] shrink-0 flex-col justify-center sm:w-[42vw]" dir="rtl">
          <span className="mb-3 inline-block w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-primary">امضای ما</span>
          <h2 className="text-4xl font-black leading-tight sm:text-6xl">منتخبِ باریستا</h2>
          <p className="mt-3 max-w-sm text-muted-foreground">
            چند نوشیدنی که عاشقشان می‌شوی — برای دیدنِ همه، اسکرول کن ←
          </p>
        </div>

        {items.map((d) => (
          <article
            key={d.id}
            dir="rtl"
            className="sig-panel relative flex h-[70vh] w-[78vw] shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl sm:w-[40vw]"
          >
            <div className="relative grid flex-1 place-items-center overflow-hidden bg-gradient-to-br from-muted to-card">
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.image} alt={d.name} className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="text-[9rem] drop-shadow-xl">{d.emoji}</span>
              )}
              {d.tag && (
                <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{d.tag}</span>
              )}
            </div>
            <div className="p-5">
              <h3 className="text-2xl font-extrabold">{d.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.desc}</p>
              <div className="mt-3 text-lg font-black text-primary">{money(d.price)}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-muted-foreground">
        ← برای مرور، اسکرول کن
      </div>
    </section>
  );
}
