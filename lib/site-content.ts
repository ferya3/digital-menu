/**
 * محتوای قابلِ ویرایشِ سایتِ پلتفرم (صفحهٔ اصلی، ثبت‌نام، ورود، پاورقی، صفحه‌های قوانین، پیام‌های سیستمی).
 * از پنلِ مدیرِ کل ← «محتوای سایت» ویرایش می‌شود. در متن‌ها می‌توان از {brand}، {trialDays} و {root} استفاده کرد.
 */
/**
 * کارتِ امکانات؛ hidden = موقتاً در سایت نشان داده نشود.
 * image: عکسِ کارت (کاروسل: کلِ کارت را می‌پوشاند، نسبتِ ۹:۱۰؛ کارتِ بزرگ: جای تصویرِ QR، نسبتِ ۱۶:۱۰)
 */
export interface FeatureItem { icon: string; title: string; text: string; hidden?: boolean; image?: string }
/** نظرِ یک مجموعهٔ مشتری */
export interface Testimonial { name: string; person: string; role: string; city: string; text: string; logo: string }
export interface SiteContent {
  /** poweredBy: لینکِ کوچکِ «منوی دیجیتال با …» پایینِ منوی مجموعه‌ها (بک‌لینک به سایت) */
  brand: { name: string; logo: string; color: string; seoTitle: string; seoDescription: string; ogImage: string; googleVerification: string; poweredBy: boolean };
  announce: { enabled: boolean; text: string; link: string };
  /** demoSlug: زیردامنهٔ منوی نمونهٔ زنده (خالی = بدونِ دکمهٔ منوی نمونه) */
  hero: { badge: string; title: string; highlight: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; mockupName: string; demoSlug: string; demoLabel: string };
  /** ویژگی‌های کوتاهِ زیرِ دکمه‌های بالای صفحه (تیک‌دار) */
  trust: string[];
  /** بخشِ معرفیِ پنلِ مدیریت (پس‌زمینهٔ تیره) */
  showcase: { title: string; text: string; bullets: string[] };
  /** دعوتِ پایانیِ پایینِ صفحه */
  finalCta: { title: string; text: string; button: string };
  kinds: string[];
  /** اولین کارتِ نمایان = کارتِ بزرگِ بالا، بقیه = کاروسل؛ autoplay = ثانیه‌های پخشِ خودکار (۰ = خاموش) */
  features: { title: string; subtitle: string; items: FeatureItem[]; autoplay: number };
  /** معرفیِ حالت‌های نمایشِ منو؛ items به ترتیب: کاروسل، شبکه‌ای، لیستی */
  views: { title: string; subtitle: string; items: { title: string; text: string }[]; bullets: string[] };
  steps: { title: string; items: { title: string; text: string }[] };
  pricing: { title: string; subtitle: string; bullets: string[]; cta: string };
  faq: { title: string; items: { q: string; a: string }[] };
  /** floatButton: دکمهٔ شناورِ واتساپ/تماس؛ floatText: پیامِ آماده در واتساپ */
  footer: { text: string; phone: string; email: string; address: string; instagram: string; telegram: string; whatsapp: string; floatButton: boolean; floatText: string };
  /** نظرِ مشتری‌ها (خالی = بخش نمایش داده نمی‌شود؛ فقط نظرِ واقعی بگذارید) */
  testimonials: { title: string; subtitle: string; items: Testimonial[] };
  signup: { title: string; subtitle: string; button: string; requireTerms: boolean };
  login: { title: string; subtitle: string; help: string };
  legal: { terms: string; privacy: string };
  unavailable: { missingTitle: string; missingText: string; inactiveTitle: string; inactiveText: string };
}

/** رنگ‌های آماده برای رنگِ اصلیِ سایت (HSL برای متغیرِ --primary) */
export const BRAND_COLORS: { id: string; label: string; hsl: string; hex: string }[] = [
  { id: "red", label: "قرمز", hsl: "356 72% 48%", hex: "#d4212f" },
  { id: "orange", label: "نارنجی", hsl: "24 90% 48%", hex: "#e8650c" },
  { id: "amber", label: "کهربایی", hsl: "36 92% 42%", hex: "#cf8509" },
  { id: "green", label: "سبز", hsl: "152 62% 34%", hex: "#218c5c" },
  { id: "teal", label: "فیروزه‌ای", hsl: "176 70% 32%", hex: "#188a83" },
  { id: "blue", label: "آبی", hsl: "217 80% 50%", hex: "#1966e6" },
  { id: "indigo", label: "نیلی", hsl: "239 65% 55%", hex: "#4a4dd8" },
  { id: "purple", label: "بنفش", hsl: "270 62% 52%", hex: "#8336d6" },
  { id: "pink", label: "صورتی", hsl: "332 74% 50%", hex: "#dd217a" },
  { id: "slate", label: "زغالی", hsl: "220 18% 26%", hex: "#36404f" },
];

