# کافه آرتاویل — نسخهٔ Next.js

بازنویسی کامل سایت با استک مدرن:
**Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion**
(کامپوننت‌ها به سبک shadcn/ui با class-variance-authority، clsx، tailwind-merge و radix-slot · آیکون‌ها lucide-react · فونت Vazirmatn از `@fontsource-variable/vazirmatn`).

## اجرا روی سیستم خودت

نیاز: **Node.js 22** (برای `node:sqlite` در فازهای بعد).

```bash
npm install
npm run dev     # http://localhost:3000
```

خروجی production:
```bash
npm run build && npm start
```

بررسی نوع‌ها: `npm run typecheck`

## چیزی که در این فاز ساخته شده (فاز ۱ — پایه و صفحهٔ منو)

- پیکربندی کامل Next.js 15 + React 19 + Tailwind 4 (تم با متغیرهای HSL، دارک‌مود کلاس‌مبنا).
- کامپوننت‌های پایهٔ shadcn (`Button`, `Card`) با cva + radix-slot.
- فونت **Vazirmatn** به‌صورت محلی (بدون وابستگی به CDN — در ایران هم بدون فیلترشکن کار می‌کند).
- **صفحهٔ منوی مشتری** با انیمیشن‌های Framer Motion: هیرو، ورودِ پلکانی کارت‌ها، هاوورِ کارت، نوار و کشوی سبد خرید با `AnimatePresence`.
- دسته‌بندی‌ها، قیمت‌گذاری با تخفیف، اعداد فارسی، چیدمان کاملاً RTL، ریسپانسیو.

## فاز ۲ — بک‌اند (✅ انجام شد)

- **دیتابیس `node:sqlite`** (داخلی Node، بدون پکیج جداگانه): جدول‌های منو، سفارش، درخواست، نظر، مشتری و تنظیمات؛ خودش در اولین اجرا ساخته و با منوی نمونه پر می‌شود (`data/cafe.db`).
- **Server Actions** برای همهٔ کارهای مشتری: ثبت سفارش (قیمت‌ها سمت سرور محاسبه می‌شود)، صورتحساب = **جمعِ همهٔ سفارش‌های پرداخت‌نشدهٔ میز**، آپلود رسید، درخواست گارسون/فاکتور، ثبت نظر.
- **پردازش عکس با `sharp`**: رسیدِ آپلودی به **WebP** تبدیل و مهرِ ضدجعل روی آن حک می‌شود.
- **رمزنگاری با `crypto`**: هش رمز با **scrypt** و نشستِ امضاشده با HMAC (آمادهٔ پنل مدیریت).
- وضعیت سفارشِ زنده (polling)، اطلاعات پرداخت روی صورتحساب، چیدمان RTL.
- `/?table=۵` شمارهٔ میز را از URL می‌گیرد (مثل QR هر میز).

## فاز ۳ — پنل مدیریت (✅ انجام شد)

مسیر `/staff` (رمز پیش‌فرض `cafe1234`):
- **ورود** با نشستِ امضاشده (crypto/HMAC) و رمزِ scrypt.
- **سفارش‌ها + صندوق**: کنترل وضعیت آشپزخانه، دیدن فیش، تأیید/رد پرداخت (رد، عکس فیش را حذف می‌کند).
- **درخواست‌ها** (گارسون/فاکتور با مبلغ)، **نظرسنجی** (با میانگین)، **مشتری‌ها** (+ خروجی CSV).
- **مدیریت منو**: افزودن/ویرایش/حذف محصول و دسته، آپلود عکس (sharp→WebP)، و تولید **QR** میزها.
- **تنظیمات**: برندینگ کافه، واحد پول، اطلاعات پرداخت، تغییر رمز.
- به‌روزرسانیِ زنده با polling؛ همه چیز روی **Server Actions + node:sqlite**.

## فاز ۴ — جلوه‌های ویژه (✅ انجام شد)

