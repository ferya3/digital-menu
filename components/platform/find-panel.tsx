"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { findPanelAction } from "@/app/platform/actions";

/** ورود: آدرسِ منو را می‌گیرد و به پنلِ همان مجموعه می‌برد */
export function FindPanel({ root, support }: { root: string; support: string }) {
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      window.location.href = unwrap(await findPanelAction(slug)).url;
    } catch (e) { setErr(e instanceof Error ? e.message : "خطا"); setBusy(false); }
  }
  return (
    <form onSubmit={go} className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-black">ورود به پنلِ مدیریت</h1>
      <p className="mt-1 text-sm text-muted-foreground">آدرسِ منوی مجموعه‌تان را وارد کنید.</p>
      <div dir="ltr" className="mt-6 flex items-center overflow-hidden rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <input required autoFocus value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().trim())} placeholder="roya" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
        <span className="shrink-0 bg-muted px-3 py-3 text-sm text-muted-foreground">.{root}</span>
      </div>
      {err && <p className="mt-3 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">{err}</p>}
      <Button type="submit" size="lg" className="mt-5 h-12 w-full rounded-2xl" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <><LogIn className="size-5" /> ادامه</>}</Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        آدرس یا رمز را فراموش کرده‌اید؟ {support ? <>با پشتیبانی تماس بگیرید: <span dir="ltr">{support}</span></> : "با پشتیبانی تماس بگیرید."}
      </p>
    </form>
  );
}
