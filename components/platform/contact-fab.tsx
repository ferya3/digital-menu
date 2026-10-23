"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * دکمهٔ شناورِ تماس (گوشهٔ پایین): صاحبِ کافه قبل از خرید معمولاً می‌خواهد با یک آدم حرف بزند.
 * اگر هم واتساپ و هم تلفن باشد، با لمس دو گزینه باز می‌شود؛ اگر فقط یکی باشد، مستقیم همان.
 */
export function ContactFab({ whatsapp, phone, text }: { whatsapp: string; phone: string; text: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const wa = whatsapp
    ? (/^https?:/.test(whatsapp) ? whatsapp : `https://wa.me/${whatsapp.replace(/\D/g, "").replace(/^0/, "98")}`) + (text && !/^https?:/.test(whatsapp) ? `?text=${encodeURIComponent(text)}` : "")
    : "";
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  if (!wa && !tel) return null;
  const single = !(wa && tel);
  const btn = "grid size-14 place-items-center rounded-full text-white shadow-xl shadow-black/25 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-4";

  return (
    <div ref={box} className="fixed bottom-5 left-5 z-50 flex flex-col items-center gap-3 print:hidden">
      {!single && (
        <div className={cn("flex flex-col gap-3 transition-all duration-200", open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
          <a href={wa} target="_blank" rel="noopener" aria-label="واتساپ" title="واتساپ" className={cn(btn, "size-12 bg-[#25d366] focus-visible:ring-[#25d366]/40")}><MessageCircle className="size-6" /></a>
          <a href={tel} aria-label="تماس" title="تماس" className={cn(btn, "size-12 bg-slate-900 focus-visible:ring-slate-400")}><Phone className="size-5" /></a>
        </div>
      )}
      {single ? (
        <a href={wa || tel} {...(wa ? { target: "_blank", rel: "noopener" } : {})} aria-label={wa ? "گفتگو در واتساپ" : "تماس با ما"} title={wa ? "گفتگو در واتساپ" : "تماس با ما"}
          className={cn(btn, wa ? "bg-[#25d366] focus-visible:ring-[#25d366]/40" : "bg-primary focus-visible:ring-primary/40")}>
          {wa ? <MessageCircle className="size-7" /> : <Phone className="size-6" />}
        </a>
      ) : (
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-expanded={open} aria-label="تماس با ما" title="تماس با ما"
          className={cn(btn, "bg-primary focus-visible:ring-primary/40")}>
          {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
        </button>
      )}
    </div>
  );
}