/** آیکون‌های مجاز برای کارت‌های امکانات (نامِ آیکونِ lucide) */
/** نامِ فارسیِ آیکون‌ها برای انتخابگرِ پنل */
export const ICON_LABELS: Record<string, string> = {
  QrCode: "کد QR", Smartphone: "گوشی", CreditCard: "کارت بانکی", BellRing: "زنگ", Calculator: "ماشین‌حساب", Users: "مشتریان",
  MessageSquareText: "پیامک", Palette: "رنگ و طرح", Store: "فروشگاه", Sparkles: "درخشش", Clock: "ساعت", ShieldCheck: "امنیت",
  Truck: "ارسال", Coffee: "قهوه", UtensilsCrossed: "رستوران", ChefHat: "آشپز", Printer: "چاپگر", Globe: "وب", Heart: "قلب",
  Star: "ستاره", Zap: "سرعت", BarChart3: "نمودار", Gift: "هدیه", Percent: "تخفیف",
};

export const FEATURE_ICONS = [
  "QrCode", "Smartphone", "CreditCard", "BellRing", "Calculator", "Users", "MessageSquareText", "Palette", "Store",
  "Sparkles", "Clock", "ShieldCheck", "Truck", "Coffee", "UtensilsCrossed", "ChefHat", "Printer", "Globe", "Heart",
  "Star", "Zap", "BarChart3", "Gift", "Percent",
] as const;

