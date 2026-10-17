"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { checkSlugAction, signupAction, signupOtpAction } from "@/app/platform/actions";
import type { BusinessKind } from "@/lib/seeds";

export const fieldCls =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

function Label({ text, hint, children }: { text: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

export function SignupForm({ root, trialDays, otp, kinds }: { root: string; trialDays: number; otp: boolean; kinds: Record<BusinessKind, string> }) {
  const [f, setF] = useState({ name: "", kind: "cafe" as BusinessKind, slug: "", ownerName: "", phone: "", password: "", code: "", sample: true, website: "" });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const [slugState, setSlugState] = useState<{ ok: boolean; message: string } | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ host: string } | null>(null);

  // بررسیِ زندهٔ آزاد بودنِ آدرس
  useEffect(() => {
    if (f.slug.length < 3) { setSlugState(null); return; }
    const t = window.setTimeout(() => {
      checkSlugAction(f.slug).then((r) => setSlugState({ ok: r.ok, message: r.message })).catch(() => {});
    }, 350);
    return () => window.clearTimeout(t);
  }, [f.slug]);

  async function sendCode() {
    setErr(""); setBusy(true);
    try {
      const r = unwrap(await signupOtpAction(f.phone));
      setCodeSent(r.required);
    } catch (e) { setErr(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (otp && !codeSent) return sendCode();
    setBusy(true);
    try {
      const r = unwrap(await signupAction({ ...f, phone: toLatinDigits(f.phone), code: toLatinDigits(f.code) }));
      setDone({ host: r.host });
      window.location.href = r.url;
    } catch (e) { setErr(e instanceof Error ? e.message : "خطا"); setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" />
        <h1 className="mt-4 text-xl font-black">در حال آماده‌سازیِ منوی شما…</h1>
        <p className="mt-2 text-sm text-muted-foreground" dir="ltr">{done.host}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-black">ساختِ منوی دیجیتال</h1>
      <p className="mt-1 text-sm text-muted-foreground">{trialDays > 0 ? `${toFa(trialDays)} روزِ اول رایگان است؛ بدونِ نیاز به کارت بانکی.` : "در کمتر از یک دقیقه آماده است."}</p>

      <div className="mt-6 space-y-4">
        <Label text="نامِ مجموعه">
          <input required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً کافه رویا" className={fieldCls} maxLength={60} />
        </Label>
        <div>
          <span className="mb-1.5 block text-sm font-bold">نوعِ کسب‌وکار</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(kinds) as BusinessKind[]).map((k) => (
              <button type="button" key={k} onClick={() => set({ kind: k })} className={cn("rounded-2xl border-2 px-3 py-2.5 text-sm font-semibold transition", f.kind === k ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40")}>
                {kinds[k]}
              </button>
            ))}
          </div>
        </div>
        <Label
          text="آدرسِ منو"
          hint={slugState ? <span className={cn("flex items-center gap-1 font-semibold", slugState.ok ? "text-green-700 dark:text-green-400" : "text-primary")}>{slugState.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}{slugState.message}</span> : "حروفِ انگلیسیِ کوچک، عدد و خط‌تیره — بعداً روی QRها چاپ می‌شود"}
        >
          <div dir="ltr" className="flex items-center overflow-hidden rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <input required value={f.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="roya" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" maxLength={30} />
            <span className="shrink-0 bg-muted px-3 py-3 text-sm text-muted-foreground">.{root}</span>
          </div>
        </Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="نامِ شما">
            <input value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} placeholder="نام و نام خانوادگی" className={fieldCls} maxLength={60} />
          </Label>
          <Label text="موبایل">
            <input required value={f.phone} onChange={(e) => { set({ phone: e.target.value }); setCodeSent(false); }} inputMode="tel" dir="ltr" placeholder="09123456789" className={fieldCls} />
          </Label>
        </div>
        <Label text="رمزِ پنلِ مدیریت" hint="حداقل ۶ نویسه؛ با همین رمز وارد پنلِ مجموعه می‌شوید">
          <input required type="password" minLength={6} value={f.password} onChange={(e) => set({ password: e.target.value })} className={fieldCls} autoComplete="new-password" />
        </Label>
        {/* تلهٔ ربات‌ها: برای انسان دیده نمی‌شود */}
        <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set({ website: e.target.value })} className="hidden" aria-hidden name="website" />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={f.sample} onChange={(e) => set({ sample: e.target.checked })} />
          با منوی نمونه شروع کن (بعداً قابل حذف است)
        </label>
        {otp && codeSent && (
          <Label text="کدِ تأییدِ پیامک‌شده" hint={<button type="button" onClick={sendCode} className="font-semibold text-primary underline">ارسالِ دوبارهٔ کد</button>}>
            <input required value={f.code} onChange={(e) => set({ code: e.target.value })} inputMode="numeric" dir="ltr" placeholder="12345" className={fieldCls} autoFocus />
          </Label>
        )}
      </div>

      {err && <p className="mt-4 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">{err}</p>}
      <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-2xl text-base" disabled={busy || (slugState !== null && !slugState.ok)}>
        {busy ? <Loader2 className="animate-spin" /> : otp && !codeSent ? "دریافتِ کدِ تأیید" : <><Rocket className="size-5" /> ساختِ منو</>}
      </Button>
    </form>
  );
}
