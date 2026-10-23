"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, Save, Store, Trash2 } from "lucide-react";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { Button } from "@/components/ui/button";
import { cn, num } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { adminContentAction, adminCreateDemoAction, adminSaveContentAction, adminUploadCardImageAction, adminUploadLogoAction, adminUploadOgAction } from "@/app/platform/actions";
import { BRAND_COLORS, DEFAULT_CONTENT, FEATURE_ICONS, ICON_LABELS, type FeatureItem, type SiteContent, type Testimonial } from "@/lib/site-content";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const SECTIONS = [
  ["brand", "Brand & SEO"], ["announce", "Announcement bar"], ["hero", "Hero"], ["features", "Feature cards (carousel)"], ["views", "Display modes"], ["steps", "Steps"],
  ["pricing", "Pricing"], ["faq", "FAQ"], ["showcase", "Showcase & final CTA"], ["testimonials", "Testimonials"], ["footer", "Footer & contact"], ["forms", "Signup & login"], ["legal", "Legal"], ["system", "System messages"],
] as const;
type Sec = (typeof SECTIONS)[number][0];


/** List with add / remove / reorder */
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
            <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-lg hover:bg-muted"><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-lg hover:bg-muted"><ArrowDown className="size-4" /></button>
            <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => onChange([...items, make()])}><Plus className="size-4" /> {addLabel}</Button>
    </div>
  );
}

