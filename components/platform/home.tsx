import Link from "next/link";
import {
  ArrowLeft, BellRing, CakeSlice, Check, ChevronDown, Coffee, CupSoda, IceCreamCone, Instagram, LayoutDashboard, Mail, MapPin,
  Phone, Pizza, QrCode, Send, ShieldCheck, Sparkles, Store, TrendingUp, UtensilsCrossed,
} from "lucide-react";
import { money, toFa } from "@/lib/utils";
import { colorHsl, type SiteContent } from "@/lib/site-content";
import type { Plan } from "@/lib/platform";
import { FeatureIcon } from "@/components/platform/feature-icon";
import { FeatureCarousel } from "@/components/platform/feature-carousel";
import { MenuModesShowcase } from "@/components/platform/menu-modes-showcase";
import { DeckCarousel } from "@/components/platform/deck-carousel";

export interface PublicPlatform {
  trialDays: number; allowSignup: boolean; plans: Plan[]; root: string; otp: boolean;
  /** محتوای سایت (متغیرها جایگذاری‌شده) — از پنلِ مدیرِ کل ← «محتوای سایت» */
  c: SiteContent;
}

const isImg = (s: string) => /^(\/|https?:)/.test(s || "");
/** ایموجیِ ابتدای برچسب‌ها حذف می‌شود؛ آیکون از روی متن انتخاب می‌شود */
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, "").trim();
function kindIcon(k: string) {
  if (/کافه|قهوه/.test(k)) return Coffee;
  if (/فست|پیتزا|برگر/.test(k)) return Pizza;
  if (/بستنی|آبمیوه/.test(k)) return IceCreamCone;
  if (/قناد|شیرینی|کیک/.test(k)) return CakeSlice;
  if (/رستوران|غذا/.test(k)) return UtensilsCrossed;
  return Store;
}

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const btnPrimary = "inline-flex h-11 sm:h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-[filter,box-shadow] duration-200 hover:brightness-110 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30";

