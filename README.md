# MenuPilot — Digital QR Menu & Table Ordering SaaS

A complete, self-hosted **digital menu platform** for cafés, restaurants, fast-food places, bakeries and juice bars.
Run it for **one venue** (single-restaurant mode) or as a **multi-tenant SaaS** where every venue signs up, gets its own
subdomain (`bella.yourdomain.com`), its own menu, staff dashboard and data — and pays you a subscription.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Node.js 22 built-in SQLite (`node:sqlite`) ·
sharp · Framer Motion · GSAP · Lenis · Three.js (React Three Fiber) · Stripe Checkout · Twilio SMS.
No external database server, no Redis, no paid services required to run.

Full documentation: open **`documentation/index.html`** in your browser.

---

## Features

### For guests (the menu)
- QR code per table — scanning opens the menu with the table number; no app install (iOS & Android).
- Three display modes the guest can switch between: **3D carousel**, **grid** and **list** (remembered per device).
- Photos, descriptions, tags (Bestseller, New…), discounts with a strike-through price, sold-out items blocked from ordering.
- **Order at the table** with notes, live order status, **call the waiter** and **request the bill**.
- Payments: **card online with Stripe**, **bank transfer with receipt upload**, or **card reader at the table**;
  optional *pay before preparation* (orders reach the kitchen after payment).
- Optional phone verification by SMS code (Twilio) — builds the venue's customer club.
- Light/dark theme, welcome splash with a 3D scene or the venue's own video, product share pages, SEO (JSON-LD menu).

### For venues (staff dashboard `/staff`)
- Live orders with sound and tab-title alerts; kitchen flow *New → Preparing → Ready → Served*; printable invoices.
- Requests (waiter / bill / card reader), cashier view by table, receipt approval with duplicate-receipt warning.
- Menu manager: categories with emoji/icon and full-width promo banners, items with photos, quick price edits.
- **Accounting:** today / yesterday / this month / last month, 30-day chart, monthly reports with CSV export,
  revenue by payment method, best sellers, open bills — in the venue's own time zone.
- **Customers & bulk SMS** (Twilio): segments (all, loyal, recent, inactive…), opt-out list, test send, live progress.
- Settings: logo, hero video, address/map/Instagram, currency (any ISO code), time zone, payment methods, Stripe key,
  Twilio, password. Printable QR codes for tables.
- Subscription page (SaaS mode): pay online with Stripe or by bank transfer, coupons.

### For you (platform owner, SaaS mode)
- Marketing website with editable content: hero, feature carousel (with photos), display-modes demo, pricing carousel,
  testimonials, FAQ, footer, legal pages, announcement bar — all from the admin panel, no code.
- **SEO built in:** topic landing pages, blog with an editor, city landing pages, sitemap, robots, Open Graph image,
  JSON-LD (Organization, SoftwareApplication, FAQ, BlogPosting, Breadcrumbs), Google Search Console verification and a
  Google result preview.
- **Live demo menu** for visitors (with a QR code on desktop), floating WhatsApp/call button.
- **Super-admin panel `/admin`:** dashboard (revenue, MRR, signups, expiring subscriptions), venues (create, edit,
  extend, suspend, enter their dashboard, custom domains), all customers, payments & receipts, coupons,
  **partner/referral program** with commissions and a private report page per partner, notifications (announcement
  banner, automatic renewal SMS, bulk SMS to owners), audit log, settings (plans, currency, Stripe, bank transfer, Twilio).
- Automatic HTTPS for every subdomain and custom domain (Let's Encrypt).

### Security
scrypt password hashing, signed httpOnly cookies, per-IP rate limits and login lock-out stored on disk, strict CSP with
per-request nonces, HSTS, AES-256-GCM encryption at rest for secrets (Stripe/Twilio keys, signing keys), payments are
always verified server-to-server with Stripe, uploads re-encoded with sharp, encrypted backups.

---

## Requirements
- A clean **Ubuntu 22.04 / 24.04** server (1 GB RAM minimum, 2 GB recommended) with root/sudo access.
- For SaaS mode: a domain with three DNS **A records** pointing to the server: `@`, `www` and `*` (wildcard).
- Optional: a Stripe account (online payments) and a Twilio account (SMS).

The installer sets up everything else (Node.js 22, Nginx, ffmpeg, pm2, Certbot, swap).

## Installation
See `documentation/index.html` → *Installation* for the full guide (SaaS mode and single-restaurant mode).

## Development
```bash
npm install
npm run dev        # http://localhost:3000 (single-restaurant mode)
npm run typecheck
npm run build && npm start
```
For SaaS mode locally, set `ROOT_DOMAIN=localhost` in `.env.local` and open `http://localhost:3000` (platform) and
`http://<venue>.localhost:3000` (venues).

## Credits
Font: Inter (SIL Open Font License). Icons: Lucide (ISC). All bundled libraries are open source (MIT/Apache/ISC/BSD);
see `package.json`. No stock photos are bundled — the sample menus use emoji and gradients.