export function ContentEditor({ flash, siteUrl, trialDays }: { flash: Flash; siteUrl: string; trialDays?: number }) {
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
  const reset = (k: keyof SiteContent) => { if (confirm("Reset this section's texts to the defaults?")) setC({ ...c, [k]: structuredClone(DEFAULT_CONTENT[k]) }); };

  async function save() {
    setBusy(true);
    try { const v = unwrap(await adminSaveContentAction(c!)); setC(v); setSaved(JSON.stringify(v)); flash("✅ Site content saved"); }
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
  /** Text with variables filled in, as Google will show it */
  const fillPreview = (t: string) => t.replaceAll("{brand}", c.brand.name).replaceAll("{trialDays}", String(trialDays ?? 14)).replaceAll("{root}", siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  const resetBtn = (k: keyof SiteContent) => <button type="button" onClick={() => reset(k)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /> Reset</button>;
  const inp = (v: string, on: (s: string) => void, ph = "") => <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} className={smallField} />;
  const area = (v: string, on: (s: string) => void, rows = 3) => <textarea value={v} onChange={(e) => on(e.target.value)} rows={rows} className={cn(smallField, "resize-y leading-7")} />;

  return (
    <div className="space-y-4">
      {/* Save bar */}
      <div className="sticky top-[60px] z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <Button className="rounded-xl" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <><Save className="size-4" /> Save</>}</Button>
        {dirty && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Unsaved changes</span>}
        <a href={siteUrl} target="_blank" rel="noopener" className="ms-auto flex items-center gap-1 text-sm font-semibold text-primary"><ExternalLink className="size-4" /> View site</a>
      </div>
      <p className="text-xs text-muted-foreground">In any text you can use <code>{"{brand}"}</code> (brand name), <code>{"{trialDays}"}</code> (free trial days) and <code>{"{root}"}</code> (domain).</p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => setSec(id)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", sec === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {sec === "brand" && (
        <Box title="Brand & SEO" action={resetBtn("brand")}>
          <L t="Brand name">{inp(c.brand.name, (v) => set("brand", { name: v }))}</L>
          <L t="Logo" hint="A square image or an emoji; empty = store icon">
            <div className="flex items-center gap-2">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-xl text-primary-foreground" style={{ background: BRAND_COLORS.find((x) => x.id === c.brand.color)?.hex }}>
                {/^(\/|https?:)/.test(c.brand.logo)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.brand.logo} alt="" className="size-full object-cover" /> : c.brand.logo || <Store className="size-6" />}
              </span>
              <input value={/^(\/|https?:)/.test(c.brand.logo) ? "" : c.brand.logo} onChange={(e) => set("brand", { logo: e.target.value })} placeholder="Emoji, e.g. ☕" className={cn(smallField, "max-w-32")} />
              <input ref={logoRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={logoBusy} onClick={() => logoRef.current?.click()}>{logoBusy ? <Loader2 className="animate-spin" /> : <><ImagePlus className="size-4" /> Upload image</>}</Button>
              {c.brand.logo && <button type="button" onClick={() => set("brand", { logo: "" })} className="text-xs text-muted-foreground hover:text-primary">Remove</button>}
            </div>
          </L>
          <L t="Primary site color">
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((col) => (
                <button key={col.id} type="button" title={col.label} onClick={() => set("brand", { color: col.id })}
                  className={cn("size-9 rounded-full ring-offset-2 ring-offset-card transition", c.brand.color === col.id && "ring-2 ring-foreground")} style={{ background: col.hex }} />
              ))}
            </div>
          </L>
          <L t="Link preview image (WhatsApp, social media, Google)" hint="1200 × 630 px; empty = auto-generated image with your logo and brand color">
            <div className="flex flex-wrap items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.brand.ogImage || "/og.png"} alt="" className="h-16 w-[122px] rounded-lg border border-border object-cover" />
              <input ref={ogRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadOg(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={logoBusy} onClick={() => ogRef.current?.click()}><ImagePlus className="size-4" /> Upload</Button>
              {c.brand.ogImage && <button type="button" onClick={() => set("brand", { ogImage: "" })} className="text-xs text-muted-foreground hover:text-primary">Remove (use auto image)</button>}
            </div>
          </L>
          <L t="Google verification code (Search Console)" hint='In Search Console → "HTML tag", copy only the content value (pasting the whole tag also works)'>{inp(c.brand.googleVerification, (v) => set("brand", { googleVerification: v.replace(/.*content="([^"]+)".*/, "$1").trim() }), "abc123…")}</L>
          <L t="Page title (Google results and browser tab)" hint={<Count n={fillPreview(c.brand.seoTitle).length} max={60} tip="Put your main keyword (e.g. “QR menu”) at the start of the title" />}>{inp(c.brand.seoTitle, (v) => set("brand", { seoTitle: v }))}</L>
          <L t="Meta description (Google results)" hint={<Count n={fillPreview(c.brand.seoDescription).length} max={160} min={110} tip="One complete sentence saying what you offer and why people should click" />}>{area(c.brand.seoDescription, (v) => set("brand", { seoDescription: v }), 2)}</L>
          <GooglePreview url={siteUrl} title={fillPreview(c.brand.seoTitle)} description={fillPreview(c.brand.seoDescription)} />
          <Toggle checked={c.brand.poweredBy !== false} onChange={(v) => set("brand", { poweredBy: v })}
            label={<span>“Digital menu by {c.brand.name || "…"}” link at the bottom of venue menus <span className="text-xs text-muted-foreground">(a backlink to your site — keep it on for SEO)</span></span>} />
        </Box>
      )}

      {sec === "announce" && (
        <Box title="Announcement bar (top of the site)" action={resetBtn("announce")}>
          <Toggle checked={c.announce.enabled} onChange={(v) => set("announce", { enabled: v })} label="Show the announcement bar" />
          <L t="Text">{inp(c.announce.text, (v) => set("announce", { text: v }), "e.g. Spring sale — 30% off all plans")}</L>
          <L t="Link (optional)" hint="e.g. /signup or a full URL">{inp(c.announce.link, (v) => set("announce", { link: v }), "/signup")}</L>
        </Box>
      )}

      {sec === "hero" && (
        <Box title="Hero (top of the home page)" action={resetBtn("hero")}>
          <L t="Small badge above the headline">{inp(c.hero.badge, (v) => set("hero", { badge: v }))}</L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Headline">{inp(c.hero.title, (v) => set("hero", { title: v }))}</L>
            <L t="Headline continued (highlighted)">{inp(c.hero.highlight, (v) => set("hero", { highlight: v }))}</L>
          </div>
          <L t="Description">{area(c.hero.subtitle, (v) => set("hero", { subtitle: v }), 3)}</L>
          <div className="grid gap-3 sm:grid-cols-3">
            <L t="Primary button">{inp(c.hero.ctaPrimary, (v) => set("hero", { ctaPrimary: v }))}</L>
            <L t="Secondary button">{inp(c.hero.ctaSecondary, (v) => set("hero", { ctaSecondary: v }))}</L>
            <L t="Sample venue name in the phone mockup">{inp(c.hero.mockupName, (v) => set("hero", { mockupName: v }))}</L>
          </div>
          <DemoField c={c} set={set} flash={flash} />
          <L t="Short highlights under the buttons (with check marks)">
            <ListEditor items={c.trust} onChange={(v) => setC({ ...c, trust: v })} make={() => ""} addLabel="Add item" render={(it, s) => inp(it, s)} />
          </L>
          <L t="“Perfect for” tags">
            <ListEditor items={c.kinds} onChange={(v) => setC({ ...c, kinds: v })} make={() => ""} addLabel="Add tag"
              render={(it, s) => inp(it, s, "e.g. 🍕 Pizzerias")} />
          </L>
        </Box>
      )}

      {sec === "features" && <FeaturesEditor c={c} set={set} resetBtn={resetBtn("features")} flash={flash} />}

      {sec === "views" && (
        <Box title="Menu display modes" action={resetBtn("views")}>
          <L t="Title">{inp(c.views.title, (v) => set("views", { title: v }))}</L>
          <L t="Subtitle">{area(c.views.subtitle, (v) => set("views", { subtitle: v }), 2)}</L>
          {(["3D carousel", "Grid", "List"] as const).map((name, i) => {
            const it = c.views.items[i] || DEFAULT_CONTENT.views.items[i];
            const put = (patch: Partial<typeof it>) => set("views", { items: DEFAULT_CONTENT.views.items.map((d, j) => (j === i ? { ...it, ...patch } : c.views.items[j] || d)) });
            return (
              <L key={name} t={`${name} mode`}>
                <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
                  {inp(it.title, (v) => put({ title: v }), "Title")}
                  {area(it.text, (v) => put({ text: v }), 2)}
                </div>
              </L>
            );
          })}
          <L t="Highlights next to the preview (with check marks)">
            <ListEditor items={c.views.bullets} onChange={(v) => set("views", { bullets: v })} make={() => ""} addLabel="Add item" render={(it, s) => inp(it, s)} />
          </L>
        </Box>
      )}

      {sec === "steps" && (
        <Box title="Setup steps" action={resetBtn("steps")}>
          <L t="Title">{inp(c.steps.title, (v) => set("steps", { title: v }))}</L>
          <ListEditor items={c.steps.items} onChange={(v) => set("steps", { items: v })} make={() => ({ title: "", text: "" })} addLabel="Add step"
            render={(it, s) => (<>{inp(it.title, (v) => s({ ...it, title: v }), "Title")}{area(it.text, (v) => s({ ...it, text: v }), 2)}</>)} />
        </Box>
      )}

      {sec === "pricing" && (
        <Box title="Pricing section" action={resetBtn("pricing")}>
          <p className="text-xs text-muted-foreground">Plan prices and durations are set under Settings → Subscription plans.</p>
          <L t="Title">{inp(c.pricing.title, (v) => set("pricing", { title: v }))}</L>
          <L t="Subtitle">{inp(c.pricing.subtitle, (v) => set("pricing", { subtitle: v }))}</L>
          <L t="Button text">{inp(c.pricing.cta, (v) => set("pricing", { cta: v }))}</L>
          <L t="Included in every plan (with check marks)">
            <ListEditor items={c.pricing.bullets} onChange={(v) => set("pricing", { bullets: v })} make={() => ""} addLabel="Add item" render={(it, s) => inp(it, s)} />
          </L>
        </Box>
      )}

      {sec === "faq" && (
        <Box title="Frequently asked questions" action={resetBtn("faq")}>
          <L t="Title">{inp(c.faq.title, (v) => set("faq", { title: v }))}</L>
          <ListEditor items={c.faq.items} onChange={(v) => set("faq", { items: v })} make={() => ({ q: "", a: "" })} addLabel="Add question"
            render={(it, s) => (<>{inp(it.q, (v) => s({ ...it, q: v }), "Question")}{area(it.a, (v) => s({ ...it, a: v }), 3)}</>)} />
        </Box>
      )}

      {sec === "showcase" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="Dashboard showcase" action={resetBtn("showcase")}>
            <L t="Title">{inp(c.showcase.title, (v) => set("showcase", { title: v }))}</L>
            <L t="Description">{area(c.showcase.text, (v) => set("showcase", { text: v }), 3)}</L>
            <L t="Highlights (with check marks)">
              <ListEditor items={c.showcase.bullets} onChange={(v) => set("showcase", { bullets: v })} make={() => ""} addLabel="Add item" render={(it, s) => inp(it, s)} />
            </L>
          </Box>
          <Box title="Final call to action (bottom of the page)" action={resetBtn("finalCta")}>
            <L t="Title">{inp(c.finalCta.title, (v) => set("finalCta", { title: v }))}</L>
            <L t="Description">{area(c.finalCta.text, (v) => set("finalCta", { text: v }), 2)}</L>
            <L t="Button text">{inp(c.finalCta.button, (v) => set("finalCta", { button: v }))}</L>
          </Box>
        </div>
      )}

      {sec === "footer" && (
        <Box title="Footer & contact details" action={resetBtn("footer")}>
          <L t="Footer text">{inp(c.footer.text, (v) => set("footer", { text: v }))}</L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Support phone">{inp(c.footer.phone, (v) => set("footer", { phone: v }), "+1 555 123 4567")}</L>
            <L t="Email">{inp(c.footer.email, (v) => set("footer", { email: v }), "hello@…")}</L>
            <L t="Instagram">{inp(c.footer.instagram, (v) => set("footer", { instagram: v }), "@page")}</L>
            <L t="Telegram">{inp(c.footer.telegram, (v) => set("footer", { telegram: v }), "@channel")}</L>
            <L t="WhatsApp (number)">{inp(c.footer.whatsapp, (v) => set("footer", { whatsapp: v }), "+1 555 123 4567")}</L>
            <L t="Address">{inp(c.footer.address, (v) => set("footer", { address: v }))}</L>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-background p-3">
            <Toggle checked={c.footer.floatButton !== false} onChange={(v) => set("footer", { floatButton: v })} label="Floating WhatsApp / call button in the corner" />
            <p className="text-[11px] leading-5 text-muted-foreground">Uses the WhatsApp number and phone above; hidden if both are empty.</p>
            <L t="Prefilled WhatsApp message">{inp(c.footer.floatText, (v) => set("footer", { floatText: v }))}</L>
          </div>
        </Box>
      )}

      {sec === "testimonials" && <TestimonialsEditor c={c} setC={setC} resetBtn={resetBtn("testimonials")} flash={flash} />}

      {sec === "forms" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Box title="Signup page" action={resetBtn("signup")}>
            <L t="Title">{inp(c.signup.title, (v) => set("signup", { title: v }))}</L>
            <L t="Description">{inp(c.signup.subtitle, (v) => set("signup", { subtitle: v }))}</L>
            <L t="Button text">{inp(c.signup.button, (v) => set("signup", { button: v }))}</L>
            <Toggle checked={c.signup.requireTerms} onChange={(v) => set("signup", { requireTerms: v })} label="Require the “I accept the terms” checkbox" />
          </Box>
          <Box title="Dashboard login page" action={resetBtn("login")}>
            <L t="Title">{inp(c.login.title, (v) => set("login", { title: v }))}</L>
            <L t="Description">{inp(c.login.subtitle, (v) => set("login", { subtitle: v }))}</L>
            <L t="Help text at the bottom (the support phone is added automatically)">{inp(c.login.help, (v) => set("login", { help: v }))}</L>
          </Box>
        </div>
      )}

      {sec === "legal" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(["terms", "privacy"] as const).map((k) => (
            <Box key={k} title={k === "terms" ? "Terms of service (/terms)" : "Privacy policy (/privacy)"} action={<a href={`${siteUrl}${k}`} target="_blank" rel="noopener" className="text-xs font-semibold text-primary">View</a>}>
              <p className="text-[11px] text-muted-foreground">Lines starting with <code>## </code> are headings, <code>- </code> makes a list item; a blank line starts a new paragraph.</p>
              <textarea value={c.legal[k]} onChange={(e) => set("legal", { [k]: e.target.value })} rows={16} className={cn(smallField, "resize-y font-mono text-[13px] leading-7")} />
            </Box>
          ))}
        </div>
      )}

      {sec === "system" && (
        <Box title="Messages shown to venue customers" action={resetBtn("unavailable")}>
          <L t="Unknown address — title">{inp(c.unavailable.missingTitle, (v) => set("unavailable", { missingTitle: v }))}</L>
          <L t="Unknown address — text">{area(c.unavailable.missingText, (v) => set("unavailable", { missingText: v }), 2)}</L>
          <L t="Expired subscription — title" hint="{name} = venue name">{inp(c.unavailable.inactiveTitle, (v) => set("unavailable", { inactiveTitle: v }))}</L>
          <L t="Expired subscription — text">{area(c.unavailable.inactiveText, (v) => set("unavailable", { inactiveText: v }), 2)}</L>
        </Box>
      )}
    </div>
  );
}

