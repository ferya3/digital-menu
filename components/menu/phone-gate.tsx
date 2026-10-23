"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, thumb } from "@/lib/utils";
import { otpRequestAction, otpVerifyAction } from "@/app/actions";
import type { CafeInfo } from "@/lib/types";
import { unwrap } from "@/lib/action-result";

const KEY = "cafe_verified";
const TTL = 12 * 3600 * 1000;
const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
/** Keeps a leading "+" and digits only (spaces, dashes and brackets are dropped) */
const cleanPhone = (s: string) => { const t = s.trim(); return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, ""); };
const digits = (s: string) => s.replace(/\D/g, "");

/** Phone verified in this browser (valid for 12 hours) */
export function readVerifiedPhone(): string {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null") as { phone: string; ts: number } | null;
    if (v?.phone && Date.now() - v.ts < TTL) return v.phone;
  } catch {}
  return "";
}

/** Entry gate: verify the mobile number with an SMS code (only when enabled in settings) */
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
    const p = cleanPhone(phone);
    const n = digits(p).length;
    if (n < 7 || n > 15) return setErr("Enter a valid mobile number, including your country code");
    setBusy(true);
    try {
      const r = unwrap(await otpRequestAction(p));
      setDemo(r.demoCode || "");
      setStep(2); setCode("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not send the code"); } finally { setBusy(false); }
  }
  async function verify() {
    setErr("");
    if (!digits(code)) return setErr("Enter the verification code");
    setBusy(true);
    try {
      const r = unwrap(await otpVerifyAction(cleanPhone(phone), digits(code), table));
      try { localStorage.setItem(KEY, JSON.stringify({ phone: r.phone, ts: Date.now() })); } catch {}
      onVerified(r.phone);
      setOpen(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "Incorrect code"); } finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div exit={{ opacity: 0 }} className="fixed inset-0 z-[90] grid place-items-center bg-background/95 p-4 backdrop-blur" data-lenis-prevent>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            <span className="mx-auto mb-3 grid size-16 place-items-center overflow-hidden rounded-2xl bg-muted text-4xl">
              {isImg(cafe.logo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(cafe.logo, 160)} alt="" className="size-full object-cover" />
              ) : cafe.logo || "☕"}
            </span>
            <h2 className="text-xl font-black">{cafe.name}</h2>
            {step === 1 ? (
              <>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">Enter your mobile number to view the menu and order</p>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder="+1 555 123 4567" className="w-full rounded-xl border border-input bg-background py-3 pl-9 pr-3 text-center text-lg tracking-wide outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Include your country code</p>
                <Button size="lg" className="mt-3 w-full rounded-xl" onClick={send} disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> Sending…</> : "Send code"}</Button>
              </>
            ) : (
              <>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">Enter the code we texted to <b>{cleanPhone(phone)}</b></p>
                {demo && <p className="mb-3 rounded-xl bg-amber-500/15 p-2 text-xs text-amber-800 dark:text-amber-300">🔧 Demo mode (no real SMS sent): your code is <b>{demo}</b></p>}
                <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify()} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="– – – – – –" className="w-full rounded-xl border border-input bg-background py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring" />
                <Button size="lg" className="mt-3 w-full rounded-xl" onClick={verify} disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> Verifying…</> : "Verify and continue"}</Button>
                <button onClick={() => { setStep(1); setErr(""); }} className="mt-2 text-xs text-muted-foreground underline">Change number</button>
              </>
            )}
            <p className={cn("mt-3 min-h-5 text-sm text-primary", !err && "invisible")}>{err || "."}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
