"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, Save, Store, Trash2 } from "lucide-react";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { adminContentAction, adminSaveContentAction, adminUploadCardImageAction, adminUploadLogoAction, adminUploadOgAction } from "@/app/platform/actions";
import { BRAND_COLORS, DEFAULT_CONTENT, FEATURE_ICONS, ICON_LABELS, type FeatureItem, type SiteContent } from "@/lib/site-content";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const SECTIONS = [
  ["brand", "برند و سئو"], ["announce", "نوارِ اعلان"], ["hero", "بالای صفحه"], ["features", "کارت‌های امکانات (کاروسل)"], ["views", "حالت‌های نمایش"], ["steps", "مراحل"],
  ["pricing", "تعرفه‌ها"], ["faq", "سؤالات"], ["showcase", "پنل و دعوتِ پایانی"], ["footer", "پاورقی و تماس"], ["forms", "ثبت‌نام و ورود"], ["legal", "قوانین"], ["system", "پیام‌های سیستمی"],
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
  const ogRef = useRef<HTMLInputElement>(null);

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
  async function uploadOg(f: File) {
    setLogoBusy(true);
    try { const { url } = unwrap(await adminUploadOgAction(imageForm(await compressImage(f, 1600, 0.88)))); set("brand", { ogImage: url }); }
    catch (e) { flash("❌ " + err(e)); } finally { setLogoBusy(false); }
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
          <L t="تصویرِ پیش‌نمایشِ لینک (واتساپ، تلگرام، گوگل)" hint="۱۲۰۰×۶۳۰؛ خالی = تصویرِ خودکار با لوگو و رنگِ برند">
            <div className="flex flex-wrap items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.brand.ogImage || "/og.png"} alt="" className="h-16 w-[122px] rounded-lg border border-border object-cover" />
              <input ref={ogRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOg(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={logoBusy} onClick={() => ogRef.current?.click()}><ImagePlus className="size-4" /> آپلود</Button>
              {c.brand.ogImage && <button type="button" onClick={() => set("brand", { ogImage: "" })} className="text-xs text-muted-foreground hover:text-primary">حذف (تصویرِ خودکار)</button>}
            </div>
          </L>
          <L t="کدِ تأییدِ گوگل (Search Console)" hint='از Search Console ← «HTML tag» فقط مقدارِ content را کپی کنید'>{inp(c.brand.googleVerification, (v) => set("brand", { googleVerification: v.replace(/.*content="([^"]+)".*/, "$1").trim() }), "abc123…", true)}</L>
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
          <L t="ویژگی‌های کوتاهِ زیرِ دکمه‌ها (تیک‌دار)">
            <ListEditor items={c.trust} onChange={(v) => setC({ ...c, trust: v })} make={() => ""} addLabel="مورِد جدید" render={(it, s) => inp(it, s)} />
          </L>
          <L t="برچسب‌های «مناسب برای»">
            <ListEditor items={c.kinds} onChange={(v) => setC({ ...c, kinds: v })} make={() => ""} addLabel="برچسبِ جدید"
              render={(it, s) => inp(it, s, "مثلاً 🍕 پیتزافروشی")} />
          </L>
        </Box>
      )}

      {sec === "features" && <FeaturesEditor c={c} set={set} resetBtn={resetBtn("features")} flash={flash} />}

      {sec === "views" && (
        <Box title="حالت‌های نمایشِ منو" action={resetBtn("views")}>
          <L t="تیتر">{inp(c.views.title, (v) => set("views", { title: v }))}</L>
          <L t="زیرتیتر">{area(c.views.subtitle, (v) => set("views", { subtitle: v }), 2)}</L>
          {(["کاروسلِ سه‌بعدی", "شبکه‌ای", "لیستی"] as const).map((name, i) => {
            const it = c.views.items[i] || DEFAULT_CONTENT.views.items[i];
            const put = (patch: Partial<typeof it>) => set("views", { items: DEFAULT_CONTENT.views.items.map((d, j) => (j === i ? { ...it, ...patch } : c.views.items[j] || d)) });
            return (
              <L key={name} t={`حالتِ ${name}`}>
                <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
                  {inp(it.title, (v) => put({ title: v }), "عنوان")}
                  {area(it.text, (v) => put({ text: v }), 2)}
                </div>
              </L>
            );
          })}
          <L t="ویژگی‌های کنارِ پیش‌نمایش (تیک‌دار)">
            <ListEditor items={c.views.bullets} onChange={(v) => set("views", { bullets: v })} make={() => ""} addLabel="مورِد جدید" render={(it, s) => inp(it, s)} />
          </L>
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

      {sec === "showcase" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="بخشِ معرفیِ پنلِ مدیریت" action={resetBtn("showcase")}>
            <L t="تیتر">{inp(c.showcase.title, (v) => set("showcase", { title: v }))}</L>
            <L t="توضیح">{area(c.showcase.text, (v) => set("showcase", { text: v }), 3)}</L>
            <L t="ویژگی‌ها (تیک‌دار)">
              <ListEditor items={c.showcase.bullets} onChange={(v) => set("showcase", { bullets: v })} make={() => ""} addLabel="مورِد جدید" render={(it, s) => inp(it, s)} />
            </L>
          </Box>
          <Box title="دعوتِ پایانیِ پایینِ صفحه" action={resetBtn("finalCta")}>
            <L t="تیتر">{inp(c.finalCta.title, (v) => set("finalCta", { title: v }))}</L>
            <L t="توضیح">{area(c.finalCta.text, (v) => set("finalCta", { text: v }), 2)}</L>
            <L t="متنِ دکمه">{inp(c.finalCta.button, (v) => set("finalCta", { button: v }))}</L>
          </Box>
        </div>
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

/* ============================ مدیریتِ کارت‌های امکانات ============================ */

/** پیش‌نمایشِ کوچکِ کارت، با همان ظاهرِ کارت‌های کاروسلِ سایت */
function CardPreview({ f, i, wide }: { f: FeatureItem; i: number; wide: boolean }) {
  if (wide) {
    // کارتِ بزرگ: عکس جای تصویرِ QR می‌نشیند (۱۶:۱۰)
    return (
      <div className={cn("relative grid aspect-[16/10] w-44 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent transition", f.hidden && "opacity-40 grayscale")} aria-hidden>
        {f.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={f.image} alt="" className="absolute inset-0 size-full object-cover" />
          : <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><FeatureIcon name={f.icon} className="size-6" /></span>}
      </div>
    );
  }
  if (f.image) {
    return (
      <div className={cn("relative h-44 w-40 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-slate-950 text-white shadow-lg transition", f.hidden && "opacity-40 grayscale")} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.image} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-40% to-black/90" />
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <b className="line-clamp-2 text-[11px] leading-5">{f.title || "بدونِ عنوان"}</b>
          <span className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-white/80">{f.text}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative h-44 w-40 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-slate-950 text-white shadow-lg transition", f.hidden && "opacity-40 grayscale")} aria-hidden>
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 70% at ${30 + ((i * 23) % 40)}% 15%, hsl(var(--primary) / 0.6), transparent 70%)` }} />
      <div className="relative flex h-full flex-col items-center justify-center px-3 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><FeatureIcon name={f.icon} className="size-5" /></span>
        <b className="mt-2.5 line-clamp-2 text-[11px] leading-5">{f.title || "بدونِ عنوان"}</b>
        <span className="mt-1 line-clamp-3 text-[9px] leading-4 text-white/70">{f.text}</span>
      </div>
    </div>
  );
}

/** انتخابِ آیکون با نامِ فارسی */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><FeatureIcon name={value} className="size-4" /></span>
        {ICON_LABELS[value] || value} <span className="text-muted-foreground">· تغییرِ آیکون</span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-2xl border border-border bg-background p-2 sm:grid-cols-6">
          {FEATURE_ICONS.map((n) => (
            <button key={n} type="button" title={ICON_LABELS[n] || n} onClick={() => { onChange(n); setOpen(false); }}
              className={cn("flex flex-col items-center gap-1 rounded-xl p-2 text-[10px] transition", n === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <FeatureIcon name={n} className="size-5" />
              <span className="truncate">{ICON_LABELS[n] || n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** اندازهٔ پیشنهادیِ عکس (پیکسل) — هم‌خوان با قابِ کارت‌ها در سایت */
const CARD_SIZE = { wide: "۱۶۰۰ × ۱۰۰۰ پیکسل · نسبتِ ۱۶:۱۰ (افقی)", card: "۱۰۸۰ × ۱۲۰۰ پیکسل · نسبتِ ۹:۱۰ (تقریباً مربع، کمی ایستاده)" };

function FeaturesEditor({ c, set, resetBtn, flash }: {
  c: SiteContent;
  set: (k: "features", v: Partial<SiteContent["features"]>) => void;
  resetBtn: React.ReactNode;
  flash: Flash;
}) {
  const [uploading, setUploading] = useState(-1);
  const items = c.features.items;
  const put = (v: FeatureItem[]) => set("features", { items: v });
  const upd = (i: number, patch: Partial<FeatureItem>) => put(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; put(n); };
  async function upload(i: number, file: File) {
    setUploading(i);
    try {
      const { url } = unwrap(await adminUploadCardImageAction(imageForm(await compressImage(file, 1600, 0.88))));
      upd(i, { image: url });
    } catch (e) { flash("❌ " + err(e)); } finally { setUploading(-1); }
  }
  const remove = (i: number) => { if (confirm(`کارتِ «${items[i].title || "بدونِ عنوان"}» حذف شود؟`)) put(items.filter((_, j) => j !== i)); };
  // اولین کارتِ نمایان در سایت کارتِ بزرگِ بالاست؛ بقیهٔ کارت‌های نمایان در کاروسل می‌چرخند
  const bigIdx = items.findIndex((f) => !f.hidden);
  const shown = items.filter((f) => !f.hidden).length;
  const secs = c.features.autoplay ?? 3.5;
  const secsFa = toFa(String(secs).replace(".", "٫"));

  const card = (f: FeatureItem, i: number) => (
    <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:flex-row">
      <CardPreview f={f} i={i} wide={i === bigIdx} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", f.hidden ? "bg-muted text-muted-foreground" : i === bigIdx ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
            {f.hidden ? "پنهان" : i === bigIdx ? "کارتِ بزرگِ بالا" : `کاروسل · کارتِ ${toFa(items.slice(0, i + 1).filter((x) => !x.hidden).length - 1)}`}
          </span>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={() => upd(i, { hidden: !f.hidden })} title={f.hidden ? "نمایش در سایت" : "پنهان کردن"} aria-label={f.hidden ? "نمایش در سایت" : "پنهان کردن"} className="grid size-8 place-items-center rounded-lg hover:bg-muted">
              {f.hidden ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4" />}
            </button>
            <button type="button" aria-label="بالا" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="پایین" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid size-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
            <button type="button" aria-label="حذف" onClick={() => remove(i)} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconPicker value={f.icon} onChange={(v) => upd(i, { icon: v })} />
          <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold hover:border-primary/40", uploading === i && "pointer-events-none opacity-60")}>
            {uploading === i ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4 text-primary" />}
            {f.image ? "عوض کردنِ عکس" : "افزودنِ عکس"}
            <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload(i, file); }} />
          </label>
          {f.image && <button type="button" onClick={() => upd(i, { image: undefined })} className="rounded-xl px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10">حذفِ عکس</button>}
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          اندازهٔ پیشنهادیِ عکس: <b className="text-foreground">{i === bigIdx ? CARD_SIZE.wide : CARD_SIZE.card}</b>
          {i === bigIdx ? " — جای تصویرِ QR در کارتِ بزرگ می‌نشیند." : " — کلِ کارت را می‌پوشاند؛ سوژهٔ اصلی را بالا یا وسطِ عکس بگذارید چون پایینش زیرِ متن می‌رود."}
        </p>
        <input value={f.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="عنوانِ کارت" className={smallField} />
        <textarea value={f.text} onChange={(e) => upd(i, { text: e.target.value })} rows={2} placeholder="توضیحِ کارت" className={cn(smallField, "resize-y leading-7")} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Box title="بخشِ امکانات" action={resetBtn}>
        <L t="تیتر"><input value={c.features.title} onChange={(e) => set("features", { title: e.target.value })} className={smallField} /></L>
        <L t="زیرتیتر"><input value={c.features.subtitle} onChange={(e) => set("features", { subtitle: e.target.value })} className={smallField} /></L>
        <L t="سرعتِ چرخشِ خودکارِ کاروسل" hint={secs ? `هر ${secsFa} ثانیه کارتِ بعدی می‌آید (با نگه‌داشتنِ انگشت یا ماوس روی کاروسل متوقف می‌شود).` : "چرخشِ خودکار خاموش است؛ بازدیدکننده خودش جابه‌جا می‌کند."}>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={10} step={0.5} value={secs} onChange={(e) => set("features", { autoplay: Number(e.target.value) })} className="flex-1 accent-[hsl(var(--primary))]" />
            <span className="w-20 shrink-0 text-center text-sm font-bold">{secs ? `${secsFa} ثانیه` : "خاموش"}</span>
          </div>
        </L>
      </Box>

      <Box title={`کارت‌ها (${toFa(shown)} نمایان از ${toFa(items.length)})`} action={
        <Button type="button" size="sm" className="rounded-xl" onClick={() => put([...items, { icon: "Sparkles", title: "", text: "" }])}><Plus className="size-4" /> کارتِ جدید</Button>
      }>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          اولین کارتِ نمایان به‌صورتِ <b className="text-foreground">کارتِ بزرگ</b> بالای بخش می‌آید و بقیه در <b className="text-foreground">کاروسل</b> می‌چرخند.
          ترتیب را با فلش‌ها عوض کنید؛ با آیکونِ چشم، کارتی را بدونِ حذف از سایت پنهان کنید. کارت‌های تعرفه از «تنظیمات ← طرح‌های اشتراک» می‌آیند.
          <br />عکس اختیاری است (jpg، png، webp و…)؛ بدونِ عکس، کارت با آیکون و رنگِ برند نمایش داده می‌شود. عکس‌های بزرگ‌تر خودکار کوچک و فشرده می‌شوند.
        </p>
        {items.length ? items.map(card) : <p className="py-6 text-center text-sm text-muted-foreground">هنوز کارتی نیست.</p>}
      </Box>
    </div>
  );
}
