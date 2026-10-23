/**
 * Editable content of the platform website (home page, sign-up, login, footer, legal pages, system messages).
 * Edited from the super-admin panel → "Site content". Texts may use {brand}, {trialDays} and {root}.
 */
/**
 * Feature card; hidden = temporarily not shown on the site.
 * image: card image (carousel: covers the whole card, 9:10 ratio; large card: replaces the QR artwork, 16:10 ratio)
 */
export interface FeatureItem { icon: string; title: string; text: string; hidden?: boolean; image?: string }
/** A testimonial from a customer venue */
export interface Testimonial { name: string; person: string; role: string; city: string; text: string; logo: string }
export interface SiteContent {
  /** poweredBy: small "Digital menu by …" link at the bottom of venue menus (backlink to the site) */
  brand: { name: string; logo: string; color: string; seoTitle: string; seoDescription: string; ogImage: string; googleVerification: string; poweredBy: boolean };
  announce: { enabled: boolean; text: string; link: string };
  /** demoSlug: subdomain of the live demo menu (empty = no demo button) */
  hero: { badge: string; title: string; highlight: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; mockupName: string; demoSlug: string; demoLabel: string };
  /** Short check-marked points under the hero buttons */
  trust: string[];
  /** Admin panel showcase section (dark background) */
  showcase: { title: string; text: string; bullets: string[] };
  /** Final call to action at the bottom of the page */
  finalCta: { title: string; text: string; button: string };
  kinds: string[];
  /** First visible card = large top card, the rest = carousel; autoplay = seconds per slide (0 = off) */
  features: { title: string; subtitle: string; items: FeatureItem[]; autoplay: number };
  /** Menu display modes; items in order: carousel, grid, list */
  views: { title: string; subtitle: string; items: { title: string; text: string }[]; bullets: string[] };
  steps: { title: string; items: { title: string; text: string }[] };
  pricing: { title: string; subtitle: string; bullets: string[]; cta: string };
  faq: { title: string; items: { q: string; a: string }[] };
  /** floatButton: floating WhatsApp/call button; floatText: prefilled WhatsApp message */
  footer: { text: string; phone: string; email: string; address: string; instagram: string; telegram: string; whatsapp: string; floatButton: boolean; floatText: string };
  /** Customer testimonials (empty = section hidden; only add real testimonials) */
  testimonials: { title: string; subtitle: string; items: Testimonial[] };
  signup: { title: string; subtitle: string; button: string; requireTerms: boolean };
  login: { title: string; subtitle: string; help: string };
  legal: { terms: string; privacy: string };
  unavailable: { missingTitle: string; missingText: string; inactiveTitle: string; inactiveText: string };
}

/** Preset primary colors for the site (HSL for the --primary variable) */
export const BRAND_COLORS: { id: string; label: string; hsl: string; hex: string }[] = [
  { id: "red", label: "Red", hsl: "356 72% 48%", hex: "#d4212f" },
  { id: "orange", label: "Orange", hsl: "24 90% 48%", hex: "#e8650c" },
  { id: "amber", label: "Amber", hsl: "36 92% 42%", hex: "#cf8509" },
  { id: "green", label: "Green", hsl: "152 62% 34%", hex: "#218c5c" },
  { id: "teal", label: "Teal", hsl: "176 70% 32%", hex: "#188a83" },
  { id: "blue", label: "Blue", hsl: "217 80% 50%", hex: "#1966e6" },
  { id: "indigo", label: "Indigo", hsl: "239 65% 55%", hex: "#4a4dd8" },
  { id: "purple", label: "Purple", hsl: "270 62% 52%", hex: "#8336d6" },
  { id: "pink", label: "Pink", hsl: "332 74% 50%", hex: "#dd217a" },
  { id: "slate", label: "Charcoal", hsl: "220 18% 26%", hex: "#36404f" },
];

/** Allowed icons for feature cards (lucide icon names) */
/** Human-readable icon names for the panel picker */
export const ICON_LABELS: Record<string, string> = {
  QrCode: "QR code", Smartphone: "Phone", CreditCard: "Card", BellRing: "Bell", Calculator: "Calculator", Users: "Customers",
  MessageSquareText: "SMS", Palette: "Palette", Store: "Store", Sparkles: "Sparkles", Clock: "Clock", ShieldCheck: "Security",
  Truck: "Delivery", Coffee: "Coffee", UtensilsCrossed: "Restaurant", ChefHat: "Chef", Printer: "Printer", Globe: "Web", Heart: "Heart",
  Star: "Star", Zap: "Speed", BarChart3: "Chart", Gift: "Gift", Percent: "Discount",
};

