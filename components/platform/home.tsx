import Link from "next/link";
import { Check, Mail, MapPin, Phone, ShieldCheck, Sparkles, Store } from "lucide-react";
import { money, toFa } from "@/lib/utils";
import { colorHsl, type SiteContent } from "@/lib/site-content";
import type { Plan } from "@/lib/platform";
import { FeatureIcon } from "@/components/platform/feature-icon";

export interface PublicPlatform {
  trialDays: number; allowSignup: boolean; plans: Plan[]; root: string; otp: boolean;
  /** محتوای سایت (متغیرها جایگذاری‌شده) — از پنلِ مدیرِ کل ← «محتوای سایت» */
  c: SiteContent;
}

const isImg = (s: string) => /^(\/|https?:)/.test(s || "");

/** قاب مشترکِ صفحه‌های پلتفرم: رنگِ برند، نوارِ اعلان، منوی بالا و پاورقی */
export function PlatformShell({ p, children }: { p: PublicPlatform; children: React.ReactNode }) {
  const { c } = p;
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--primary" as string]: colorHsl(c.brand.color) }}>
      {c.announce.enabled && c.announce.text && (
        <div className="bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground">
          {c.announce.link ? <Link href={c.announce.link} className="underline-offset-4 hover:underline">{c.announce.text}</Link> : c.announce.text}
        </div>
      )}
      <PlatformNav p={p} />
      {children}
      <PlatformFooter p={p} />
    </div>
  );
}