/* ============================ Feature cards ============================ */

/** Small card preview that looks like the site's carousel cards */
function CardPreview({ f, i, wide }: { f: FeatureItem; i: number; wide: boolean }) {
  if (wide) {
    // Large card: the image replaces the QR illustration (16:10)
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
          <b className="line-clamp-2 text-[11px] leading-5">{f.title || "Untitled"}</b>
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
        <b className="mt-2.5 line-clamp-2 text-[11px] leading-5">{f.title || "Untitled"}</b>
        <span className="mt-1 line-clamp-3 text-[9px] leading-4 text-white/70">{f.text}</span>
      </div>
    </div>
  );
}

/** Icon picker with readable names */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><FeatureIcon name={value} className="size-4" /></span>
        {ICON_LABELS[value] || value} <span className="text-muted-foreground">· Change icon</span>
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

/** Recommended image size (px) — matches the card frames on the site */
const CARD_SIZE = { wide: "1600 × 1000 px · 16:10 (landscape)", card: "1080 × 1200 px · 9:10 (almost square)" };

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
  const remove = (i: number) => { if (confirm(`Delete the card “${items[i].title || "Untitled"}”?`)) put(items.filter((_, j) => j !== i)); };
  // The first visible card is the large card on top; the other visible cards rotate in the carousel
  const bigIdx = items.findIndex((f) => !f.hidden);
  const shown = items.filter((f) => !f.hidden).length;
  const secs = c.features.autoplay ?? 3.5;
  const secsLabel = num(secs);

  const card = (f: FeatureItem, i: number) => (
    <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:flex-row">
      <CardPreview f={f} i={i} wide={i === bigIdx} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", f.hidden ? "bg-muted text-muted-foreground" : i === bigIdx ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
            {f.hidden ? "Hidden" : i === bigIdx ? "Large top card" : `Carousel · card ${num(items.slice(0, i + 1).filter((x) => !x.hidden).length - 1)}`}
          </span>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={() => upd(i, { hidden: !f.hidden })} title={f.hidden ? "Show on site" : "Hide"} aria-label={f.hidden ? "Show on site" : "Hide"} className="grid size-8 place-items-center rounded-lg hover:bg-muted">
              {f.hidden ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4" />}
            </button>
            <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid size-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
            <button type="button" aria-label="Delete" onClick={() => remove(i)} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconPicker value={f.icon} onChange={(v) => upd(i, { icon: v })} />
          <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold hover:border-primary/40", uploading === i && "pointer-events-none opacity-60")}>
            {uploading === i ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4 text-primary" />}
            {f.image ? "Change image" : "Add image"}
            <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload(i, file); }} />
          </label>
          {f.image && <button type="button" onClick={() => upd(i, { image: undefined })} className="rounded-xl px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Remove image</button>}
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          Recommended image size: <b className="text-foreground">{i === bigIdx ? CARD_SIZE.wide : CARD_SIZE.card}</b>
          {i === bigIdx ? " — replaces the QR illustration in the large card." : " — covers the whole card; keep the subject near the top or center, as the bottom sits under the text."}
        </p>
        <input value={f.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Card title" className={smallField} />
        <textarea value={f.text} onChange={(e) => upd(i, { text: e.target.value })} rows={2} placeholder="Card text" className={cn(smallField, "resize-y leading-7")} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Box title="Features section" action={resetBtn}>
        <L t="Title"><input value={c.features.title} onChange={(e) => set("features", { title: e.target.value })} className={smallField} /></L>
        <L t="Subtitle"><input value={c.features.subtitle} onChange={(e) => set("features", { subtitle: e.target.value })} className={smallField} /></L>
        <L t="Carousel autoplay speed" hint={secs ? `The next card appears every ${secsLabel} seconds (pauses while a finger or mouse is on the carousel).` : "Autoplay is off; visitors swipe through the cards themselves."}>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={10} step={0.5} value={secs} onChange={(e) => set("features", { autoplay: Number(e.target.value) })} className="flex-1 accent-[hsl(var(--primary))]" />
            <span className="w-20 shrink-0 text-center text-sm font-bold">{secs ? `${secsLabel} sec` : "Off"}</span>
          </div>
        </L>
      </Box>

      <Box title={`Cards (${num(shown)} of ${num(items.length)} visible)`} action={
        <Button type="button" size="sm" className="rounded-xl" onClick={() => put([...items, { icon: "Sparkles", title: "", text: "" }])}><Plus className="size-4" /> New card</Button>
      }>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          The first visible card is shown as the <b className="text-foreground">large card</b> at the top of the section; the rest rotate in the <b className="text-foreground">carousel</b>.
          Reorder with the arrows; use the eye icon to hide a card without deleting it. Pricing cards come from Settings → Subscription plans.
          <br />Images are optional (jpg, png, webp…); without one, the card shows its icon in your brand color. Large images are resized and compressed automatically.
        </p>
        {items.length ? items.map(card) : <p className="py-6 text-center text-sm text-muted-foreground">No cards yet.</p>}
      </Box>
    </div>
  );
}

/* ============================ Google result preview ============================ */
function Count({ n, max, min = 0, tip }: { n: number; max: number; min?: number; tip: string }) {
  const bad = n > max, short = min > 0 && n < min;
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className={cn("font-bold", bad ? "text-primary" : short ? "text-amber-600" : "text-green-600")}>{num(n)} / {num(max)}</span>
      <span>{bad ? "Too long — Google will cut off the end." : short ? "A bit short." : tip}</span>
    </span>
  );
}