export const FEATURE_ICONS = [
  "QrCode", "Smartphone", "CreditCard", "BellRing", "Calculator", "Users", "MessageSquareText", "Palette", "Store",
  "Sparkles", "Clock", "ShieldCheck", "Truck", "Coffee", "UtensilsCrossed", "ChefHat", "Printer", "Globe", "Heart",
  "Star", "Zap", "BarChart3", "Gift", "Percent",
] as const;

export const DEFAULT_CONTENT: SiteContent = {
  brand: {
    name: "MenuPilot",
    logo: "",
    color: "red",
    seoTitle: "Digital QR Code Menu for Restaurants & Cafés | {brand}",
    seoDescription: "Create a digital QR code menu for your café, restaurant or fast food venue. Table ordering, payments and an easy admin panel. No app needed. Free for {trialDays} days.",
    ogImage: "",
    googleVerification: "",
    poweredBy: true,
  },
  announce: { enabled: false, text: "🎉 Limited-time offer: 20% off annual plans", link: "/signup" },
  hero: {
    badge: "{trialDays}-day free trial, no credit card required",
    title: "Digital menus and table ordering",
    highlight: "built for your venue",
    subtitle: "QR code menus, ordering at the table and a simple admin panel for cafés, restaurants and fast food. Get your own menu address and make everything yours, from items and prices to colors and logo.",
    ctaPrimary: "Create your free menu",
    ctaSecondary: "Log in",
    mockupName: "Bella Café",
    demoSlug: "",
    demoLabel: "Try the live demo menu",
  },
  trust: ["No credit card required", "Set up in minutes", "No app for guests to install"],
  showcase: {
    title: "Run everything from one simple panel",
    text: "Orders arrive in real time with a sound alert. Confirm payments in a tap and see today's and this month's revenue from your phone or laptop.",
    bullets: ["Live orders and waiter calls", "Checkout and one-tap payment confirmation", "Daily and monthly accounting", "Customer club and bulk SMS"],
  },
  finalCta: { title: "Launch your digital menu today", text: "Your first {trialDays} days are free. No contract, cancel anytime.", button: "Start for free" },
  kinds: ["Cafés & coffee shops", "Restaurants", "Fast food", "Bakeries & desserts", "Juice & ice cream bars"],
  features: {
    title: "Everything you need for faster service",
    subtitle: "No special hardware and no apps to install. All you need is a phone or laptop for the admin panel.",
    autoplay: 3.5,
    items: [
      { icon: "QrCode", title: "A QR menu for every table", text: "Guests scan the QR code on the table and get a fast, beautiful menu on their phone. Nothing to install." },
      { icon: "Smartphone", title: "Order from the table", text: "Orders go straight to your panel and kitchen in real time, with a sound alert." },
      { icon: "CreditCard", title: "Pay before preparation", text: "Card payments with Stripe, bank transfer with receipt, or a card reader at the table. You choose." },
      { icon: "BellRing", title: "Call a waiter or request the bill", text: "Requests show up on your panel with the table number, so no guest is left waiting." },
      { icon: "Calculator", title: "Daily and monthly accounting", text: "See today's revenue, this month's totals and your best-selling items at a glance." },
      { icon: "Users", title: "Customer club", text: "Collect guest phone numbers with SMS verification and export them to Excel." },
      { icon: "MessageSquareText", title: "Bulk SMS via Twilio", text: "Send offers and event news to your loyal or lapsed customers in a few clicks." },
      { icon: "Palette", title: "Fully branded", text: "Your logo, brand color, category banners, welcome video and your own menu address." },
    ],
  },
  views: {
    title: "A menu that adapts to every guest",
    subtitle: "Three display modes in one menu. Guests switch with a single tap, and their choice is remembered for next time.",
    items: [
      { title: "3D carousel", text: "Large, full-height photos that rotate like a shop window. Perfect when your dishes sell themselves." },
      { title: "Grid", text: "Photo cards side by side with prices and descriptions. Browse a whole category at a glance." },
      { title: "List", text: "A compact list of names and prices. Tap any row to reveal its photo and description. Ideal for long menus." },
    ],
    bullets: ["Light and dark themes", "Your venue name on photos", "Photo zoom", "Share any item"],
  },
  steps: {
    title: "Up and running in three steps",
    items: [
      { title: "Sign up", text: "Choose your venue name, business type and a menu address (like bella.{root})." },
      { title: "Customize", text: "Add your menu items, prices, photos, logo and payment methods from the panel." },
      { title: "Print your QR codes", text: "Print a QR code for each table from the panel and place them on your tables. Done!" },
    ],
  },
  pricing: {
    title: "Simple, transparent pricing",
    subtitle: "Every feature on every plan · First {trialDays} days free",
    bullets: ["Unlimited menu items and orders", "Admin panel and accounting", "Your own menu address + HTTPS", "Friendly support"],
    cta: "Start for free",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { q: "Is our data kept separate from other venues?", a: "Yes. Each venue has its own database and image folder, and no other venue can access them. The {brand} team can access your data only to provide support and maintain the service." },
      { q: "What happens when my subscription ends?", a: "Your guest menu is paused, but nothing is deleted. As soon as you renew, everything comes back exactly as you left it." },
      { q: "Can I use my own domain?", a: "Yes. Contact support and we'll connect your domain (for example menu.yourcafe.com) to your menu." },
      { q: "What do I need to get started?", a: "Nothing! Sign up and a sample menu is ready for you. Just replace it with your own items and prices." },
    ],
  },
  footer: { text: "{brand}: digital menus for cafés and restaurants", phone: "", email: "", address: "", instagram: "", telegram: "", whatsapp: "", floatButton: true, floatText: "Hi, I have a question about {brand} digital menus." },
  testimonials: { title: "Trusted by venues like yours", subtitle: "", items: [] },
  signup: { title: "Create your digital menu", subtitle: "Your first {trialDays} days are free. No credit card required.", button: "Create my menu", requireTerms: false },
  login: { title: "Log in to your admin panel", subtitle: "Enter your venue's menu address.", help: "Forgot your address or password? Contact support." },
  legal: {
    terms: "## Terms of Service\nThis is a template. The operator of this service must review and adapt it to their business and local law before publishing.\n\nBy creating an account with {brand}, you agree to these terms.\n\n## Your account\nYou are responsible for keeping your login details secure and for all activity under your account. You must provide accurate information when you sign up.\n\n## Subscription and payment\n- Your subscription is active for the period of the plan you choose and must be renewed when it ends.\n- The free trial lasts {trialDays} days and does not require payment details.\n- Fees already paid are non-refundable, except where the service was unavailable due to a technical fault on our side or where required by law.\n- We may change our prices with reasonable notice; changes apply from your next renewal.\n\n## Your content\nYou own the content you add (menus, prices, photos, logos). You are responsible for making sure it is accurate, lawful and that you have the rights to use it, including allergen and pricing information shown to your guests.\n\n## Acceptable use\nYou may not use {brand} for unlawful purposes, to send unsolicited messages, or in any way that harms the service or other users.\n\n## Availability\nWe work hard to keep the service running, but we do not guarantee uninterrupted availability. We are not liable for indirect losses, such as lost profits, arising from your use of the service.\n\n## Ending your account\nYou can stop using the service at any time. We may suspend accounts that break these terms.\n\n## Changes\nWe may update these terms from time to time. If the changes are significant, we will let you know.",
    privacy: "## Privacy Policy\nThis is a template. The operator of this service must review and adapt it to their business and applicable privacy laws (such as GDPR or CCPA) before publishing.\n\n## What we collect\n- Account details for venue owners and staff (name, email, phone number).\n- Menu content, orders and payment records created in your venue.\n- Phone numbers of guests who join a venue's customer club.\n- Basic technical data (such as browser type and IP address) to keep the service secure and working.\n\n## How we use it\nWe use this information to provide and improve the service, process payments, send account and subscription notices, and provide support.\n\n## Data separation\nEach venue's data (menu, orders and customer phone numbers) is stored separately, and other venues cannot access it. The {brand} team can access it only for support, maintenance and reporting, and we do not sell it to third parties.\n\n## Payments\nCard payments are processed by Stripe. We do not store full card numbers on our servers.\n\n## SMS\nPhone numbers are used for verification, subscription notices, and messages from the venue the guest signed up with. SMS messages are delivered through Twilio. Guests can ask the venue to remove their number at any time.\n\n## Your rights\nYou can request access to, correction of, or deletion of your personal data by contacting us.\n\n## Changes\nWe may update this policy from time to time. The latest version is always available on this page.",
  },
  unavailable: {
    missingTitle: "We couldn't find a menu at this address",
    missingText: "Please check the address or scan the QR code on your table.",
    inactiveTitle: "{name}'s menu is temporarily unavailable",
    inactiveText: "Please place your order with our staff. The venue manager can renew the subscription from the admin panel.",
  },
};

/** Merge saved content with defaults (so fields added in later versions are never empty) */
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

/** Substitute {brand} {trialDays} {root} {name} */
export function fill(text: string, vars: Record<string, string | number>): string {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export const colorHsl = (id: string) => (BRAND_COLORS.find((c) => c.id === id) || BRAND_COLORS[0]).hsl;

/** Substitute variables in every string of the content (legal texts, which are rendered raw, are filled too) */
export function fillDeep<T>(v: T, vars: Record<string, string | number>): T {
  if (typeof v === "string") return fill(v, vars) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, vars)) as unknown as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, vars)])) as T;
  return v;
}
