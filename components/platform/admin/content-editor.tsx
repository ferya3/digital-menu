"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, Save, Store, Trash2 } from "lucide-react";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { adminContentAction, adminSaveContentAction, adminUploadLogoAction } from "@/app/platform/actions";
import { BRAND_COLORS, DEFAULT_CONTENT, FEATURE_ICONS, type SiteContent } from "@/lib/site-content";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const SECTIONS = [
  ["brand", "برند و سئو"], ["announce", "نوارِ اعلان"], ["hero", "بالای صفحه"], ["features", "امکانات"], ["steps", "مراحل"],
  ["pricing", "تعرفه‌ها"], ["faq", "سؤالات"], ["footer", "پاورقی و تماس"], ["forms", "ثبت‌نام و ورود"], ["legal", "قوانین"], ["system", "پیام‌های سیستمی"],
] as const;
type Sec = (typeof SECTIONS)[number][0];


/** فهرستِ قابلِ افزودن/حذف/جابه‌جایی */
function ListEditor<T>({ items, onChange, render, make, addLabel }: {
  items: T[]; onChange: (v: T[]) => void; render: (it: T, set: (v: T) => void, i: number) => React.ReactNode; make: () => T; addLabel: string;
}) {
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-2xl border border-border bg-background p-3">
          <div className="min-w-0 flex-1 space-y-2">{render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}</div>
          <div className="flex shrink-0 flex-col gap-1">
            <button type="button" aria-label="بالا" onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-lg hover:bg-muted"><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="پایین" onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-lg hover:bg-muted"><ArrowDown className="size-4" /></button>
            <button type="button" aria-label="حذف" onClick={() => onChange(items.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => onChange([...items, make()])}><Plus className="size-4" /> {addLabel}</Button>
    </div>
  );
}

