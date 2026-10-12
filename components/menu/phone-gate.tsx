"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";
import { otpRequestAction, otpVerifyAction } from "@/app/actions";
import type { CafeInfo } from "@/lib/types";

const KEY = "cafe_verified";
const TTL = 12 * 3600 * 1000;
const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
const latin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");

/** شمارهٔ تأییدشدهٔ این مرورگر (اعتبار ۱۲ ساعت، مثل نسخهٔ قبلی) */
export function readVerifiedPhone(): string {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as { phone: string; ts: number } | null;
    if (v?.phone && Date.now() - v.ts < TTL) return v.phone;
  } catch {}
  return "";
}

/** دروازهٔ ورود: تأیید شمارهٔ موبایل با کد پیامکی (فقط اگر در تنظیمات روشن باشد) */
export function PhoneGate({ cafe, table, onVerified }: { cafe: CafeInfo; table: string; onVerified: (phone: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demo, setDemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const p = readVerifiedPhone();
    if (p) onVerified(p);
    else setOpen(true);
  }, [onVerified]);

  async function send() {
    setErr("");
    const p = latin(phone);
    if (!/^0?9\d{9}$/.test(p)) return setErr("شماره موبایل را درست وارد کنید (مثل ۰۹۱۲۳۴۵۶۷۸۹)");
    setBusy(true);
    try {
      const r = await otpRequestAction(p);
      setDemo(r.demoCode || "");
      setStep(2); setCode("");
    } catch (e) { setErr(e instanceof Error ? e.message : "خطا در ارسال کد"); } finally { setBusy(false); }
  }
  async function verify() {
    setErr("");
    if (!latin(code)) return setErr("کد تأیید را وارد کنید");
    setBusy(true);
    try {
      const r = await otpVerifyAction(latin(phone), latin(code), table);
      try { localStorage.setItem(KEY, JSON.stringify({ phone: r.phone, ts: Date.now() })); } catch {}
      onVerified(r.phone);
      setOpen(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "کد نادرست است"); } finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-background/95 p-4 backdrop-blur" data-lenis-prevent>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            <span className="mx-auto mb-3 grid size-16 place-items-center overflow-hidden rounded-2xl bg-muted text-4xl">
              {isImg(cafe.logo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cafe.logo} alt="" className="size-full object-cover" />
              ) : cafe.logo || "☕"}
            </span>
            <h2 className="text-xl font-black">{cafe.name}</h2>
            {step === 1 ? (
              <>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">برای دیدن منو و سفارش، شمارهٔ موبایلت را وارد کن</p>
                <div className="relative">
                  <Smartphone className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} inputMode="tel" autoFocus placeholder="۰۹۱۲۳۴۵۶۷۸۹" dir="ltr" className="w-full rounded-xl border border-input bg-background py-3 pl-3 pr-9 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <Button size="lg" className="mt-3 w-full rounded-xl" onClick={send} disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> در حال ارسال…</> : "ارسال کد تأیید"}</Button>
              </>
            ) : (
              <>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">کد پیامک‌شده به <b dir="ltr">{toFa(latin(phone))}</b> را وارد کن</p>
                {demo && <p className="mb-3 rounded-xl bg-amber-500/15 p-2 text-xs text-amber-800 dark:text-amber-300">🔧 حالت آزمایشی (بدون پیامک واقعی): کد شما <b>{toFa(demo)}</b> است</p>}
                <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify()} inputMode="numeric" autoFocus placeholder="– – – – –" dir="ltr" className="w-full rounded-xl border border-input bg-background py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring" />
                <Button size="lg" className="mt-3 w-full rounded-xl" onClick={verify} disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> در حال بررسی…</> : "تأیید و ورود"}</Button>
                <button onClick={() => { setStep(1); setErr(""); }} className="mt-2 text-xs text-muted-foreground underline">تغییر شماره</button>
              </>
            )}
            <p className={cn("mt-3 min-h-5 text-sm text-primary", !err && "invisible")}>{err || "."}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
