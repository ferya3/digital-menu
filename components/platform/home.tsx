import Link from "next/link";
import {
  BellRing, Calculator, Check, CreditCard, MessageSquareText, Palette, QrCode, ShieldCheck, Smartphone, Sparkles, Store, Users,
} from "lucide-react";
import { money, toFa } from "@/lib/utils";
import type { Plan } from "@/lib/platform";

export interface PublicPlatform {
  brand: string; tagline: string; support: string; trialDays: number; allowSignup: boolean; plans: Plan[]; root: string;
}

const FEATURES = [
  { icon: QrCode, title: "منوی QR برای هر میز", text: "مشتری QRِ روی میز را اسکن می‌کند و منوی زیبا و سریع را روی گوشی می‌بیند؛ بدونِ نصبِ برنامه." },
  { icon: Smartphone, title: "سفارش آنلاین سرِ میز", text: "سفارش مستقیم و لحظه‌ای روی پنلِ شما و آشپزخانه می‌نشیند؛ با صدای اعلان." },
  { icon: CreditCard, title: "پرداخت قبل از آماده‌سازی", text: "کارت‌به‌کارت با فیش، کارت‌خوانِ سرِ میز یا درگاهِ اینترنتی — به انتخابِ شما." },
  { icon: BellRing, title: "صدا زدنِ گارسون و صورتحساب", text: "درخواست‌ها با شمارهٔ میز روی پنل می‌آید؛ دیگر کسی منتظر نمی‌ماند." },
  { icon: Calculator, title: "حسابداریِ روزانه و ماهانه", text: "درآمدِ امروز، ماه و پرفروش‌ترین‌ها با تقویمِ شمسی." },
  { icon: Users, title: "باشگاهِ مشتریان", text: "شمارهٔ مشتری‌ها با تأییدِ پیامکی جمع می‌شود؛ خروجیِ اکسل." },
  { icon: MessageSquareText, title: "پیامکِ گروهی", text: "تخفیف‌ها و جشنواره‌ها را برای مشتری‌های وفادار یا قدیمی بفرستید." },
  { icon: Palette, title: "کاملاً شخصی‌سازی‌شده", text: "لوگو، رنگِ برند، بنرِ دسته‌ها، ویدیوی خوش‌آمد و آدرسِ اختصاصی برای هر مجموعه." },
];
const KINDS = ["☕ کافه و کافی‌شاپ", "🍽️ رستوران", "🍔 فست‌فود", "🍨 بستنی و آبمیوه", "🧁 قنادی و شیرینی"];

