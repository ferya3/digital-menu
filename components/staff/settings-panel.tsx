"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ImageIcon, X, Save, Store, CreditCard, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImage, imageForm } from "@/lib/client-image";
import type { CafeInfo, PaymentInfo } from "@/lib/types";
import { staffSettingsAction, staffUpdateSettingsAction } from "@/app/staff/actions";

const input = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const isImg = (s: string) => /^https?:|^data:|^blob:|^\/uploads\//.test(s || "");

export function SettingsPanel({ flash }: { flash: (m: string) => void }) {
  const [cafe, setCafe] = useState<CafeInfo | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    staffSettingsAction().then((s) => { setCafe(s.cafe); setPayment(s.payment); setHasPassword(s.hasPassword); }).catch(() => {});
  }, []);

  if (!cafe || !payment) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  async function save() {
    setSaving(true);
    try {
      await staffUpdateSettingsAction({
        cafe: cafe!, payment: payment!,
        ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {}),
      }, logoBlob ? imageForm(logoBlob) : null);
      setLogoBlob(null);
      setNewPassword("");
      flash("تنظیمات ذخیره شد ✅");
    } catch (e) { flash(e instanceof Error ? e.message : "خطا"); } finally { setSaving(false); }
  }

  const logoPreview = logoUrl || cafe.logo;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card icon={<Store className="size-4" />} title="اطلاعات کافه">
        <div className="flex items-center gap-3">
          {isImg(logoPreview) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className="size-14 rounded-2xl object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-muted text-3xl">{logoPreview || "☕"}</span>
          )}
          <div className="flex-1"><Field label="نام کافه"><input value={cafe.name} onChange={(e) => setCafe({ ...cafe, name: e.target.value })} className={input} /></Field></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="لوگو (ایموجی)">
            <div className="flex gap-2">
              <input value={isImg(cafe.logo) ? "" : cafe.logo} onChange={(e) => setCafe({ ...cafe, logo: e.target.value })} placeholder="☕" className={input} />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const b = await compressImage(f, 512); setLogoBlob(b); setLogoUrl(URL.createObjectURL(b)); } }} />
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /></Button>
              {(logoUrl || isImg(cafe.logo)) && <Button variant="ghost" size="icon" onClick={() => { setLogoBlob(null); setLogoUrl(""); setCafe({ ...cafe, logo: "☕" }); }}><X /></Button>}
            </div>
          </Field>
          <Field label="شعار / زیرعنوان"><input value={cafe.tagline} onChange={(e) => setCafe({ ...cafe, tagline: e.target.value })} className={input} /></Field>
        </div>
        <Field label="واحد پول">
          <div className="flex gap-2">
            {(["toman", "rial"] as const).map((c) => (
              <button key={c} onClick={() => setCafe({ ...cafe, currency: c })} className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition", cafe.currency === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background")}>{c === "toman" ? "تومان" : "ریال"}</button>
            ))}
          </div>
        </Field>
      </Card>

      <Card icon={<CreditCard className="size-4" />} title="اطلاعات پرداخت (کارت‌به‌کارت)">
        <p className="text-xs text-muted-foreground">هنگام درخواست صورتحساب به مشتری نشان داده می‌شود.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="شماره کارت"><input value={payment.card} onChange={(e) => setPayment({ ...payment, card: e.target.value })} className={input} dir="ltr" placeholder="6037-xxxx-xxxx-xxxx" /></Field>
          <Field label="به نام"><input value={payment.holder} onChange={(e) => setPayment({ ...payment, holder: e.target.value })} className={input} /></Field>
          <Field label="لینک پرداخت (اختیاری)"><input value={payment.link} onChange={(e) => setPayment({ ...payment, link: e.target.value })} className={input} dir="ltr" placeholder="https://…" /></Field>
          <Field label="یادداشت"><input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })} className={input} /></Field>
        </div>
      </Card>

      <Card icon={<KeyRound className="size-4" />} title="رمز ورود کارکنان">
        <Field label={hasPassword ? "رمز جدید (خالی = بدون تغییر)" : "تعیین رمز"}><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} placeholder="••••••" /></Field>
      </Card>

      <div className="sticky bottom-3">
        <Button size="lg" className="h-12 w-full rounded-2xl text-base shadow-lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <><Save className="size-5" /> ذخیرهٔ تنظیمات</>}</Button>
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl border border-border bg-card p-4"><h3 className="flex items-center gap-2 font-extrabold">{icon}{title}</h3>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
