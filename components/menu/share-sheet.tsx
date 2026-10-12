"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, Instagram, MessageCircle, Send, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShareTarget {
  title: string;
  text: string;
  url: string;
  image?: string;
}

/** کپی که روی HTTP هم کار کند (clipboard API فقط روی HTTPS هست) */
export async function copyText(s: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(s);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, s.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * اشتراک‌گذاری: اگر گوشی پنجرهٔ اشتراک‌گذاریِ خودش را داشته باشد (فقط روی HTTPS) همان باز می‌شود
 * — همراهِ عکسِ محصول؛ وگرنه پنل خودمان (واتساپ، تلگرام، اینستاگرام، پیامک، کپی).
 * خروجی: true یعنی اشتراکِ بومی انجام شد و پنل لازم نیست.
 */
export async function nativeShare(t: ShareTarget): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share || !window.isSecureContext) return false;
  try {
    if (t.image && navigator.canShare) {
      try {
        const blob = await (await fetch(t.image)).blob();
        const file = new File([blob], "product." + (blob.type.split("/")[1] || "jpg"), { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: t.title, text: `${t.text}\n${t.url}` });
          return true;
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return true;
      }
    }
    await navigator.share({ title: t.title, text: t.text, url: t.url });
    return true;
  } catch (e) {
    return (e as Error)?.name === "AbortError"; // لغو توسط کاربر = تمام
  }
}

export function ShareSheet({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  useEffect(() => setCopied(""), [target]);
  const full = target ? `${target.text}\n${target.url}` : "";
  const enc = encodeURIComponent;

  async function copy(kind: "link" | "all") {
    if (!target) return;
    const ok = await copyText(kind === "link" ? target.url : full);
    setCopied(ok ? kind : "fail");
  }
  async function instagram() {
    await copyText(full);
    setCopied("insta");
    // اینستاگرام لینکِ اشتراکِ وب ندارد: متن کپی می‌شود و برنامه باز می‌شود تا در دایرکت/استوری بچسبانید
    window.setTimeout(() => (window.location.href = "https://www.instagram.com/direct/inbox/"), 700);
  }

  const items = target
    ? [
        { key: "wa", label: "واتساپ", icon: <MessageCircle className="size-6" />, cls: "bg-[#25D366] text-white", href: `https://wa.me/?text=${enc(full)}` },
        { key: "tg", label: "تلگرام", icon: <Send className="size-6" />, cls: "bg-[#229ED9] text-white", href: `https://t.me/share/url?url=${enc(target.url)}&text=${enc(target.text)}` },
        { key: "ig", label: "اینستاگرام", icon: <Instagram className="size-6" />, cls: "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white", onClick: instagram },
        { key: "sms", label: "پیامک", icon: <Smartphone className="size-6" />, cls: "bg-emerald-600 text-white", href: `sms:?&body=${enc(full)}` },
      ]
    : [];

  return (
    <AnimatePresence>
      {target && (
        <motion.div className="fixed inset-0 z-[66] flex flex-col justify-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-lenis-prevent>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="mx-auto w-full max-w-lg rounded-t-3xl bg-card p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              {target.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={target.image} alt="" className="size-14 rounded-2xl object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-extrabold">اشتراک‌گذاری «{target.title}»</h3>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">{target.url}</p>
              </div>
              <button onClick={onClose} aria-label="بستن" className="grid size-9 place-items-center rounded-full bg-muted"><X className="size-5" /></button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {items.map((it) =>
                it.href ? (
                  <a key={it.key} href={it.href} target="_blank" rel="noopener" className="flex flex-col items-center gap-1.5 text-xs font-semibold">
                    <span className={cn("grid size-14 place-items-center rounded-2xl shadow", it.cls)}>{it.icon}</span>
                    {it.label}
                  </a>
                ) : (
                  <button key={it.key} onClick={it.onClick} className="flex flex-col items-center gap-1.5 text-xs font-semibold">
                    <span className={cn("grid size-14 place-items-center rounded-2xl shadow", it.cls)}>{it.icon}</span>
                    {it.label}
                  </button>
                )
              )}
            </div>
            {copied === "insta" && <p className="mt-3 rounded-xl bg-muted p-2 text-center text-xs">متن و لینک کپی شد ✅ — در اینستاگرام بچسبانید (Paste)</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={() => copy("link")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold transition hover:bg-muted">
                {copied === "link" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />} {copied === "link" ? "لینک کپی شد" : "کپی لینک"}
              </button>
              <button onClick={() => copy("all")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold transition hover:bg-muted">
                {copied === "all" ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />} {copied === "all" ? "کپی شد" : "کپی متن کامل"}
              </button>
              {target.image && (
                <a href={target.image} download className="grid size-11 shrink-0 place-items-center rounded-xl border border-border transition hover:bg-muted" aria-label="ذخیرهٔ عکس" title="ذخیرهٔ عکس (برای استوری)">
                  <Download className="size-4" />
                </a>
              )}
            </div>
            {copied === "fail" && (
              <input readOnly value={full} onFocus={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs" dir="auto" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