/** قاب مشترکِ صفحه‌های پلتفرم: پالتِ خنثی + رنگِ برند، نوارِ اعلان، منوی شناور و پاورقی */
export function PlatformShell({ p, children }: { p: PublicPlatform; children: React.ReactNode }) {
  const { c } = p;
  return (
    <div className="platform min-h-screen bg-background text-foreground" style={{ ["--primary" as string]: colorHsl(c.brand.color), ["--ring" as string]: colorHsl(c.brand.color) }}>
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

export function BrandMark({ c, className = "size-9" }: { c: SiteContent; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-lg text-primary-foreground ${className}`}>
      {isImg(c.brand.logo) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.brand.logo} alt="" className="size-full object-cover" />
      ) : c.brand.logo || <Store className="size-5" />}
    </span>
  );
}

export function PlatformNav({ p }: { p: PublicPlatform }) {
  return (
    <div className="sticky top-3 z-40 px-3">
      <header className="mx-auto flex max-w-6xl items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm shadow-black/5 backdrop-blur-xl sm:px-4">
        <Link href="/" className="flex items-center gap-2 font-black"><BrandMark c={p.c} />{p.c.brand.name}</Link>
        <nav className="mx-auto hidden items-center gap-1 text-sm font-semibold text-muted-foreground md:flex">
          {[["امکانات", "/#features"], ["حالت‌های نمایش", "/#views"], ["روشِ کار", "/#how"], ["تعرفه‌ها", "/#pricing"], ["سؤالات", "/#faq"]].map(([l, h]) => (
            <a key={h} href={h} className="rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-muted hover:text-foreground">{l}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5 md:ms-0">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">ورود</Link>
          {p.allowSignup && <Link href="/signup" className="rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background transition-opacity hover:opacity-90">شروعِ رایگان</Link>}
        </div>
      </header>
    </div>
  );
}

/* ---------------------------------- تصاویرِ نمایشی ---------------------------------- */

/** کدِ QRِ تزئینی (ثابت، بدونِ کتابخانه) */
function PseudoQr({ className = "size-24" }: { className?: string }) {
  const n = 21, cells: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    if (finder) continue;
    if (((x * 7 + y * 13 + x * y) % 5) < 2) cells.push([x, y]);
  }
  const finder = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width="7" height="7" rx="1.2" fill="currentColor" />
      <rect x={ox + 1} y={oy + 1} width="5" height="5" rx="0.8" fill="white" />
      <rect x={ox + 2} y={oy + 2} width="3" height="3" rx="0.6" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} aria-hidden>
      <rect width={n} height={n} fill="white" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />)}
      {finder(0, 0)}{finder(n - 7, 0)}{finder(0, n - 7)}
    </svg>
  );
}

const DISHES = [
  { name: "کاپوچینو", price: 72000, icon: Coffee, tone: "from-amber-200 to-orange-400" },
  { name: "چیزکیک", price: 110000, icon: CakeSlice, tone: "from-rose-200 to-pink-400" },
  { name: "موهیتو", price: 88000, icon: CupSoda, tone: "from-lime-200 to-emerald-400" },
];

function PhoneMockup({ name }: { name: string }) {
  return (
    <div className="relative w-[17rem] rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
      <div className="absolute left-1/2 top-3.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
      <div className="overflow-hidden rounded-[2.2rem] bg-white text-slate-900">
        <div className="bg-gradient-to-b from-primary to-primary/80 px-4 pb-5 pt-9 text-white">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-xl bg-white/20"><Coffee className="size-5" /></span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold">میز ۴</span>
          </div>
          <b className="mt-3 block text-lg">{name}</b>
          <span className="text-[11px] text-white/80">منوی امروز · سفارش از همین‌جا</span>
        </div>
        <div className="-mt-3 rounded-t-3xl bg-white px-3 pt-3">
          <div className="mb-3 flex gap-1.5 text-[10px] font-bold">
            {["نوشیدنی گرم", "سرد", "کیک", "صبحانه"].map((x, i) => (
              <span key={x} className={i === 0 ? "rounded-full bg-primary px-2.5 py-1 text-white" : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"}>{x}</span>
            ))}
          </div>
          {DISHES.map((d) => (
            <div key={d.name} className="mb-2 flex items-center gap-2.5 rounded-2xl border border-slate-100 p-2">
              <span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${d.tone} text-white`}><d.icon className="size-6" /></span>
              <div className="flex-1 text-xs"><b className="block">{d.name}</b><span className="text-slate-500">{money(d.price)}</span></div>
              <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-white">+</span>
            </div>
          ))}
          <div className="mb-3 mt-1 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white">
            <span>ثبتِ سفارش</span><span>{money(182000)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={`absolute rounded-2xl border border-white/10 bg-white/95 p-3 text-slate-900 shadow-xl shadow-black/20 backdrop-blur ${className}`}>{children}</div>;
}

function DashboardMock() {
  const bars = [38, 52, 44, 70, 58, 84, 76];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl ring-1 ring-white/5 backdrop-blur" aria-hidden>
      <div className="mb-4 flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-red-400/80" /><span className="size-2.5 rounded-full bg-amber-400/80" /><span className="size-2.5 rounded-full bg-green-400/80" />
        <span className="ms-auto flex items-center gap-1 text-[11px] text-white/60"><span className="size-1.5 animate-pulse rounded-full bg-green-400" /> زنده</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["فروشِ امروز", "۸٫۴م"], ["سفارش", "۶۴"], ["میانگین", "۱۳۱ه"]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/[0.06] p-3"><div className="text-[10px] text-white/50">{k}</div><b className="mt-1 block text-lg text-white">{v}</b></div>
        ))}
      </div>
      <div className="mt-3 flex h-28 items-end gap-2 rounded-2xl bg-white/[0.06] p-3">
        {bars.map((h, i) => <div key={i} className="flex-1 rounded-t-[4px] bg-primary/80" style={{ height: `${h}%` }} />)}
      </div>
      <div className="mt-3 space-y-2">
        {[["میز ۷", "۲ کاپوچینو · ۱ چیزکیک", "جدید"], ["میز ۳", "صدا زدنِ گارسون", "درخواست"]].map(([t, d, s]) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-xs">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-primary"><BellRing className="size-4" /></span>
            <div className="flex-1"><b className="block text-white">{t}</b><span className="text-white/50">{d}</span></div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- صفحهٔ اصلی ---------------------------------- */

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-bold text-primary sm:text-sm">{eyebrow}</span>
      <h2 className="mt-2 text-[1.45rem] font-black leading-snug tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm leading-7 text-muted-foreground sm:mt-4 sm:text-lg sm:leading-8">{subtitle}</p>}
    </div>
  );
}