/** Approximation of how the page appears in Google results */
function GooglePreview({ url, title, description }: { url: string; title: string; description: string }) {
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
  return (
    <div className="rounded-2xl border border-border bg-white p-4 text-start dark:bg-[#202124]" aria-label="Google preview">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Google search preview</div>
      <div className="text-xs text-[#4d5156] dark:text-[#bdc1c6]">{host}</div>
      <div className="mt-0.5 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{cut(title || "Untitled", 62)}</div>
      <div className="mt-1 text-sm leading-6 text-[#4d5156] dark:text-[#bdc1c6]">{cut(description || "—", 160)}</div>
    </div>
  );
}

/* ============================ Live demo menu ============================ */
function DemoField({ c, set, flash }: { c: SiteContent; set: (k: "hero", v: Partial<SiteContent["hero"]>) => void; flash: Flash }) {
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const r = unwrap(await adminCreateDemoAction("cafe"));
      set("hero", { demoSlug: r.slug });
      flash("✅ The demo menu is ready — press Save to show its button on the site");
    } catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-3">
      <div className="text-sm font-extrabold">Live demo menu</div>
      <p className="text-xs leading-6 text-muted-foreground">
        With one click (or by scanning a QR code on their screen) visitors open a real menu on their phone and can even place a test order. A never-expiring “demo” venue with a sample menu is created; edit its menu and photos like any other venue via Venues → demo → Open dashboard.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <L t="Demo menu address (subdomain)"><input value={c.hero.demoSlug} onChange={(e) => set("hero", { demoSlug: e.target.value.trim().toLowerCase() })} placeholder="demo" className={smallField} /></L>
        <L t="Button text"><input value={c.hero.demoLabel} onChange={(e) => set("hero", { demoLabel: e.target.value })} className={smallField} /></L>
        {!c.hero.demoSlug && <Button type="button" size="sm" className="h-10 rounded-xl" disabled={busy} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />} Create demo menu</Button>}
      </div>
      <p className="text-[11px] text-muted-foreground">Empty = no demo button. You can also use the address of a customer’s menu (with their permission).</p>
    </div>
  );
}

