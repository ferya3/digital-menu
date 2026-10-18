"use client";

import { toFa } from "@/lib/utils";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { DeckCarousel } from "@/components/platform/deck-carousel";
import type { FeatureItem } from "@/lib/site-content";

/** کارت‌های امکانات در دستهٔ کارت، با پخشِ خودکار */
export function FeatureCarousel({ items, label, autoplay }: { items: FeatureItem[]; label: string; autoplay: number }) {
  return (
    <DeckCarousel
      className="mt-10 sm:mt-14" label={label} autoplay={autoplay}
      stageClass="h-[23rem] sm:h-[26rem]"
      cardClass="h-[21rem] w-[min(19rem,74vw)] rounded-[1.75rem] border-4 border-card bg-slate-950 text-white shadow-2xl shadow-black/25 sm:h-[24rem] sm:w-[22rem] sm:rounded-[2.25rem] sm:border-8"
      titles={items.map((f) => f.title)}
      slides={items.map((f, i) => (
        <div key={i} className="relative h-full">
          <div aria-hidden className="absolute inset-0"
            style={{ background: `radial-gradient(80% 70% at ${30 + ((i * 23) % 40)}% 15%, hsl(var(--primary) / 0.6), transparent 70%), radial-gradient(60% 50% at 80% 95%, hsl(var(--primary) / 0.28), transparent 70%)` }} />
          <div aria-hidden className="pf-grid absolute inset-0 opacity-70" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="grid size-16 scale-90 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur transition-transform duration-700 group-data-[on=true]:scale-100 sm:size-20 sm:rounded-3xl">
              <FeatureIcon name={f.icon} className="size-8 sm:size-10" />
            </span>
            <h3 className="mt-5 text-lg font-black sm:text-xl">{f.title}</h3>
            <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-6 text-white/75 sm:text-sm sm:leading-7">{f.text}</p>
          </div>
          <span aria-hidden className="absolute start-5 top-5 flex items-center gap-2 opacity-0 transition-opacity duration-300 group-data-[on=true]:opacity-100">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span className="text-[10px] font-bold tracking-widest text-white/75">{toFa(i + 1)} از {toFa(items.length)}</span>
          </span>
        </div>
      ))}
    />
  );
}