export const DEFAULT_CONTENT: SiteContent = {
  brand: {
    name: "منوی دیجیتال",
    logo: "",
    color: "red",
    seoTitle: "منوی دیجیتال کافه و رستوران | ساخت منوی QR آنلاین — {brand}",
    seoDescription: "ساخت منوی دیجیتال و منوی QR برای کافه، رستوران و فست‌فود با سفارش آنلاین سر میز، پرداخت و پنل مدیریت. بدون نصب برنامه؛ {trialDays} روز رایگان.",
    ogImage: "",
    googleVerification: "",
    poweredBy: true,
  },
  announce: { enabled: false, text: "🎉 جشنوارهٔ ویژه: ۲۰٪ تخفیف اشتراکِ سالانه", link: "/signup" },
  hero: {
    badge: "{trialDays} روز رایگان، بدونِ کارت بانکی",
    title: "منوی دیجیتال و سفارش‌گیری",
    highlight: "برای کسب‌وکارِ شما",
    subtitle: "منوی QR، سفارش آنلاین و پنل مدیریت برای کافه، رستوران و فست‌فود. آدرسِ اختصاصی می‌گیرید و همه‌چیز — از منو و قیمت تا رنگ و لوگو — مخصوصِ خودتان است.",
    ctaPrimary: "ساختِ منوی رایگان",
    ctaSecondary: "ورود به پنل",
    mockupName: "کافه رویا",
    demoSlug: "",
    demoLabel: "منوی نمونه را زنده ببینید",
  },
  trust: ["بدونِ نیاز به کارت بانکی", "راه‌اندازی در چند دقیقه", "بدونِ نصبِ برنامه برای مشتری"],
  showcase: {
    title: "همهٔ کارها در یک پنلِ ساده",
    text: "سفارش‌ها لحظه‌ای با صدای اعلان می‌رسند، پرداخت‌ها را تأیید می‌کنید و درآمدِ روز و ماه را می‌بینید — از گوشی یا لپ‌تاپ.",
    bullets: ["سفارش و درخواستِ گارسون به‌صورتِ زنده", "صندوق و تأییدِ پرداخت با یک لمس", "حسابداریِ روزانه و ماهانه با تقویمِ شمسی", "باشگاهِ مشتریان و پیامکِ گروهی"],
  },
  finalCta: { title: "منوی دیجیتالِ خودتان را همین امروز بسازید", text: "{trialDays} روزِ اول رایگان است. بدونِ قرارداد، هر وقت خواستید لغو کنید.", button: "شروعِ رایگان" },
  kinds: ["کافه و کافی‌شاپ", "رستوران", "فست‌فود", "بستنی و آبمیوه", "قنادی و شیرینی"],
  features: {
    title: "هر چیزی که برای سرویسِ سریع‌تر لازم دارید",
    subtitle: "بدونِ سخت‌افزار و نصبِ برنامه؛ فقط یک گوشی یا لپ‌تاپ برای پنلِ مدیریت.",
    autoplay: 3.5,
    items: [
      { icon: "QrCode", title: "منوی QR برای هر میز", text: "مشتری کدِ QR روی میز را اسکن می‌کند و منوی زیبا و سریع را روی گوشی می‌بیند؛ بدونِ نصبِ برنامه." },
      { icon: "Smartphone", title: "سفارش آنلاین سرِ میز", text: "سفارش مستقیم و لحظه‌ای روی پنلِ شما و آشپزخانه می‌نشیند؛ با صدای اعلان." },
      { icon: "CreditCard", title: "پرداخت قبل از آماده‌سازی", text: "کارت‌به‌کارت با فیش، کارت‌خوانِ سرِ میز یا درگاهِ اینترنتی — به انتخابِ شما." },
      { icon: "BellRing", title: "صدا زدنِ گارسون و صورتحساب", text: "درخواست‌ها با شمارهٔ میز روی پنل می‌آید؛ دیگر کسی منتظر نمی‌ماند." },
      { icon: "Calculator", title: "حسابداریِ روزانه و ماهانه", text: "درآمدِ امروز، ماه و پرفروش‌ترین‌ها با تقویمِ شمسی." },
      { icon: "Users", title: "باشگاهِ مشتریان", text: "شمارهٔ مشتری‌ها با تأییدِ پیامکی جمع می‌شود؛ خروجیِ اکسل." },
      { icon: "MessageSquareText", title: "پیامکِ گروهی", text: "تخفیف‌ها و جشنواره‌ها را برای مشتری‌های وفادار یا قدیمی بفرستید." },
      { icon: "Palette", title: "کاملاً شخصی‌سازی‌شده", text: "لوگو، رنگِ برند، بنرِ دسته‌ها، ویدیوی خوش‌آمد و آدرسِ اختصاصی برای هر مجموعه." },
    ],
  },
  views: {
    title: "منو، همان‌طور که مشتری دوست دارد",
    subtitle: "سه حالتِ نمایش در یک منو؛ مشتری با یک لمس بینِ آن‌ها جابه‌جا می‌شود و انتخابش برای دفعهٔ بعد هم یادش می‌ماند.",
    items: [
      { title: "کاروسلِ سه‌بعدی", text: "عکس‌های بزرگ و تمام‌قد که مثلِ ویترین می‌چرخند؛ بهترین حالت وقتی محصولاتتان خودشان را نشان می‌دهند." },
      { title: "شبکه‌ای", text: "کارت‌های عکس‌دار کنارِ هم با قیمت و توضیح؛ کلِ یک دسته را در یک نگاه مرور کنید." },
      { title: "لیستی", text: "فهرستِ جمع‌وجور با نام و قیمت؛ با لمسِ هر ردیف، عکس و توضیحش باز می‌شود. سریع برای منوهای بلند." },
    ],
    bullets: ["تمِ روشن و تیره", "نامِ مجموعه روی عکس‌ها", "بزرگ‌نماییِ عکس", "اشتراک‌گذاریِ هر محصول"],
  },
  steps: {
    title: "در سه قدم راه بیندازید",
    items: [
      { title: "ثبت‌نام", text: "نام و نوعِ کسب‌وکار و یک آدرس (مثل roya.{root}) انتخاب کنید." },
      { title: "شخصی‌سازی", text: "منو، قیمت‌ها، عکس‌ها، لوگو و روش‌های پرداخت را از پنل وارد کنید." },
      { title: "چاپِ QR", text: "کدهای QR میزها را از پنل چاپ کنید و روی میزها بگذارید. تمام!" },
    ],
  },
  pricing: {
    title: "تعرفهٔ اشتراک",
    subtitle: "همهٔ امکانات در همهٔ طرح‌ها · {trialDays} روزِ اول رایگان",
    bullets: ["منو و سفارشِ نامحدود", "پنلِ مدیریت و حسابداری", "آدرسِ اختصاصی + HTTPS", "پشتیبانی"],
    cta: "شروع رایگان",
  },
  faq: {
    title: "سؤالاتِ رایج",
    items: [
      { q: "دادهٔ ما از بقیه جداست؟", a: "بله. هر مجموعه دیتابیس و پوشهٔ عکسِ جدای خودش را دارد و مجموعه‌های دیگر به آن دسترسی ندارند. مدیریتِ {brand} برای پشتیبانی و نگه‌داریِ سامانه به اطلاعات دسترسی دارد." },
      { q: "بعد از تمام شدنِ اشتراک چه می‌شود؟", a: "منوی مشتری‌ها موقتاً غیرفعال می‌شود ولی هیچ داده‌ای پاک نمی‌شود؛ با تمدید، همه‌چیز همان‌طور برمی‌گردد." },
      { q: "دامنهٔ اختصاصیِ خودم را می‌توانم وصل کنم؟", a: "بله؛ با پشتیبانی هماهنگ کنید تا دامنهٔ شما (مثلاً menu.yourname.ir) به منو وصل شود." },
      { q: "برای شروع چه لازم است؟", a: "هیچ! ثبت‌نام کنید، منوی نمونه آماده است؛ فقط محصولات و قیمت‌های خودتان را جایگزین کنید." },
    ],
  },
  footer: { text: "{brand} — منوی دیجیتالِ کافه و رستوران", phone: "", email: "", address: "", instagram: "", telegram: "", whatsapp: "", floatButton: true, floatText: "سلام، دربارهٔ منوی دیجیتالِ {brand} سؤال دارم." },
  testimonials: { title: "مجموعه‌هایی که به ما اعتماد کرده‌اند", subtitle: "", items: [] },
  signup: { title: "ساختِ منوی دیجیتال", subtitle: "{trialDays} روزِ اول رایگان است؛ بدونِ نیاز به کارت بانکی.", button: "ساختِ منو", requireTerms: false },
  login: { title: "ورود به پنلِ مدیریت", subtitle: "آدرسِ منوی مجموعه‌تان را وارد کنید.", help: "آدرس یا رمز را فراموش کرده‌اید؟ با پشتیبانی تماس بگیرید." },
  legal: {
    terms: "## قوانین و شرایطِ استفاده\nبا ثبت‌نام در {brand}، این شرایط را می‌پذیرید.\n\n## اشتراک و پرداخت\nاشتراک برای مدتِ طرحِ انتخابی فعال است و پس از پایان باید تمدید شود. مبلغِ پرداخت‌شده قابلِ بازگشت نیست مگر در مواردِ نقصِ فنی از طرفِ ما.\n\n## مسئولیتِ محتوا\nمسئولیتِ درستیِ منو، قیمت‌ها و اطلاعاتِ واردشده با صاحبِ مجموعه است.",
    privacy: "## حریمِ خصوصی\nاطلاعاتِ هر مجموعه (منو، سفارش‌ها و شمارهٔ مشتری‌ها) جدا نگه‌داری می‌شود و مجموعه‌های دیگر به آن دسترسی ندارند. مدیریتِ {brand} برای پشتیبانی، نگه‌داری و گزارش‌گیری به این اطلاعات دسترسی دارد و آن را به شخصِ ثالث نمی‌دهد.\n\n## پیامک\nشمارهٔ موبایل برای تأییدِ هویت، اطلاع‌رسانیِ اشتراک و پیام‌های همان مجموعه استفاده می‌شود.",
  },
  unavailable: {
    missingTitle: "منویی با این آدرس پیدا نشد",
    missingText: "آدرس را دوباره بررسی کنید یا کدِ QR روی میز را اسکن کنید.",
    inactiveTitle: "منوی {name} موقتاً در دسترس نیست",
    inactiveText: "لطفاً سفارش‌تان را حضوری ثبت کنید. مدیرِ مجموعه می‌تواند از پنلِ مدیریت، اشتراک را تمدید کند.",
  },
};

