"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2, ImageIcon, X, Save, Store, CreditCard, KeyRound, Clapperboard, Upload, Trash2,
  MapPin, Hash, MessageSquareText, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImage, imageForm } from "@/lib/client-image";
import { staffSettingsAction, staffUpdateSettingsAction, type AdminSettings } from "@/app/staff/actions";
import type { Gateway } from "@/lib/types";
import { Field, Panel, Switch, inputCls, isImgSrc, useStaff } from "@/components/staff/kit";

const FIELD_LABELS: Record<string, string> = {
  merchantId: "مرچنت‌کد / Merchant ID",
  terminalId: "شماره ترمینال",
  username: "نام کاربری",
  password: "رمز عبور",
  key: "کلید (Key)",
};

export function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const { flash } = useStaff();
  const [s, setS] = useState<AdminSettings | null>(null);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { staffSettingsAction().then(setS).catch(() => flash("خطا در بارگذاری تنظیمات")); }, [flash]);
  if (!s) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  const cafe = s.cafe, payment = s.payment, sms = s.sms;
  const setCafe = (p: Partial<AdminSettings["cafe"]>) => setS({ ...s, cafe: { ...cafe, ...p } });
  const setPayment = (p: Partial<AdminSettings["payment"]>) => setS({ ...s, payment: { ...payment, ...p } });
  const setSms = (p: Partial<AdminSettings["sms"]>) => setS({ ...s, sms: { ...sms, ...p } });
  const setGateway = (id: Gateway["id"], p: Partial<Gateway>) =>
    setS({ ...s, gateways: s.gateways.map((g) => (g.id === id ? { ...g, ...p, config: { ...g.config, ...(p.config || {}) } } : g)) });

  async function save() {
    setSaving(true);
    try {
      await staffUpdateSettingsAction({
        cafe: { ...cafe, name: cafe.name.trim() || "کافه", logo: cafe.logo || "☕" },
        payment, orderCode: s!.orderCode, sms, gateways: s!.gateways,
        ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {}),
      }, logoBlob ? imageForm(logoBlob) : null);
      setLogoBlob(null);
      if (newPassword.trim()) setS({ ...s!, hasPassword: true });
      setNewPassword("");
      flash("✅ تنظیمات با موفقیت ذخیره شد");
      onSaved();
    } catch (e) { flash("❌ ذخیره نشد: " + (e instanceof Error ? e.message : "خطا")); } finally { setSaving(false); }
  }

  const logoPreview = logoUrl || cafe.logo;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <Panel icon={<Store className="size-5 text-primary" />} title="مشخصات کافه">
        <div className="flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted text-3xl">
            {isImgSrc(logoPreview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="size-full object-cover" />
            ) : logoPreview || "☕"}
          </span>
          <Field label="نام کافه" className="flex-1"><input value={cafe.name} onChange={(e) => setCafe({ name: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="لوگو (ایموجی مثل ☕ یا عکس)">
            <div className="flex gap-2">
              <input value={isImgSrc(cafe.logo) ? "" : cafe.logo} onChange={(e) => { setCafe({ logo: e.target.value }); setLogoBlob(null); setLogoUrl(""); }} placeholder="☕" className={inputCls} />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const b = await compressImage(f, 512); setLogoBlob(b); setLogoUrl(URL.createObjectURL(b)); } }} />
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => fileRef.current?.click()} aria-label="آپلود لوگو"><ImageIcon className="size-4" /></Button>
              {(logoUrl || isImgSrc(cafe.logo)) && <Button variant="ghost" size="icon" onClick={() => { setLogoBlob(null); setLogoUrl(""); setCafe({ logo: "☕" }); }} aria-label="حذف لوگو"><X /></Button>}
            </div>
          </Field>
          <Field label="شعار / زیرعنوان (اختیاری)"><input value={cafe.tagline} onChange={(e) => setCafe({ tagline: e.target.value })} className={inputCls} placeholder="مثلاً قهوه‌ای برای لحظه‌های خاص" /></Field>
        </div>
        <Field label="واحد پول" className="mt-3">
          <div className="flex gap-2">
            {(["toman", "rial"] as const).map((c) => (
              <button key={c} onClick={() => setCafe({ currency: c })} className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition", cafe.currency === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background")}>{c === "toman" ? "تومان" : "ریال"}</button>
            ))}
          </div>
        </Field>
      </Panel>

      <HeroVideoCard video={cafe.heroVideo || ""} onChange={(v) => setS((cur) => (cur ? { ...cur, cafe: { ...cur.cafe, heroVideo: v } } : cur))} flash={flash} />

      <Panel icon={<MapPin className="size-5 text-primary" />} title="آدرس و شبکه‌های اجتماعی">
        <p className="mb-3 text-xs text-muted-foreground">برای اشتراک‌گذاری محصولات همراه لوکیشن استفاده می‌شود.</p>
        <div className="grid gap-3">
          <Field label="آدرس کافه"><input value={cafe.address || ""} onChange={(e) => setCafe({ address: e.target.value })} className={inputCls} placeholder="مثلاً تهران، خیابان …" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="لینک نقشه (گوگل‌مپ / نشان / بلد)"><input value={cafe.mapUrl || ""} onChange={(e) => setCafe({ mapUrl: e.target.value })} className={inputCls} dir="ltr" placeholder="https://…" /></Field>
            <Field label="پیج اینستاگرام (آیدی یا لینک)"><input value={cafe.instagram || ""} onChange={(e) => setCafe({ instagram: e.target.value })} className={inputCls} dir="ltr" placeholder="@mycafe" /></Field>
          </div>
        </div>
      </Panel>

      <Panel icon={<Hash className="size-5 text-primary" />} title="نمایش کد سفارش">
        <Field label="کد سفارش چطور نمایش داده شود؟">
          <select value={s.orderCode} onChange={(e) => setS({ ...s, orderCode: e.target.value === "id" ? "id" : "number" })} className={inputCls}>
            <option value="number">فقط عدد ترتیبی (#۱، #۲ …) — پیگیری آسان‌تر</option>
            <option value="id">کد کامل (ord_xxxx)</option>
          </select>
        </Field>
      </Panel>

      <Panel icon={<CreditCard className="size-5 text-primary" />} title="پرداخت (لینک یا کارت‌به‌کارت)">
        <p className="mb-3 text-xs text-muted-foreground">هنگام درخواست صورتحساب به مشتری نشان داده می‌شود؛ مشتری پرداخت می‌کند و فیش را آپلود می‌کند.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="لینک پرداخت آنلاین (اختیاری)"><input value={payment.link} onChange={(e) => setPayment({ link: e.target.value })} className={inputCls} dir="ltr" placeholder="https://zarinp.al/…" /></Field>
          <Field label="شماره کارت (اختیاری)"><input value={payment.card} onChange={(e) => setPayment({ card: e.target.value })} className={inputCls} dir="ltr" placeholder="6037-xxxx-xxxx-xxxx" /></Field>
          <Field label="به نام (صاحب کارت)"><input value={payment.holder} onChange={(e) => setPayment({ holder: e.target.value })} className={inputCls} placeholder="نام و نام خانوادگی" /></Field>
          <Field label="توضیح پرداخت (اختیاری)"><input value={payment.note} onChange={(e) => setPayment({ note: e.target.value })} className={inputCls} placeholder="مثلاً پس از واریز، فیش را آپلود کنید" /></Field>
        </div>
      </Panel>

      <Panel icon={<MessageSquareText className="size-5 text-primary" />} title="سامانهٔ پیامک (کد تأیید مشتری)">
        <div className="mb-3 rounded-2xl bg-muted/60 p-3">
          <Switch checked={sms.otpEnabled} onChange={(v) => setSms({ otpEnabled: v })} label="دریافت شمارهٔ مشتری با کد تأیید (قبل از دیدن منو)" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">شماره‌های تأییدشده در «مشتری‌ها» جمع می‌شوند و روی سفارش‌ها نمایش داده می‌شوند. اگر سامانه «هیچ‌کدام» باشد، کد در حالت آزمایشی روی صفحه نشان داده می‌شود.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="سامانه پیامک">
            <select value={sms.provider} onChange={(e) => setSms({ provider: e.target.value === "kavenegar" ? "kavenegar" : "none" })} className={inputCls}>
              <option value="none">هیچ‌کدام (حالت آزمایشی)</option>
              <option value="kavenegar">کاوه‌نگار</option>
            </select>
          </Field>
          <Field label="نام الگو / Template (مخصوص کاوه‌نگار)"><input value={sms.template} onChange={(e) => setSms({ template: e.target.value })} className={inputCls} dir="ltr" placeholder="verify" /></Field>
          <Field label="کلید API" className="sm:col-span-2"><input value={sms.apiKey} onChange={(e) => setSms({ apiKey: e.target.value })} className={inputCls} dir="ltr" placeholder="API Key سامانه پیامک" /></Field>
        </div>
      </Panel>

      <Panel icon={<Landmark className="size-5 text-primary" />} title="درگاه‌های پرداخت">
        <p className="mb-3 text-xs text-muted-foreground">درگاه موردنظر را فعال کنید و اطلاعات آن را وارد کنید (اطلاعات فقط در پنل مدیر دیده می‌شود).</p>
        <div className="space-y-3">
          {s.gateways.map((g) => (
            <div key={g.id} className={cn("rounded-2xl border p-3 transition", g.enabled ? "border-primary/40 bg-primary/5" : "border-border")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-sm">{g.name}</strong>
                <Switch checked={g.enabled} onChange={(v) => setGateway(g.id, { enabled: v })} label="فعال" />
              </div>
              {g.enabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.keys(g.config).map((k) => (
                    <Field key={k} label={FIELD_LABELS[k] || k}>
                      <input type={k === "password" ? "password" : "text"} value={g.config[k] || ""} onChange={(e) => setGateway(g.id, { config: { [k]: e.target.value } })} className={inputCls} dir="ltr" />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel icon={<KeyRound className="size-5 text-primary" />} title="رمز عبور مدیر">
        <Field label="رمز عبور جدید (خالی بگذارید = بدون تغییر)">
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        <p className={cn("mt-2 text-xs", s.hasPassword ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400")}>
          {s.hasPassword ? "✅ رمز عبور سفارشی تنظیم شده است" : "⚠️ رمز عبور روی مقدار نصب (پیش‌فرض) است — بهتر است تغییرش دهید"}
        </p>
      </Panel>

      <div className="sticky bottom-3 z-10">
        <Button size="lg" className="h-12 w-full rounded-2xl text-base shadow-lg" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" /> در حال ذخیره…</> : <><Save className="size-5" /> ذخیره تنظیمات</>}
        </Button>
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
      let r: { ok?: boolean; heroVideo?: string; error?: string; optimizing?: boolean } = {};
      try { r = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 413 && !r.error) r.error = "حجم فایل برای سرور زیاد است";
      if (r.ok && r.heroVideo) {
        onChange(r.heroVideo);
        flash(r.optimizing ? "ویدیو آپلود شد ✅ — در حال سبک‌سازی برای بازشدنِ سریع (تا یکی دو دقیقه)" : "ویدیوی هیرو آپلود شد ✅");
      }
      else flash(r.error || "خطا در آپلود ویدیو");
    };
    xhr.onerror = () => { setProgress(null); flash("اتصال قطع شد"); };
    setProgress(0);
    xhr.send(f);
  }

  async function optimize() {
    const r = await fetch("/staff/hero-video", { method: "PATCH" }).then((x) => x.json()).catch(() => ({ ok: false }));
    flash(r.ok ? (r.already ? "ویدیو از قبل سبک شده است ✅" : "سبک‌سازی شروع شد — تا یکی دو دقیقه آماده می‌شود") : r.error || "خطا");
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
    <Panel icon={<Clapperboard className="size-5 text-primary" />} title="ویدیوی صفحهٔ اول (هیرو)">
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
        {video && !/-web\.mp4$/.test(video) && (
          <Button variant="outline" className="rounded-xl" disabled={progress !== null} onClick={optimize} title="کم‌حجم‌کردنِ ویدیو برای بازشدنِ سریع">سبک‌سازی</Button>
        )}
        {video && (
          <Button variant="outline" className="rounded-xl text-primary" disabled={removing || progress !== null} onClick={remove}>
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />} حذف
          </Button>
        )}
      </div>
    </Panel>
  );
}
