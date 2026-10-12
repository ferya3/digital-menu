"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ImageIcon, X, Save, Store, CreditCard, KeyRound, Clapperboard, Upload, Trash2 } from "lucide-react";
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

      <HeroVideoCard
        video={cafe.heroVideo || ""}
        onChange={(v) => setCafe((c) => (c ? { ...c, heroVideo: v } : c))}
        flash={flash}
      />

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

/** ویدیوی هیرو: مستقیم (بدون Server Action) با نوار پیشرفت آپلود می‌شود */
function HeroVideoCard({ video, onChange, flash }: { video: string; onChange: (v: string) => void; flash: (m: string) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);

  function upload(f: File) {
    if (!/^video\/(mp4|webm|quicktime)$/.test(f.type)) return flash("فقط ویدیوی MP4 یا WebM");
    if (f.size > 100 * 1024 * 1024) return flash("حجم ویدیو بیش از ۱۰۰ مگابایت است");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/staff/hero-video");
    xhr.setRequestHeader("Content-Type", f.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let r: { ok?: boolean; heroVideo?: string; error?: string } = {};
      try { r = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 413 && !r.error) r.error = "حجم فایل برای سرور زیاد است";
      if (r.ok && r.heroVideo) { onChange(r.heroVideo); flash("ویدیوی هیرو آپلود شد ✅"); }
      else flash(r.error || "خطا در آپلود ویدیو");
    };
    xhr.onerror = () => { setProgress(null); flash("اتصال قطع شد"); };
    setProgress(0);
    xhr.send(f);
  }

  async function remove() {
    setRemoving(true);
    try {
      const r = await fetch("/staff/hero-video", { method: "DELETE" });
      if (!r.ok) throw new Error();
      onChange("");
      flash("ویدیو حذف شد؛ هیروی سه‌بعدی نمایش داده می‌شود");
    } catch { flash("خطا در حذف ویدیو"); } finally { setRemoving(false); }
  }

  return (
    <Card icon={<Clapperboard className="size-4" />} title="ویدیوی صفحهٔ اول (هیرو)">
      <p className="text-xs text-muted-foreground">
        اگر ویدیو بگذارید، بالای صفحه به‌جای صحنهٔ سه‌بعدی پخش می‌شود (بی‌صدا و تکرارشونده). با حذفش، صحنهٔ سه‌بعدی برمی‌گردد.
        پیشنهاد: MP4 افقی، کوتاه (۱۰ تا ۲۰ ثانیه) و زیر ۲۰ مگابایت برای بازشدنِ سریع.
      </p>
      {video ? (
        <video src={video} muted loop autoPlay playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
          فعلاً صحنهٔ سه‌بعدی نمایش داده می‌شود
        </div>
      )}
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress + "%" }} /></div>
          <div className="text-center text-xs text-muted-foreground">در حال آپلود… {progress.toLocaleString("fa-IR")}٪</div>
        </div>
      )}
      <input ref={ref} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl" disabled={progress !== null} onClick={() => ref.current?.click()}>
          {progress !== null ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />} {video ? "تعویض ویدیو" : "آپلود ویدیو"}
        </Button>
        {video && (
          <Button variant="outline" className="rounded-xl text-primary" disabled={removing || progress !== null} onClick={remove}>
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />} حذف
          </Button>
        )}
      </div>
    </Card>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl border border-border bg-card p-4"><h3 className="flex items-center gap-2 font-extrabold">{icon}{title}</h3>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