/** ادغامِ محتوای ذخیره‌شده با پیش‌فرض‌ها (فیلدهای تازه در نسخه‌های بعد خالی نمانند) */
export function mergeContent(saved: Partial<SiteContent> | null | undefined): SiteContent {
  const s = (saved || {}) as Record<string, unknown>;
  const out = { ...DEFAULT_CONTENT } as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_CONTENT) as (keyof SiteContent)[]) {
    const d = DEFAULT_CONTENT[k], v = s[k];
    if (v === undefined || v === null) continue;
    out[k] = Array.isArray(d) ? (Array.isArray(v) ? v : d) : typeof d === "object" ? { ...(d as object), ...(v as object) } : v;
  }
  return out as unknown as SiteContent;
}

/** جایگذاریِ {brand} {trialDays} {root} {name} */
export function fill(text: string, vars: Record<string, string | number>): string {
  return String(text || "")
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    // کسره‌ای که به حرفِ انگلیسی چسبیده (مثل «QRِ») در متنِ راست‌به‌چپ تنها و بی‌جا دیده می‌شود
    .replace(/([A-Za-z])\u0650/g, "$1");
}

export const colorHsl = (id: string) => (BRAND_COLORS.find((c) => c.id === id) || BRAND_COLORS[0]).hsl;

/** جایگذاریِ متغیرها در همهٔ متن‌های محتوا (به‌جز متنِ قوانین که خام نمایش داده می‌شود هم پر می‌شود) */
export function fillDeep<T>(v: T, vars: Record<string, string | number>): T {
  if (typeof v === "string") return fill(v, vars) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, vars)) as unknown as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, vars)])) as T;
  return v;
}
