import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Clock, Newspaper } from "lucide-react";
import { fmtDate, num } from "@/lib/utils";
import { fill } from "@/lib/site-content";
import { readMinutes, type Article } from "@/lib/articles";
import { SOLUTIONS, type Solution } from "@/lib/solutions";
import type { City } from "@/lib/cities";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { Prose } from "@/components/platform/prose";
import { DemoTry, PlatformShell, SectionHead, btnPrimary, container, type PublicPlatform } from "@/components/platform/home";
import type { DemoInfo } from "@/app/platform/demo";

/** Text variables ({brand}, {trialDays}) for solution pages and articles */
export const pageVars = (p: PublicPlatform) => ({ brand: p.c.brand.name, trialDays: num(p.trialDays), root: p.root });

/** Breadcrumb trail — the same items are also given to search engines via JSON-LD */
export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="size-3.5 opacity-60" />}
            {it.href ? <Link href={it.href} className="hover:text-foreground">{it.name}</Link> : <span aria-current="page" className="font-semibold text-foreground">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Cta({ p }: { p: PublicPlatform }) {
  if (!p.allowSignup) return null;
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-primary px-5 py-10 text-center text-primary-foreground sm:px-12 sm:py-12">
      <div aria-hidden className="pf-grid absolute inset-0 opacity-60" />
      <div className="relative">
        <h2 className="mx-auto max-w-2xl text-[1.4rem] font-black leading-snug sm:text-3xl">{p.c.finalCta.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-primary-foreground/85 sm:text-base">{p.c.finalCta.text}</p>
        <Link href="/signup" className="mt-6 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-7 font-bold text-slate-900 shadow-xl transition-opacity duration-200 hover:opacity-90 sm:h-12">
          {p.c.finalCta.button}<ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function ArticleCard({ a, vars }: { a: Article; vars: Record<string, string | number> }) {
  return (
    <Link href={`/blog/${a.slug}`} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      {a.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.cover} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div aria-hidden className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"><Newspaper className="size-10 text-primary/60" /></div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-extrabold leading-7 group-hover:text-primary sm:text-lg">{fill(a.title, vars)}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">{fill(a.description, vars)}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDate(a.date)}</span>
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{num(readMinutes(a.body))} min</span>
        </div>
      </div>
    </Link>
  );
}

/* ============================ Solution page ============================ */
export function SolutionView({ p, s, articles, demo = null }: { p: PublicPlatform; s: Solution; articles: Article[]; demo?: DemoInfo | null }) {
  const v = pageVars(p);
  const f = (t: string) => fill(t, v);
  const others = SOLUTIONS.filter((x) => x.slug !== s.slug);
  return (
    <PlatformShell p={p}>
      <section className="relative -mt-[4.5rem] overflow-hidden bg-slate-950 pb-14 pt-28 text-white sm:pb-20 sm:pt-36 lg:-mt-[5.25rem]">
        <div aria-hidden className="pf-grid absolute inset-0" />
        <div aria-hidden className="absolute -top-40 left-1/2 size-[40rem] -translate-x-1/3 rounded-full bg-primary/30 blur-[120px]" />
        <div className={`relative ${container}`}>
          <div className="[&_a:hover]:text-white [&_nav]:text-white/60 [&_span[aria-current]]:text-white"><Crumbs items={[{ name: p.c.brand.name, href: "/" }, { name: s.label }]} /></div>
          <h1 className="mt-6 max-w-3xl text-[1.75rem] font-black leading-[1.4] tracking-tight sm:text-5xl sm:leading-[1.3]">
            {s.h1}
            <span className="mt-1 block bg-gradient-to-r from-primary via-primary to-white/90 bg-clip-text text-[0.6em] text-transparent sm:text-[0.55em]">{f(s.highlight)}</span>
          </h1>
          <div className="mt-6 max-w-3xl space-y-3 text-[0.95rem] leading-8 text-white/75 sm:text-lg sm:leading-9">
            {s.intro.map((t, i) => <p key={i}>{f(t)}</p>)}
          </div>
          {p.allowSignup && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={btnPrimary}>{p.c.hero.ctaPrimary || "Start free"}<ArrowRight className="size-4" /></Link>
              <a href="/#pricing" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 font-bold text-white backdrop-blur transition-colors hover:bg-white/10 sm:h-12">Pricing</a>
            </div>
          )}
        </div>
      </section>

      <section className={`py-14 sm:py-20 ${container}`}>
        <SectionHead eyebrow="Features" title={s.benefitsTitle} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.benefits.map((b) => (
            <article key={b.title} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><FeatureIcon name={b.icon} /></span>
              <h3 className="mt-4 text-base font-extrabold sm:text-lg">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{f(b.text)}</p>
            </article>
          ))}
        </div>
        {demo && <DemoTry demo={demo} />}
      </section>

      <section className="border-y border-border bg-muted/40 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6"><Prose text={f(s.body)} /></div>
      </section>

      <section className={`py-14 sm:py-20 ${container}`}>
        <SectionHead eyebrow="FAQ" title={`Frequently asked questions about ${s.label}`} />
        <div className="mx-auto mt-10 grid max-w-3xl gap-3">
          {s.faq.map((q, i) => (
            <details key={i} className="group rounded-2xl border border-border bg-card p-4 open:shadow-lg open:shadow-black/5 sm:p-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold sm:text-base [&::-webkit-details-marker]:hidden">
                <h3>{f(q.q)}</h3><ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[0.8125rem] leading-6 text-muted-foreground sm:text-sm sm:leading-7">{f(q.a)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`pb-14 sm:pb-20 ${container}`}>
        <h2 className="text-lg font-black sm:text-xl">More solutions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/${o.slug}`} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"><Check className="size-4 text-primary" />{o.label}</Link>
          ))}
        </div>
        {articles.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-black sm:text-xl">Related articles</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} vars={v} />)}</div>
          </>
        )}
        <div className="mt-12"><Cta p={p} /></div>
      </section>
    </PlatformShell>
  );
}

/* ============================ Blog ============================ */
export function BlogIndex({ p, articles }: { p: PublicPlatform; articles: Article[] }) {
  const v = pageVars(p);
  return (
    <PlatformShell p={p}>
      <main className={`py-10 sm:py-14 ${container}`}>
        <Crumbs items={[{ name: p.c.brand.name, href: "/" }, { name: "Blog" }]} />
        <h1 className="mt-5 text-[1.6rem] font-black leading-snug sm:text-4xl">Digital Menu Guides & Articles</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
          Practical guides for cafés, restaurants and fast food: building a QR menu, ordering at the table, menu design and selling more.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => <ArticleCard key={a.slug} a={a} vars={v} />)}
        </div>
        {!articles.length && <p className="py-16 text-center text-muted-foreground">Coming soon…</p>}
        <div className="mt-14"><Cta p={p} /></div>
      </main>
    </PlatformShell>
  );
}

export function ArticleView({ p, a, related }: { p: PublicPlatform; a: Article; related: Article[] }) {
  const v = pageVars(p);
  return (
    <PlatformShell p={p}>
      <main className="py-10 sm:py-14">
        <article className="mx-auto max-w-3xl px-4 sm:px-6">
          <Crumbs items={[{ name: p.c.brand.name, href: "/" }, { name: "Blog", href: "/blog" }, { name: fill(a.title, v) }]} />
          <h1 className="mt-5 text-[1.6rem] font-black leading-[1.5] sm:text-[2.4rem] sm:leading-[1.45]">{fill(a.title, v)}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /><time dateTime={a.date}>{fmtDate(a.date)}</time></span>
            {a.updated && a.updated !== a.date && <span>Updated <time dateTime={a.updated}>{fmtDate(a.updated)}</time></span>}
            <span className="flex items-center gap-1.5"><Clock className="size-4" />{num(readMinutes(a.body))} min read</span>
          </div>
          {a.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.cover} alt={fill(a.title, v)} className="mt-6 aspect-[16/9] w-full rounded-3xl border border-border object-cover" />
          )}
          <p className="mt-6 text-base font-semibold leading-8 text-foreground/80 sm:text-lg sm:leading-9">{fill(a.description, v)}</p>
          <Prose className="mt-6" text={fill(a.body, v)} />
        </article>
        <div className={`mt-14 ${container}`}>
          <Cta p={p} />
          {related.length > 0 && (
            <>
              <h2 className="mt-12 text-lg font-black sm:text-xl">Related articles</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.slice(0, 3).map((r) => <ArticleCard key={r.slug} a={r} vars={v} />)}</div>
            </>
          )}
          <div className="mt-10 flex flex-wrap gap-2">
            {SOLUTIONS.map((o) => (
              <Link key={o.slug} href={`/${o.slug}`} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">{o.label}</Link>
            ))}
          </div>
        </div>
      </main>
    </PlatformShell>
  );
}

/* ============================ City pages ============================ */
export interface CityMenu { name: string; url: string }

/** City page FAQ (also emitted as JSON-LD) */
export const cityFaq = (city: string, brand: string, trial: string) => [
  { q: `Do I need an in-person visit to set up a digital menu in ${city}?`, a: `No. Signing up and building your menu happen entirely online and take just a few minutes — wherever you are in ${city}, your menu can be live the same day.` },
  { q: `How do venues in ${city} get support?`, a: `${brand} support is provided online and works the same way for every city.` },
  { q: "How much does a digital menu cost?", a: `The first ${trial} days are free. After that, you choose a monthly, quarterly or yearly plan.` },
];

export function CityView({ p, city, cities, menus, articles, demo = null }: { p: PublicPlatform; city: City; cities: City[]; menus: CityMenu[]; articles: Article[]; demo?: DemoInfo | null }) {
  const v = pageVars(p);
  const n = city.name;
  const faq = cityFaq(n, p.c.brand.name, String(v.trialDays));
  const body = `## A digital menu for cafés and restaurants in ${n}
With ${p.c.brand.name}, any [café](/cafe-menu), [restaurant](/restaurant-menu) or [fast-food spot](/fastfood-menu) in ${n} can build its own QR menu in minutes. Guests scan the code on the table with their phone camera and the menu opens with photos and up-to-date prices — no app to install.

## What you get
- A digital menu with photos, categories and three display modes
- A separate QR code for every table, ready to print from the dashboard
- Ordering at the table, waiter calls and bill requests
- Payment by bank transfer, card reader at the table or online card payment
- Daily and monthly reports, plus a customer club with SMS
- Your own menu address, customized with your logo and brand color

## Getting started in ${n}, step by step
1. Sign up, pick your business type and choose an address for your menu.
2. Add your items, prices and photos (a sample menu is ready to edit).
3. Print the table QR codes and place them on your tables — you can take orders the same day.

For details, read our [QR code menu guide](/blog/qr-code-menu-guide).`;
  return (
    <PlatformShell p={p}>
      <section className="relative -mt-[4.5rem] overflow-hidden bg-slate-950 pb-14 pt-28 text-white sm:pb-20 sm:pt-36 lg:-mt-[5.25rem]">
        <div aria-hidden className="pf-grid absolute inset-0" />
        <div aria-hidden className="absolute -top-40 left-1/2 size-[40rem] -translate-x-1/3 rounded-full bg-primary/30 blur-[120px]" />
        <div className={`relative ${container}`}>
          <div className="[&_a:hover]:text-white [&_nav]:text-white/60 [&_span[aria-current]]:text-white"><Crumbs items={[{ name: p.c.brand.name, href: "/" }, { name: "Cities", href: "/city" }, { name: n }]} /></div>
          <h1 className="mt-6 max-w-3xl text-[1.75rem] font-black leading-[1.4] tracking-tight sm:text-5xl sm:leading-[1.3]">
            Digital Menu in {n}
            <span className="mt-1 block bg-gradient-to-r from-primary via-primary to-white/90 bg-clip-text text-[0.6em] text-transparent sm:text-[0.55em]">For cafés, restaurants and fast-food spots in {n}</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[0.95rem] leading-8 text-white/75 sm:text-lg sm:leading-9">{city.intro}</p>
          {p.allowSignup && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={btnPrimary}>{p.c.hero.ctaPrimary || "Start free"}<ArrowRight className="size-4" /></Link>
              <a href="/#pricing" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 font-bold text-white backdrop-blur transition-colors hover:bg-white/10 sm:h-12">Pricing</a>
            </div>
          )}
        </div>
      </section>

      <section className={`py-14 sm:py-20 ${container}`}>
        <div className="mx-auto max-w-3xl"><Prose text={body} />{city.body && <Prose className="mt-6" text={fill(city.body, v)} />}</div>
        {demo && <DemoTry demo={demo} />}
      </section>

      {menus.length > 0 && (
        <section className="border-y border-border bg-muted/40 py-14 sm:py-20">
          <div className={container}>
            <SectionHead eyebrow={n} title={`Live digital menus in ${n}`} subtitle={`Venues in ${n} running their menu on ${p.c.brand.name}.`} />
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {menus.map((m) => <a key={m.url} href={m.url} target="_blank" rel="noopener" className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">{m.name}</a>)}
            </div>
          </div>
        </section>
      )}

      <section className={`py-14 sm:py-20 ${container}`}>
        <SectionHead eyebrow="FAQ" title={`FAQ — Digital menu in ${n}`} />
        <div className="mx-auto mt-10 grid max-w-3xl gap-3">
          {faq.map((q, i) => (
            <details key={i} className="group rounded-2xl border border-border bg-card p-4 open:shadow-lg open:shadow-black/5 sm:p-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold sm:text-base [&::-webkit-details-marker]:hidden">
                <h3>{q.q}</h3><ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[0.8125rem] leading-6 text-muted-foreground sm:text-sm sm:leading-7">{q.a}</p>
            </details>
          ))}
        </div>
        <h2 className="mt-12 text-lg font-black sm:text-xl">Other cities</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {cities.filter((c) => c.slug !== city.slug).map((c) => <Link key={c.slug} href={`/city/${c.slug}`} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary">Digital menu in {c.name}</Link>)}
        </div>
        {articles.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-black sm:text-xl">Related articles</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.slice(0, 3).map((a) => <ArticleCard key={a.slug} a={a} vars={v} />)}</div>
          </>
        )}
        <div className="mt-12"><Cta p={p} /></div>
      </section>
    </PlatformShell>
  );
}

export function CityIndex({ p, cities }: { p: PublicPlatform; cities: City[] }) {
  return (
    <PlatformShell p={p}>
      <main className={`py-10 sm:py-14 ${container}`}>
        <Crumbs items={[{ name: p.c.brand.name, href: "/" }, { name: "Cities" }]} />
        <h1 className="mt-5 text-[1.6rem] font-black leading-snug sm:text-4xl">Digital Menus by City</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
          {p.c.brand.name} runs entirely online, so cafés and restaurants in any city can launch their own QR menu and table ordering in minutes.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cities.map((c) => (
            <Link key={c.slug} href={`/city/${c.slug}`} className="group flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 font-bold transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              Digital menu in {c.name}<ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
        <div className="mt-14"><Cta p={p} /></div>
      </main>
    </PlatformShell>
  );
}