export function PlatformHome({ p }: { p: PublicPlatform }) {
  const { c } = p;
  const [big, ...rest] = c.features.items.filter((f) => !f.hidden);
  return (
    <PlatformShell p={p}>
      {/* ===== هیرو (تیره، با رنگِ برند) ===== */}
      <section className="relative -mt-[4.5rem] overflow-hidden bg-slate-950 pb-14 pt-28 text-white sm:pb-28 sm:pt-40">
        <div aria-hidden className="pf-grid absolute inset-0" />
        <div aria-hidden className="absolute -top-40 right-1/2 size-[44rem] translate-x-1/3 rounded-full bg-primary/30 blur-[120px]" />
        <div aria-hidden className="absolute -bottom-40 left-0 size-[30rem] rounded-full bg-primary/15 blur-[100px]" />
        {/* موبایل: متن ← تصویرِ گوشی ← دکمه‌ها؛ دسکتاپ: متن و دکمه‌ها یک ستون، گوشی ستونِ دیگر */}
        <div className={`relative grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-x-14 lg:gap-y-0 ${container}`}>
          <div className="pf-rise text-center lg:col-start-1 lg:row-start-1 lg:self-end lg:text-right">
            {c.hero.badge && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-white/90 backdrop-blur">
                <Sparkles className="size-3.5 text-primary" /> {c.hero.badge}
              </span>
            )}
            <h1 className="mt-5 text-[1.75rem] font-black leading-[1.4] tracking-tight sm:mt-6 sm:text-5xl sm:leading-[1.3] lg:text-[3.6rem]">
              {c.hero.title}
              {c.hero.highlight && <span className="mt-1 block bg-gradient-to-l from-primary via-primary to-white/90 bg-clip-text text-transparent">{c.hero.highlight}</span>}
            </h1>
            <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-[0.95rem] leading-7 text-white/70 sm:mt-6 sm:text-lg sm:leading-8 lg:mx-0">{c.hero.subtitle}</p>
          </div>

          <div className="relative mx-auto h-[22.5rem] w-full max-w-md sm:h-[33rem] lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-hidden>
            <div className="pf-float absolute left-1/2 top-0 -translate-x-1/2"><div className="origin-top scale-[0.78] sm:scale-100"><PhoneMockup name={c.hero.mockupName} /></div></div>
            <FloatCard className="pf-float-slow -left-10 top-12 hidden w-52 sm:block">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><BellRing className="size-5" /></span>
                <div className="text-xs"><b className="block">سفارشِ جدید · میز ۴</b><span className="text-slate-500">همین حالا</span></div>
              </div>
            </FloatCard>
            <FloatCard className="pf-float -left-12 bottom-32 hidden w-44 sm:block">
              <div className="text-[11px] text-slate-500">فروشِ امروز</div>
              <div className="mt-0.5 flex items-center gap-1.5"><b className="text-lg">۸٬۴۰۰٬۰۰۰</b><TrendingUp className="size-4 text-emerald-600" /></div>
            </FloatCard>
            <FloatCard className="pf-float-slow -right-10 -bottom-4 hidden p-2.5 text-slate-900 sm:block">
              <PseudoQr className="size-20 text-slate-900" />
              <div className="mt-1 text-center text-[10px] font-bold text-slate-500">اسکن کنید</div>
            </FloatCard>
          </div>

          <div className="pf-rise text-center lg:col-start-1 lg:row-start-2 lg:self-start lg:text-right">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:mt-9 lg:justify-start">
              {p.allowSignup && c.hero.ctaPrimary && (
                <Link href="/signup" className={btnPrimary}>{c.hero.ctaPrimary}<ArrowLeft className="size-4" /></Link>
              )}
              {c.hero.ctaSecondary && (
                <Link href="/login" className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-white/20 sm:h-12 bg-white/5 px-6 font-bold text-white backdrop-blur transition-colors duration-200 hover:bg-white/10">{c.hero.ctaSecondary}</Link>
              )}
            </div>
            {c.trust.length > 0 && (
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/70 sm:mt-8 sm:gap-x-6 sm:text-sm lg:justify-start">
                {c.trust.map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-primary" /> {t}</li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ===== مناسب برای ===== */}
      {c.kinds.length > 0 && (
        <section className="border-b border-border">
          {/* موبایل: یک ردیفِ قابلِ کشیدن؛ دسکتاپ: وسط‌چین */}
          <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-5 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-4 sm:px-6 sm:py-8 [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">مناسب برای</span>
            {c.kinds.map((raw) => {
              const k = noEmoji(raw);
              const I = kindIcon(k);
              return <span key={raw} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-sm font-bold text-foreground/80 sm:border-0 sm:px-0 sm:py-0"><I className="size-5 text-primary" /> {k}</span>;
            })}
          </div>
        </section>
      )}

      {/* ===== امکانات (چیدمانِ بنتو) ===== */}
      {big && (
        <section id="features" className={`scroll-mt-24 py-16 sm:py-28 ${container}`}>
          <SectionHead eyebrow="امکانات" title={c.features.title} subtitle={c.features.subtitle} />
          {big && (
            <article className="group relative mt-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.07] to-transparent p-5 sm:mt-14 sm:p-7 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:p-10">
              <div>
                <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><FeatureIcon name={big.icon} className="size-6" /></span>
                <h3 className="mt-4 text-xl font-black sm:mt-5 sm:text-2xl">{big.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">{big.text}</p>
              </div>
              <div className="mt-6 flex items-end gap-6 sm:mt-8 lg:mt-0" aria-hidden>
                <div className="rounded-3xl border border-border bg-card p-3 shadow-xl shadow-black/5 sm:p-4"><PseudoQr className="size-20 text-foreground sm:size-28 dark:text-slate-900" /></div>
                <div className="hidden flex-1 space-y-2 sm:block">
                  {DISHES.map((d) => (
                    <div key={d.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
                      <span className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${d.tone} text-white`}><d.icon className="size-5" /></span>
                      <b className="flex-1 text-sm">{d.name}</b><span className="text-xs text-muted-foreground">{money(d.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          )}
          {/* بقیهٔ امکانات: کاروسلِ چرخ و دستهٔ کارت */}
          {rest.length > 0 && <FeatureCarousel items={rest} label={c.features.title} autoplay={Math.round((c.features.autoplay ?? 3.5) * 1000)} />}
        </section>
      )}

      {/* ===== حالت‌های نمایشِ منو ===== */}
      {c.views.title && (
        <section id="views" className="relative scroll-mt-24 overflow-hidden border-t border-border py-16 sm:py-28">
          <div aria-hidden className="absolute -right-40 top-20 size-[28rem] rounded-full bg-primary/[0.07] blur-[100px]" />
          <div className={`relative ${container}`}>
            <SectionHead eyebrow="حالت‌های نمایش" title={c.views.title} subtitle={c.views.subtitle} />
            <MenuModesShowcase v={c.views} cafeName={c.hero.mockupName} />
          </div>
        </section>
      )}

      {/* ===== روشِ کار ===== */}
      {c.steps.items.length > 0 && (
        <section id="how" className="scroll-mt-24 border-y border-border bg-muted/50 py-16 sm:py-28">
          <div className={container}>
            <SectionHead eyebrow="روشِ کار" title={c.steps.title} />
            <ol className="relative mt-10 grid gap-4 sm:mt-14 md:grid-cols-3 md:gap-6">
              <div aria-hidden className="absolute inset-x-[16%] top-7 hidden h-px bg-gradient-to-l from-transparent via-primary/40 to-transparent md:block" />
              {c.steps.items.map((s, i) => (
                <li key={i} className="relative flex items-start gap-4 rounded-2xl bg-card p-4 md:block md:bg-transparent md:p-0 md:text-center">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-base font-black text-primary shadow-sm md:mx-auto md:size-14 md:rounded-2xl md:text-xl">{toFa(i + 1)}</span>
                  <div>
                    <h3 className="text-[0.95rem] font-extrabold md:mt-5 md:text-lg">{s.title}</h3>
                    {/* dir="rtl": متنی که با «QR» شروع شود هم راست‌به‌چپ بماند */}
                    <p className="mt-1 text-[0.8125rem] leading-6 text-muted-foreground md:mx-auto md:text-sm md:leading-7 md:mt-2 md:max-w-xs" dir="rtl">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ===== پنلِ مدیریت (تیره) ===== */}
      <section className="py-16 sm:py-28">
        <div className={container}>
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-10 text-white ring-1 ring-white/10 sm:px-12 sm:py-16">
            <div aria-hidden className="absolute -left-20 -top-20 size-80 rounded-full bg-primary/25 blur-[100px]" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary"><LayoutDashboard className="size-4" /> پنلِ مدیریت</span>
                <h2 className="mt-3 text-[1.45rem] font-black leading-snug tracking-tight sm:text-4xl">{c.showcase.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/70 sm:mt-4 sm:text-base sm:leading-8">{c.showcase.text}</p>
                <ul className="mt-6 space-y-3">
                  {c.showcase.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/20"><Check className="size-3.5 text-primary" /></span><span className="text-sm text-white/85 sm:text-base">{b}</span></li>
                  ))}
                </ul>
              </div>
              <DashboardMock />
            </div>
          </div>
        </div>
      </section>

      {/* ===== تعرفه‌ها ===== */}
      <section id="pricing" className={`scroll-mt-24 pb-16 sm:pb-28 ${container}`}>
        <SectionHead eyebrow="تعرفه‌ها" title={c.pricing.title} subtitle={c.pricing.subtitle} />
        {/* کاروسلِ طرح‌ها؛ از طرحِ محبوب شروع می‌شود */}
        {p.plans.length > 0 && (
          <DeckCarousel
            className="mt-8 sm:mt-12" label={c.pricing.title}
            start={Math.max(0, p.plans.findIndex((pl) => pl.popular))}
            stageClass="h-[28rem] sm:h-[30.5rem]"
            cardClass="h-[25rem] w-[min(19rem,78vw)] rounded-[1.75rem] sm:h-[27rem] sm:w-[21rem] sm:rounded-[2rem]"
            slideClass={p.plans.map((pl) => (pl.popular ? "bg-slate-950 text-white shadow-2xl shadow-primary/25 ring-2 ring-inset ring-primary" : "border border-border bg-card shadow-xl shadow-black/[0.06]"))}
            dimClass="bg-background" dim={[0.35, 0.6]} spread={[0.62, 0.86]}
            titles={p.plans.map((pl) => pl.title)}
            slides={p.plans.map((pl) => (
              <div key={pl.id} className="flex h-full flex-col p-5 sm:p-7">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold sm:text-lg">{pl.title}</h3>
                  {pl.popular && <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow">محبوب‌ترین</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5 sm:mt-4"><b className="text-[1.75rem] font-black tracking-tight sm:text-4xl">{toFa(pl.price.toLocaleString("en-US"))}</b><span className={`text-sm sm:text-base ${pl.popular ? "text-white/60" : "text-muted-foreground"}`}>تومان</span></div>
                <div className={`mt-1 text-xs sm:text-sm ${pl.popular ? "text-white/60" : "text-muted-foreground"}`}>{pl.months > 1 ? `معادلِ ماهی ${money(Math.round(pl.price / pl.months))}` : "پرداختِ ماهانه"}</div>
                <ul className={`mt-5 flex-1 space-y-2.5 border-t pt-5 text-sm ${pl.popular ? "border-white/10" : "border-border"}`}>
                  {c.pricing.bullets.map((x) => <li key={x} className="flex items-center gap-2.5"><Check className="size-4 shrink-0 text-primary" /> {x}</li>)}
                </ul>
                {p.allowSignup && c.pricing.cta && (
                  <Link href="/signup" className={pl.popular ? `${btnPrimary} mt-5 w-full` : "mt-5 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-border font-bold transition-colors duration-200 hover:bg-muted sm:h-12"}>{c.pricing.cta}</Link>
                )}
              </div>
            ))}
          />
        )}
      </section>

      {/* ===== سؤالات ===== */}
      {c.faq.items.length > 0 && (
        <section id="faq" className="scroll-mt-24 border-t border-border bg-muted/50 py-16 sm:py-28">
          <div className={container}>
            <SectionHead eyebrow="سؤالات" title={c.faq.title} />
            <div className="mx-auto mt-10 grid max-w-5xl gap-3 md:mt-12 md:grid-cols-2">
              {c.faq.items.map((f, i) => (
                <details key={i} className="group h-fit rounded-2xl border border-border bg-card p-4 sm:p-5 transition-shadow duration-200 open:shadow-lg open:shadow-black/5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold sm:text-base [&::-webkit-details-marker]:hidden">
                    {f.q}<ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-[0.8125rem] leading-6 text-muted-foreground sm:text-sm sm:leading-7">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== دعوتِ پایانی ===== */}
      {p.allowSignup && (
        <section className={`py-16 sm:py-24 ${container}`}>
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-5 py-12 text-center text-primary-foreground sm:px-12 sm:py-14">
            <div aria-hidden className="pf-grid absolute inset-0 opacity-60" />
            <div aria-hidden className="absolute -bottom-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-white/20 blur-[90px]" />
            <div className="relative">
              <QrCode className="mx-auto size-10 opacity-90" />
              <h2 className="mx-auto mt-4 max-w-2xl text-[1.45rem] font-black leading-snug tracking-tight sm:text-4xl">{c.finalCta.title}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-primary-foreground/85 sm:mt-4 sm:text-lg">{c.finalCta.text}</p>
              <Link href="/signup" className="mt-8 inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-white px-7 font-bold text-slate-900 shadow-xl transition-opacity duration-200 hover:opacity-90">
                {c.finalCta.button}<ArrowLeft className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </PlatformShell>
  );
}

export function PlatformFooter({ p }: { p: PublicPlatform }) {
  const f = p.c.footer;
  const social = [
    f.instagram && { label: "اینستاگرام", icon: Instagram, href: /^https?:/.test(f.instagram) ? f.instagram : `https://instagram.com/${f.instagram.replace(/^@/, "")}` },
    f.telegram && { label: "تلگرام", icon: Send, href: /^https?:/.test(f.telegram) ? f.telegram : `https://t.me/${f.telegram.replace(/^@/, "")}` },
    f.whatsapp && { label: "واتساپ", icon: Phone, href: /^https?:/.test(f.whatsapp) ? f.whatsapp : `https://wa.me/${f.whatsapp.replace(/\D/g, "").replace(/^0/, "98")}` },
  ].filter(Boolean) as { label: string; icon: typeof Send; href: string }[];
  const col = "text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground";
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className={`grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-14 ${container}`}>
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 font-black"><BrandMark c={p.c} />{p.c.brand.name}</div>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{f.text}</p>
          {social.length > 0 && (
            <div className="mt-5 flex gap-2">
              {social.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener" aria-label={s.label} title={s.label} className="grid size-10 cursor-pointer place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-primary"><s.icon className="size-[18px]" /></a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-extrabold">محصول</h3>
          <ul className="mt-4 space-y-2.5">
            <li><a href="/#features" className={col}>امکانات</a></li>
            <li><a href="/#views" className={col}>حالت‌های نمایش</a></li>
            <li><a href="/#pricing" className={col}>تعرفه‌ها</a></li>
            <li><a href="/#faq" className={col}>سؤالاتِ رایج</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-extrabold">حساب</h3>
          <ul className="mt-4 space-y-2.5">
            {p.allowSignup && <li><Link href="/signup" className={col}>ثبت‌نام</Link></li>}
            <li><Link href="/login" className={col}>ورود به پنل</Link></li>
            <li><Link href="/terms" className={col}>قوانین و شرایط</Link></li>
            <li><Link href="/privacy" className={col}>حریمِ خصوصی</Link></li>
          </ul>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h3 className="text-sm font-extrabold">تماس</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {f.phone && <li className="flex items-center gap-2"><Phone className="size-4 shrink-0" /><a href={`tel:${f.phone}`} dir="ltr" className="hover:text-foreground">{toFa(f.phone)}</a></li>}
            {f.email && <li className="flex items-center gap-2"><Mail className="size-4 shrink-0" /><a href={`mailto:${f.email}`} dir="ltr" className="hover:text-foreground">{f.email}</a></li>}
            {f.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{f.address}</li>}
            {!f.phone && !f.email && !f.address && <li>از طریقِ شبکه‌های اجتماعی در تماس باشید.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className={`flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-muted-foreground ${container}`}>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-4" /> اطلاعاتِ هر مجموعه جدا و امن نگه‌داری می‌شود</span>
          <span>© {toFa(new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric" }).format(new Date()).replace(/\D/g, ""))} {p.c.brand.name}</span>
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