export function ContentEditor({ flash, siteUrl }: { flash: Flash; siteUrl: string }) {
  const [c, setC] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState("");
  const [sec, setSec] = useState<Sec>("brand");
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { adminContentAction().then((r) => { const v = unwrap(r); setC(v); setSaved(JSON.stringify(v)); }).catch((e) => flash("❌ " + err(e))); }, [flash]);
  if (!c) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  const dirty = JSON.stringify(c) !== saved;
  const set = <K extends keyof SiteContent>(k: K, v: Partial<SiteContent[K]>) => setC({ ...c, [k]: Array.isArray(c[k]) ? v : { ...(c[k] as object), ...v } } as SiteContent);
  const reset = (k: keyof SiteContent) => { if (confirm("متن‌های این بخش به حالتِ پیش‌فرض برگردد؟")) setC({ ...c, [k]: structuredClone(DEFAULT_CONTENT[k]) }); };

  async function save() {
    setBusy(true);
    try { const v = unwrap(await adminSaveContentAction(c!)); setC(v); setSaved(JSON.stringify(v)); flash("✅ محتوای سایت ذخیره شد"); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  async function uploadLogo(f: File) {
    setLogoBusy(true);
    try { const { url } = unwrap(await adminUploadLogoAction(imageForm(await compressImage(f, 512, 0.9)))); set("brand", { logo: url }); }
    catch (e) { flash("❌ " + err(e)); } finally { setLogoBusy(false); }
  }
  const resetBtn = (k: keyof SiteContent) => <button type="button" onClick={() => reset(k)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /> پیش‌فرض</button>;
  const inp = (v: string, on: (s: string) => void, ph = "", ltr = false) => <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} dir={ltr ? "ltr" : undefined} className={smallField} />;
  const area = (v: string, on: (s: string) => void, rows = 3) => <textarea value={v} onChange={(e) => on(e.target.value)} rows={rows} className={cn(smallField, "resize-y leading-7")} />;

  return (
    <div className="space-y-4">
      {/* نوارِ ذخیره */}
      <div className="sticky top-[60px] z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <Button className="rounded-xl" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <><Save className="size-4" /> ذخیره</>}</Button>
        {dirty && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">تغییراتِ ذخیره‌نشده</span>}
        <a href={siteUrl} target="_blank" rel="noopener" className="ms-auto flex items-center gap-1 text-sm font-semibold text-primary"><ExternalLink className="size-4" /> مشاهدهٔ سایت</a>
      </div>
      <p className="text-xs text-muted-foreground">در همهٔ متن‌ها می‌توانید از <code dir="ltr">{"{brand}"}</code> (نامِ برند)، <code dir="ltr">{"{trialDays}"}</code> (روزهای رایگان) و <code dir="ltr">{"{root}"}</code> (دامنه) استفاده کنید.</p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => setSec(id)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", sec === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {sec === "brand" && (
        <Box title="برند و سئو" action={resetBtn("brand")}>
          <L t="نامِ برند">{inp(c.brand.name, (v) => set("brand", { name: v }))}</L>
          <L t="لوگو" hint="عکس (مربعی) یا یک ایموجی؛ خالی = آیکونِ فروشگاه">
            <div className="flex items-center gap-2">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-xl text-primary-foreground" style={{ background: BRAND_COLORS.find((x) => x.id === c.brand.color)?.hex }}>
                {/^(\/|https?:)/.test(c.brand.logo)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.brand.logo} alt="" className="size-full object-cover" /> : c.brand.logo || <Store className="size-6" />}
              </span>
              <input value={/^(\/|https?:)/.test(c.brand.logo) ? "" : c.brand.logo} onChange={(e) => set("brand", { logo: e.target.value })} placeholder="ایموجی، مثل ☕" className={cn(smallField, "max-w-32")} />
              <input ref={logoRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={logoBusy} onClick={() => logoRef.current?.click()}>{logoBusy ? <Loader2 className="animate-spin" /> : <><ImagePlus className="size-4" /> آپلودِ عکس</>}</Button>
              {c.brand.logo && <button type="button" onClick={() => set("brand", { logo: "" })} className="text-xs text-muted-foreground hover:text-primary">حذف</button>}
            </div>
          </L>
          <L t="رنگِ اصلیِ سایت">
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((col) => (
                <button key={col.id} type="button" title={col.label} onClick={() => set("brand", { color: col.id })}
                  className={cn("size-9 rounded-full ring-offset-2 ring-offset-card transition", c.brand.color === col.id && "ring-2 ring-foreground")} style={{ background: col.hex }} />
              ))}
            </div>
          </L>
          <L t="عنوانِ صفحه در گوگل و تبِ مرورگر">{inp(c.brand.seoTitle, (v) => set("brand", { seoTitle: v }))}</L>
          <L t="توضیحِ صفحه در نتایجِ گوگل">{area(c.brand.seoDescription, (v) => set("brand", { seoDescription: v }), 2)}</L>
        </Box>
      )}

      {sec === "announce" && (
        <Box title="نوارِ اعلان بالای سایت" action={resetBtn("announce")}>
          <Toggle checked={c.announce.enabled} onChange={(v) => set("announce", { enabled: v })} label="نمایشِ نوارِ اعلان" />
          <L t="متن">{inp(c.announce.text, (v) => set("announce", { text: v }), "مثلاً: جشنوارهٔ نوروزی — ۳۰٪ تخفیف")}</L>
          <L t="لینک (اختیاری)" hint="مثلاً /signup یا آدرسِ کامل">{inp(c.announce.link, (v) => set("announce", { link: v }), "/signup", true)}</L>
        </Box>
      )}

      {sec === "hero" && (
        <Box title="بالای صفحهٔ اصلی" action={resetBtn("hero")}>
          <L t="برچسبِ کوچکِ بالا">{inp(c.hero.badge, (v) => set("hero", { badge: v }))}</L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="تیترِ اصلی">{inp(c.hero.title, (v) => set("hero", { title: v }))}</L>
            <L t="ادامهٔ تیتر (رنگی)">{inp(c.hero.highlight, (v) => set("hero", { highlight: v }))}</L>
          </div>
          <L t="توضیح">{area(c.hero.subtitle, (v) => set("hero", { subtitle: v }), 3)}</L>
          <div className="grid gap-3 sm:grid-cols-3">
            <L t="دکمهٔ اصلی">{inp(c.hero.ctaPrimary, (v) => set("hero", { ctaPrimary: v }))}</L>
            <L t="دکمهٔ دوم">{inp(c.hero.ctaSecondary, (v) => set("hero", { ctaSecondary: v }))}</L>
            <L t="نامِ نمونه در تصویرِ گوشی">{inp(c.hero.mockupName, (v) => set("hero", { mockupName: v }))}</L>
          </div>
          <L t="برچسب‌های «مناسب برای»">
            <ListEditor items={c.kinds} onChange={(v) => setC({ ...c, kinds: v })} make={() => ""} addLabel="برچسبِ جدید"
              render={(it, s) => inp(it, s, "مثلاً 🍕 پیتزافروشی")} />
          </L>
        </Box>
      )}

      {sec === "features" && (
        <Box title="بخشِ امکانات" action={resetBtn("features")}>
          <L t="تیتر">{inp(c.features.title, (v) => set("features", { title: v }))}</L>
          <L t="زیرتیتر">{inp(c.features.subtitle, (v) => set("features", { subtitle: v }))}</L>
          <ListEditor items={c.features.items} onChange={(v) => set("features", { items: v })} make={() => ({ icon: "Sparkles", title: "", text: "" })} addLabel="کارتِ جدید"
            render={(it, s) => (
              <>
                <div className="flex gap-2">
                  <select value={it.icon} onChange={(e) => s({ ...it, icon: e.target.value })} className={cn(smallField, "w-40")}>
                    {FEATURE_ICONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FeatureIcon name={it.icon} /></span>
                  <input value={it.title} onChange={(e) => s({ ...it, title: e.target.value })} placeholder="عنوان" className={smallField} />
                </div>
                <textarea value={it.text} onChange={(e) => s({ ...it, text: e.target.value })} rows={2} placeholder="توضیح" className={cn(smallField, "resize-y")} />
              </>
            )} />
        </Box>
      )}

      {sec === "steps" && (
        <Box title="مراحلِ راه‌اندازی" action={resetBtn("steps")}>
          <L t="تیتر">{inp(c.steps.title, (v) => set("steps", { title: v }))}</L>
          <ListEditor items={c.steps.items} onChange={(v) => set("steps", { items: v })} make={() => ({ title: "", text: "" })} addLabel="مرحلهٔ جدید"
            render={(it, s) => (<>{inp(it.title, (v) => s({ ...it, title: v }), "عنوان")}{area(it.text, (v) => s({ ...it, text: v }), 2)}</>)} />
        </Box>
      )}

      {sec === "pricing" && (
        <Box title="بخشِ تعرفه‌ها" action={resetBtn("pricing")}>
          <p className="text-xs text-muted-foreground">قیمت و مدتِ طرح‌ها از «تنظیمات ← طرح‌های اشتراک» عوض می‌شود.</p>
          <L t="تیتر">{inp(c.pricing.title, (v) => set("pricing", { title: v }))}</L>
          <L t="زیرتیتر">{inp(c.pricing.subtitle, (v) => set("pricing", { subtitle: v }))}</L>
          <L t="متنِ دکمه">{inp(c.pricing.cta, (v) => set("pricing", { cta: v }))}</L>
          <L t="امکاناتِ هر طرح (تیک‌دار)">
            <ListEditor items={c.pricing.bullets} onChange={(v) => set("pricing", { bullets: v })} make={() => ""} addLabel="مورِد جدید" render={(it, s) => inp(it, s)} />
          </L>
        </Box>
      )}

      {sec === "faq" && (
        <Box title="سؤالاتِ رایج" action={resetBtn("faq")}>
          <L t="تیتر">{inp(c.faq.title, (v) => set("faq", { title: v }))}</L>
          <ListEditor items={c.faq.items} onChange={(v) => set("faq", { items: v })} make={() => ({ q: "", a: "" })} addLabel="سؤالِ جدید"
            render={(it, s) => (<>{inp(it.q, (v) => s({ ...it, q: v }), "سؤال")}{area(it.a, (v) => s({ ...it, a: v }), 3)}</>)} />
        </Box>
      )}

      {sec === "footer" && (
        <Box title="پاورقی و راه‌های تماس" action={resetBtn("footer")}>
          <L t="متنِ پاورقی">{inp(c.footer.text, (v) => set("footer", { text: v }))}</L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="تلفنِ پشتیبانی">{inp(c.footer.phone, (v) => set("footer", { phone: v }), "021…", true)}</L>
            <L t="ایمیل">{inp(c.footer.email, (v) => set("footer", { email: v }), "info@…", true)}</L>
            <L t="اینستاگرام">{inp(c.footer.instagram, (v) => set("footer", { instagram: v }), "@page", true)}</L>
            <L t="تلگرام">{inp(c.footer.telegram, (v) => set("footer", { telegram: v }), "@channel", true)}</L>
            <L t="واتساپ (شماره)">{inp(c.footer.whatsapp, (v) => set("footer", { whatsapp: v }), "0912…", true)}</L>
            <L t="آدرس">{inp(c.footer.address, (v) => set("footer", { address: v }))}</L>
          </div>
        </Box>
      )}

      {sec === "forms" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="صفحهٔ ثبت‌نام" action={resetBtn("signup")}>
            <L t="تیتر">{inp(c.signup.title, (v) => set("signup", { title: v }))}</L>
            <L t="توضیح">{inp(c.signup.subtitle, (v) => set("signup", { subtitle: v }))}</L>
            <L t="متنِ دکمه">{inp(c.signup.button, (v) => set("signup", { button: v }))}</L>
            <Toggle checked={c.signup.requireTerms} onChange={(v) => set("signup", { requireTerms: v })} label="تیکِ «قوانین را می‌پذیرم» اجباری باشد" />
          </Box>
          <Box title="صفحهٔ ورود به پنل" action={resetBtn("login")}>
            <L t="تیتر">{inp(c.login.title, (v) => set("login", { title: v }))}</L>
            <L t="توضیح">{inp(c.login.subtitle, (v) => set("login", { subtitle: v }))}</L>
            <L t="راهنمای پایین (تلفنِ پشتیبانی خودکار اضافه می‌شود)">{inp(c.login.help, (v) => set("login", { help: v }))}</L>
          </Box>
        </div>
      )}

      {sec === "legal" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(["terms", "privacy"] as const).map((k) => (
            <Box key={k} title={k === "terms" ? "قوانین و شرایط (/terms)" : "حریمِ خصوصی (/privacy)"} action={<a href={`${siteUrl}${k}`} target="_blank" rel="noopener" className="text-xs font-semibold text-primary">مشاهده</a>}>
              <p className="text-[11px] text-muted-foreground">خطی که با <code>## </code> شروع شود تیتر است، با <code>- </code> فهرست؛ خطِ خالی = پاراگرافِ جدید.</p>
              <textarea value={c.legal[k]} onChange={(e) => set("legal", { [k]: e.target.value })} rows={16} className={cn(smallField, "resize-y font-mono text-[13px] leading-7")} dir="rtl" />
            </Box>
          ))}
        </div>
      )}

      {sec === "system" && (
        <Box title="پیام‌هایی که مشتریانِ مجموعه‌ها می‌بینند" action={resetBtn("unavailable")}>
          <L t="آدرسِ اشتباه — تیتر">{inp(c.unavailable.missingTitle, (v) => set("unavailable", { missingTitle: v }))}</L>
          <L t="آدرسِ اشتباه — توضیح">{area(c.unavailable.missingText, (v) => set("unavailable", { missingText: v }), 2)}</L>
          <L t="اشتراکِ تمام‌شده — تیتر" hint="{name} = نامِ مجموعه">{inp(c.unavailable.inactiveTitle, (v) => set("unavailable", { inactiveTitle: v }))}</L>
          <L t="اشتراکِ تمام‌شده — توضیح">{area(c.unavailable.inactiveText, (v) => set("unavailable", { inactiveText: v }), 2)}</L>
        </Box>
      )}
    </div>
  );
}