/* ============================ Testimonials ============================ */
function TestimonialsEditor({ c, setC, resetBtn, flash }: { c: SiteContent; setC: (c: SiteContent) => void; resetBtn: React.ReactNode; flash: Flash }) {
  const [up, setUp] = useState(-1);
  const tm = c.testimonials;
  const put = (patch: Partial<SiteContent["testimonials"]>) => setC({ ...c, testimonials: { ...tm, ...patch } });
  const blank: Testimonial = { name: "", person: "", role: "", city: "", text: "", logo: "" };
  async function upload(i: number, f: File, set: (v: Testimonial) => void, it: Testimonial) {
    setUp(i);
    try { const { url } = unwrap(await adminUploadCardImageAction(imageForm(await compressImage(f, 400, 0.9)))); set({ ...it, logo: url }); }
    catch (e) { flash("❌ " + err(e)); } finally { setUp(-1); }
  }
  return (
    <Box title="Testimonials" action={resetBtn}>
      <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
        Only add real testimonials, with the customer’s permission (fake reviews destroy visitor trust). This section stays hidden on the site until you add at least one.
        Venue logos are also shown as a row above the testimonials.
      </p>
      <L t="Title"><input value={tm.title} onChange={(e) => put({ title: e.target.value })} className={smallField} /></L>
      <L t="Subtitle (optional)"><input value={tm.subtitle} onChange={(e) => put({ subtitle: e.target.value })} className={smallField} /></L>
      <ListEditor items={tm.items} onChange={(v) => put({ items: v })} make={() => ({ ...blank })} addLabel="Add testimonial"
        render={(it, set, i) => (
          <>
            <div className="flex items-center gap-3">
              {it.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.logo} alt="" className="size-12 rounded-xl border border-border object-cover" />
                : <span className="grid size-12 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">Logo</span>}
              <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40", up === i && "pointer-events-none opacity-60")}>
                {up === i ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4 text-primary" />} {it.logo ? "Change logo" : "Venue logo"}
                <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(i, f, set, it); }} />
              </label>
              {it.logo && <button type="button" onClick={() => set({ ...it, logo: "" })} className="text-xs text-muted-foreground hover:text-primary">Remove</button>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={it.name} onChange={(e) => set({ ...it, name: e.target.value })} placeholder="Venue name (e.g. Blue Door Café)" className={smallField} />
              <input value={it.city} onChange={(e) => set({ ...it, city: e.target.value })} placeholder="City (optional)" className={smallField} />
              <input value={it.person} onChange={(e) => set({ ...it, person: e.target.value })} placeholder="Person’s name (optional)" className={smallField} />
              <input value={it.role} onChange={(e) => set({ ...it, role: e.target.value })} placeholder="Role (e.g. Owner)" className={smallField} />
            </div>
            <textarea value={it.text} onChange={(e) => set({ ...it, text: e.target.value })} rows={3} placeholder="Testimonial text" className={cn(smallField, "resize-y leading-7")} />
          </>
        )} />
    </Box>
  );
}