- **Three.js + React Three Fiber + Drei**: صحنهٔ سه‌بعدی در هیرو (حلقه، قطره و دانه‌های قهوهٔ شناور + ذرات، با پارالاکسِ موس). روی دسکتاپ کنار متن و روی موبایل بالای متن. جدا (lazy) لود می‌شود تا صفحه سریع باز شود.
- **ویدیوی هیرو (اختیاری)**: از پنل ← تنظیمات ← «ویدیوی صفحهٔ اول» یک MP4/WebM (تا ۱۰۰ مگابایت) آپلود کنید تا به‌جای صحنهٔ سه‌بعدی پخش شود؛ با حذفش صحنهٔ سه‌بعدی برمی‌گردد.
- **GSAP**: پنلِ «منتخب باریستا» (با دکمهٔ هیرو باز می‌شود و همان‌جا می‌شود به سبد اضافه کرد) با ورودِ پلکانیِ کارت‌ها.
- **Lenis**: اسکرولِ نرم در کل صفحه (هماهنگ با GSAP).
- **Zustand**: وضعیتِ منوی موبایل (دکمهٔ همبرگری + کشوی کناری).
- ترتیب صفحه: نام کافه ← هیرو (سه‌بعدی یا ویدیو) ← منو و سفارش.

## فاز ۵ — نصب روی سرور (✅ انجام شد)

روی **اوبونتو ۲۴** با root، یک خط (بدون دامنه، روی IP سرور):

```bash
sudo apt-get update && sudo apt-get install -y git && sudo rm -rf /opt/cafe-next && sudo git clone -b nextjs https://github.com/ferya3/digital-menu.git /opt/cafe-next && cd /opt/cafe-next && sudo ADMIN_PASSWORD='رمز-دلخواه' bash install.sh
```

با دامنه و SSL، فقط `DOMAIN` و `EMAIL` اضافه می‌شود:

```bash
sudo apt-get update && sudo apt-get install -y git && sudo rm -rf /opt/cafe-next && sudo git clone -b nextjs https://github.com/ferya3/digital-menu.git /opt/cafe-next && cd /opt/cafe-next && sudo DOMAIN=example.com EMAIL=you@mail.com ADMIN_PASSWORD='رمز-دلخواه' bash install.sh
```

اسکریپت: Node 22 نصب می‌کند، روی سرورِ کم‌رم swap می‌سازد، build می‌گیرد، برنامه را با **pm2** دائمی اجرا می‌کند
(بعد از ری‌بوت هم خودکار بالا می‌آید)، Nginx را جلویش می‌گذارد، در صورت دادنِ دامنه SSL می‌گیرد،
و سرویسِ نسخهٔ قبلی (`cafe` در systemd) را غیرفعال می‌کند.

- به‌روزرسانی (با بک‌آپِ خودکار از دیتابیس و عکس‌ها در `/root/cafe-backups`):  `cd /opt/cafe-next && sudo bash update.sh`
- وضعیت و لاگ:  `pm2 status` · `pm2 logs cafe`
- داده‌ها: دیتابیس در `data/cafe.db` و عکس‌ها در `data/uploads` (وارد گیت نمی‌شوند؛ برای بک‌آپ همین پوشهٔ `data/` کافی است).

## نقشهٔ راه (فازهای بعد)

- **فاز ۲ — بک‌اند**: ✅ انجام شد (`node:sqlite` + Server Actions + scrypt + sharp→WebP).
- **فاز ۳ — پنل مدیریت**: ✅ انجام شد (`/staff`).
- **فاز ۴ — تجربهٔ ویژه** (✅ انجام شد): انیمیشن‌ها با **GSAP + ScrollTrigger**، اسکرول نرم با **Lenis**، صحنهٔ سه‌بعدی با **Three.js + React Three Fiber + Drei**، منوی موبایل با **Zustand**.
- **فاز ۵ — استقرار** (✅ انجام شد): اجرای دائمی با **pm2** روی سرور اوبونتو + Nginx + SSL.

## استک کامل
`next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`,
`lucide-react`, `@fontsource-variable/vazirmatn`, `framer-motion`, `zustand`.
(GSAP, Lenis, Three.js/R3F/Drei و sharp در فازهای مربوطه اضافه می‌شوند.)