export function PlatformHome({ p }: { p: PublicPlatform }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PlatformNav p={p} />

      {/* ===== هیرو ===== */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" /> {p.trialDays > 0 ? `${toFa(p.trialDays)} روز رایگان، بدونِ کارت بانکی` : "راه‌اندازی در چند دقیقه"}
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.35] sm:text-5xl">
              منوی دیجیتال و سفارش‌گیری
              <span className="block text-primary">برای کسب‌وکارِ شما</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">{p.tagline}. آدرسِ اختصاصی می‌گیرید و همه‌چیز — از منو و قیمت تا رنگ و لوگو — مخصوصِ خودتان است.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {p.allowSignup && (
                <Link href="/signup" className="flex h-12 items-center rounded-2xl bg-primary px-7 font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110">
                  ساختِ منوی رایگان
                </Link>
              )}
              <Link href="/login" className="flex h-12 items-center rounded-2xl border border-border px-6 font-bold transition hover:bg-muted">ورود به پنل</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {KINDS.map((k) => <span key={k} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{k}</span>)}
            </div>
          </div>

          {/* پیش‌نمایشِ گوشی */}
          <div className="mx-auto w-full max-w-[19rem]">
            <div className="rounded-[2.6rem] border-[10px] border-foreground/90 bg-card p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">☕</span>
                <b className="text-sm">کافه رویا</b>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">میز ۴</span>
              </div>
              <div className="mb-3 flex gap-1.5 overflow-hidden text-[10px] font-bold">
                {["قهوهٔ گرم", "سرد", "کیک", "صبحانه"].map((c, i) => (
                  <span key={c} className={i === 0 ? "rounded-full bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-full bg-muted px-2.5 py-1"}>{c}</span>
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
      <section id="features" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-3xl font-black">هر چیزی که برای سرویسِ سریع‌تر لازم دارید</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">بدونِ سخت‌افزار و نصبِ برنامه؛ فقط یک گوشی یا لپ‌تاپ برای پنلِ مدیریت.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><f.icon className="size-5" /></span>
              <h3 className="mt-3 font-extrabold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== مراحل ===== */}
      <section className="bg-muted/40 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-black">در سه قدم راه بیندازید</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["ثبت‌نام", `نام و نوعِ کسب‌وکار و یک آدرس (مثل roya.${p.root}) انتخاب کنید.`],
              ["شخصی‌سازی", "منو، قیمت‌ها، عکس‌ها، لوگو و روش‌های پرداخت را از پنل وارد کنید."],
              ["چاپِ QR", "QRِ میزها را از پنل چاپ کنید و روی میزها بگذارید. تمام!"],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-3xl bg-card p-6 shadow-sm">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-lg font-black text-primary-foreground">{toFa(i + 1)}</span>
                <h3 className="mt-3 text-lg font-extrabold">{t}</h3>
                <p className="mt-1 text-sm leading-7 text-muted-foreground" dir="auto">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== قیمت‌ها ===== */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-3xl font-black">تعرفهٔ اشتراک</h2>
        <p className="mt-3 text-center text-muted-foreground">
          همهٔ امکانات در همهٔ طرح‌ها{p.trialDays > 0 ? ` · ${toFa(p.trialDays)} روزِ اول رایگان` : ""}
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {p.plans.map((pl) => (
            <div key={pl.id} className={`relative rounded-3xl border-2 bg-card p-6 shadow-sm ${pl.popular ? "border-primary shadow-xl shadow-primary/10" : "border-border"}`}>
              {pl.popular && <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">محبوب‌ترین</span>}
              <h3 className="text-lg font-extrabold">{pl.title}</h3>
              <div className="mt-3 text-3xl font-black">{money(pl.price)}</div>
              {pl.months > 1 && <div className="mt-1 text-sm text-muted-foreground">معادلِ ماهی {money(Math.round(pl.price / pl.months))}</div>}
              <ul className="mt-5 space-y-2 text-sm">
                {["منو و سفارشِ نامحدود", "پنلِ مدیریت و حسابداری", "آدرسِ اختصاصی + HTTPS", "پشتیبانی"].map((x) => (
                  <li key={x} className="flex items-center gap-2"><Check className="size-4 text-primary" /> {x}</li>
                ))}
              </ul>
              {p.allowSignup && (
                <Link href="/signup" className={`mt-6 flex h-11 items-center justify-center rounded-2xl font-bold transition ${pl.popular ? "bg-primary text-primary-foreground hover:brightness-110" : "border border-border hover:bg-muted"}`}>
                  شروع رایگان
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== سؤالات ===== */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="mb-6 text-center text-3xl font-black">سؤالاتِ رایج</h2>
        {[
          ["دادهٔ ما از بقیه جداست؟", "بله. هر مجموعه دیتابیس و پوشهٔ عکسِ جدای خودش را دارد و فقط با رمزِ پنلِ خودش قابل دسترسی است."],
          ["بعد از تمام شدنِ اشتراک چه می‌شود؟", "منوی مشتری‌ها موقتاً غیرفعال می‌شود ولی هیچ داده‌ای پاک نمی‌شود؛ با تمدید، همه‌چیز همان‌طور برمی‌گردد."],
          ["دامنهٔ اختصاصیِ خودم را می‌توانم وصل کنم؟", "بله؛ با پشتیبانی هماهنگ کنید تا دامنهٔ شما (مثلاً menu.yourname.ir) به منو وصل شود."],
          ["برای شروع چه لازم است؟", "هیچ! ثبت‌نام کنید، منوی نمونه آماده است؛ فقط محصولات و قیمت‌های خودتان را جایگزین کنید."],
        ].map(([q, a]) => (
          <details key={q} className="group mb-3 rounded-2xl border border-border bg-card p-4">
            <summary className="cursor-pointer list-none font-bold">{q}</summary>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{a}</p>
          </details>
        ))}
      </section>

      <PlatformFooter p={p} />
    </div>
  );
}

export function PlatformNav({ p }: { p: Pick<PublicPlatform, "brand" | "allowSignup"> }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-black">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Store className="size-5" /></span>
          {p.brand}
        </Link>
        <nav className="ms-auto flex items-center gap-1 text-sm font-semibold">
          <a href="/#pricing" className="hidden rounded-xl px-3 py-2 text-muted-foreground transition hover:text-foreground sm:block">تعرفه‌ها</a>
          <Link href="/login" className="rounded-xl px-3 py-2 text-muted-foreground transition hover:text-foreground">ورود</Link>
          {p.allowSignup && <Link href="/signup" className="rounded-xl bg-primary px-4 py-2 text-primary-foreground">ثبت‌نام</Link>}
        </nav>
      </div>
    </header>
  );
}

export function PlatformFooter({ p }: { p: Pick<PublicPlatform, "brand" | "support"> }) {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <div className="flex items-center justify-center gap-1.5"><ShieldCheck className="size-4" /> {p.brand}</div>
      {p.support && <div className="mt-1">پشتیبانی: <span dir="ltr">{toFa(p.support)}</span></div>}
    </footer>
  );
}