export function PlatformHome({ p }: { p: PublicPlatform }) {
  const { c } = p;
  return (
    <PlatformShell p={p}>
      {/* ===== هیرو ===== */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            {c.hero.badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <Sparkles className="size-3.5" /> {c.hero.badge}
              </span>
            )}
            <h1 className="mt-4 text-4xl font-black leading-[1.35] sm:text-5xl">
              {c.hero.title}
              {c.hero.highlight && <span className="block text-primary">{c.hero.highlight}</span>}
            </h1>
            <p className="mt-4 max-w-xl whitespace-pre-line text-lg leading-8 text-muted-foreground">{c.hero.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {p.allowSignup && c.hero.ctaPrimary && (
                <Link href="/signup" className="flex h-12 items-center rounded-2xl bg-primary px-7 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110">{c.hero.ctaPrimary}</Link>
              )}
              {c.hero.ctaSecondary && <Link href="/login" className="flex h-12 items-center rounded-2xl border border-border px-6 font-bold transition hover:bg-muted">{c.hero.ctaSecondary}</Link>}
            </div>
            {c.kinds.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {c.kinds.map((k) => <span key={k} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{k}</span>)}
              </div>
            )}
          </div>

          {/* پیش‌نمایشِ گوشی */}
          <div className="mx-auto w-full max-w-[19rem]">
            <div className="rounded-[2.6rem] border-[10px] border-foreground/90 bg-card p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">☕</span>
                <b className="text-sm">{c.hero.mockupName}</b>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">میز ۴</span>
              </div>
              <div className="mb-3 flex gap-1.5 overflow-hidden text-[10px] font-bold">
                {["قهوهٔ گرم", "سرد", "کیک", "صبحانه"].map((x, i) => (
                  <span key={x} className={i === 0 ? "rounded-full bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-full bg-muted px-2.5 py-1"}>{x}</span>
                ))}
              </div>
              {[["☕", "کاپوچینو", 72000], ["🥛", "کافه لاته", 78000], ["🍰", "چیزکیک", 110000]].map(([e, n, pr]) => (
                <div key={String(n)} className="mb-2 flex items-center gap-2.5 rounded-2xl bg-muted/60 p-2">
                  <span className="grid size-11 place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_35%,#f3d9b8,#d39a68_60%,#7b4a2b)] text-xl">{e}</span>
                  <div className="flex-1 text-xs"><b className="block">{n}</b><span className="text-muted-foreground">{money(Number(pr))}</span></div>
                  <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">+</span>
                </div>
              ))}
              <div className="mt-3 rounded-2xl bg-primary py-2.5 text-center text-xs font-bold text-primary-foreground">ثبت سفارش · {money(150000)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== امکانات ===== */}
      {c.features.items.length > 0 && (
        <section id="features" className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-3xl font-black">{c.features.title}</h2>
          {c.features.subtitle && <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">{c.features.subtitle}</p>}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.features.items.map((f, i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><FeatureIcon name={f.icon} /></span>
                <h3 className="mt-3 font-extrabold">{f.title}</h3>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== مراحل ===== */}
      {c.steps.items.length > 0 && (
        <section className="bg-muted/40 py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-black">{c.steps.title}</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {c.steps.items.map((s, i) => (
                <div key={i} className="rounded-3xl bg-card p-6 shadow-sm">
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-lg font-black text-primary-foreground">{toFa(i + 1)}</span>
                  <h3 className="mt-3 text-lg font-extrabold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground" dir="auto">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== قیمت‌ها ===== */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-3xl font-black">{c.pricing.title}</h2>
        {c.pricing.subtitle && <p className="mt-3 text-center text-muted-foreground">{c.pricing.subtitle}</p>}
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {p.plans.map((pl) => (
            <div key={pl.id} className={`relative rounded-3xl border-2 bg-card p-6 shadow-sm ${pl.popular ? "border-primary shadow-xl shadow-primary/10" : "border-border"}`}>
              {pl.popular && <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">محبوب‌ترین</span>}
              <h3 className="text-lg font-extrabold">{pl.title}</h3>
              <div className="mt-3 text-3xl font-black">{money(pl.price)}</div>
              {pl.months > 1 && <div className="mt-1 text-sm text-muted-foreground">معادلِ ماهی {money(Math.round(pl.price / pl.months))}</div>}
              <ul className="mt-5 space-y-2 text-sm">
                {c.pricing.bullets.map((x) => <li key={x} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {x}</li>)}
              </ul>
              {p.allowSignup && c.pricing.cta && (
                <Link href="/signup" className={`mt-6 flex h-11 items-center justify-center rounded-2xl font-bold transition ${pl.popular ? "bg-primary text-primary-foreground hover:brightness-110" : "border border-border hover:bg-muted"}`}>{c.pricing.cta}</Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== سؤالات ===== */}
      {c.faq.items.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <h2 className="mb-6 text-center text-3xl font-black">{c.faq.title}</h2>
          {c.faq.items.map((f, i) => (
            <details key={i} className="group mb-3 rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-bold">{f.q}</summary>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </section>
      )}
    </PlatformShell>
  );
}

export function BrandMark({ c }: { c: SiteContent }) {
  return (
    <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-primary text-lg text-primary-foreground">
      {isImg(c.brand.logo) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.brand.logo} alt="" className="size-full object-cover" />
      ) : c.brand.logo || <Store className="size-5" />}
    </span>
  );
}

export function PlatformNav({ p }: { p: PublicPlatform }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-black"><BrandMark c={p.c} />{p.c.brand.name}</Link>
        <nav className="ms-auto flex items-center gap-1 text-sm font-semibold">
          <a href="/#pricing" className="hidden rounded-xl px-3 py-2 text-muted-foreground transition hover:text-foreground sm:block">تعرفه‌ها</a>
          <Link href="/login" className="rounded-xl px-3 py-2 text-muted-foreground transition hover:text-foreground">ورود</Link>
          {p.allowSignup && <Link href="/signup" className="rounded-xl bg-primary px-4 py-2 text-primary-foreground">ثبت‌نام</Link>}
        </nav>
      </div>
    </header>
  );
}

export function PlatformFooter({ p }: { p: PublicPlatform }) {
  const f = p.c.footer;
  const social = [
    f.instagram && { label: "اینستاگرام", href: /^https?:/.test(f.instagram) ? f.instagram : `https://instagram.com/${f.instagram.replace(/^@/, "")}` },
    f.telegram && { label: "تلگرام", href: /^https?:/.test(f.telegram) ? f.telegram : `https://t.me/${f.telegram.replace(/^@/, "")}` },
    f.whatsapp && { label: "واتساپ", href: /^https?:/.test(f.whatsapp) ? f.whatsapp : `https://wa.me/${f.whatsapp.replace(/\D/g, "").replace(/^0/, "98")}` },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 px-4">
        <div className="flex items-center gap-1.5"><ShieldCheck className="size-4" /> {f.text || p.c.brand.name}</div>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {f.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" /> <span dir="ltr">{toFa(f.phone)}</span></span>}
          {f.email && <a href={`mailto:${f.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="size-3.5" /> <span dir="ltr">{f.email}</span></a>}
          {f.address && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {f.address}</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {social.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noopener" className="font-semibold hover:text-foreground">{s.label}</a>)}
          <Link href="/terms" className="hover:text-foreground">قوانین</Link>
          <Link href="/privacy" className="hover:text-foreground">حریمِ خصوصی</Link>
        </div>
      </div>
    </footer>
  );
}

/** متنِ ساده با «## » برای تیتر و خطِ خالی برای پاراگراف (صفحه‌های قوانین) */
export function RichText({ text }: { text: string }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-8">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        return (
          <div key={i}>
            {lines.map((l, j) => l.startsWith("## ")
              ? <h2 key={j} className="mb-1 mt-2 text-xl font-black">{l.slice(3)}</h2>
              : l.startsWith("- ") ? <p key={j} className="flex gap-2 text-muted-foreground"><span>•</span>{l.slice(2)}</p>
              : <p key={j} className="text-muted-foreground">{l}</p>)}
          </div>
        );
      })}
    </div>
  );
}
