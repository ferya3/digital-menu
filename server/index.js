'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const auth = require('./auth');
const store = require('./store');
const settings = require('./settings');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.disable('x-powered-by');
app.set('trust proxy', 1); // پشت پراکسی هاست (HTTPS) برای تشخیص درست پروتکل و IP

// هدرهای امنیتی پایه
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '6mb' })); // limit بالاتر برای آپلود عکس محصول (base64)

// ورود/خروج مدیر (عمومی)
app.use('/api/auth', require('./routes/auth')());

// محافظت از صفحات مدیریتی: بدون ورود → هدایت به صفحه‌ی ورود
const PROTECTED_PAGES = new Set(['/staff', '/requests', '/manager', '/cashier', '/manage', '/admin', '/customers', '/qr', '/print']);
app.use((req, res, next) => {
  if (req.method === 'GET') {
    const p = req.path.replace(/\.html$/, '');
    if (PROTECTED_PAGES.has(p) && !auth.isAuthed(req)) return res.redirect('/login');
  }
  next();
});

// extensions: مسیرها بدون پسوند .html هم کار کنند
// صفحه‌ی اشتراک محصول: تگ‌های Open Graph/Twitter را تزریق می‌کند تا لینکِ به‌اشتراک‌گذاشته‌شده
// پیش‌نمایش کامل (عکس + نام + قیمت) نشان دهد. کراولرها جاوااسکریپت اجرا نمی‌کنند، پس باید سمت سرور باشد.
app.get('/product', (req, res, next) => {
  try {
    const item = store.getItem((req.query.id || '').toString());
    const file = path.join(__dirname, '..', 'public', 'product.html');
    let html = fs.readFileSync(file, 'utf8');
    const s = settings.get();
    const cafe = (s.cafe && s.cafe.name) || 'کافه';
    const cur = (s.currency && typeof s.currency === 'object') ? s.currency : { symbol: 'تومان', position: 'after' };
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let meta;
    if (item) {
      const n = Number(item.price).toLocaleString('en-US');
      const priceStr = cur.position === 'after' ? n + ' ' + cur.symbol : cur.symbol + n;
      const title = `${item.name} — ${priceStr} | ${cafe}`;
      const desc = item.description || `${item.name} · ${cafe}`;
      const origin = `${req.protocol}://${req.get('host')}`;
      const img = item.image ? (/^https?:/.test(item.image) ? item.image : origin + item.image) : '';
      const url = origin + '/product?id=' + encodeURIComponent(item.id);
      meta = [
        `<title>${esc(title)}</title>`,
        `<meta name="description" content="${esc(desc)}" />`,
        `<meta property="og:type" content="product" />`,
        `<meta property="og:site_name" content="${esc(cafe)}" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:description" content="${esc(desc)}" />`,
        `<meta property="og:url" content="${esc(url)}" />`,
        img ? `<meta property="og:image" content="${esc(img)}" />` : '',
        `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}" />`,
        img ? `<meta name="twitter:image" content="${esc(img)}" />` : '',
        `<meta name="twitter:title" content="${esc(title)}" />`,
        `<meta name="twitter:description" content="${esc(desc)}" />`,
      ].filter(Boolean).join('\n  ');
    } else {
      meta = `<title>${esc(cafe)}</title>`;
    }
    html = html.replace(/<title>[\s\S]*?<\/title>/, meta);
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) { next(); }
});

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// ---- API ----
app.use('/api/menu', require('./routes/menu')(io));
app.use('/api/orders', require('./routes/orders')(io));
app.use('/api/requests', require('./routes/requests')(io));
app.use('/api/feedback', require('./routes/feedback')(io));
app.use('/api/settings', require('./routes/settings')());
app.use('/api/customers', require('./routes/customers')());
app.use('/api/otp', require('./routes/otp')());

// تولید QR کد برای هر میز (لینک منو + شماره میز)
app.get('/api/qr', async (req, res) => {
  const table = (req.query.table || '1').toString();
  const base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}/?table=${encodeURIComponent(table)}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 320, margin: 1 });
    res.type('png').send(png);
  } catch (err) {
    res.status(500).json({ error: 'خطا در تولید QR' });
  }
});

// ---- Socket.IO: اتاق‌ها ----
io.on('connection', (socket) => {
  // داشبورد کارکنان فقط با ورود معتبر می‌تواند به اتاق staff بپیوندد (محرمانگی سفارش‌ها/مشتری‌ها)
  socket.on('join:staff', () => {
    if (auth.isAuthed({ headers: { cookie: socket.handshake.headers.cookie } })) socket.join('staff');
  });
  // مشتری به اتاق میز خودش می‌پیوندد تا وضعیت سفارش را لحظه‌ای ببیند
  socket.on('join:table', (table) => {
    if (table) socket.join(`table:${String(table)}`);
  });
});

const PORT = process.env.PORT || 3000;

// باز کردن خودکار مرورگر هنگام اجرا (برای راحتی کاربر). با NO_OPEN=1 غیرفعال می‌شود.
function openBrowser(url) {
  if (process.env.NO_OPEN === '1' || process.env.NODE_ENV === 'production') return;
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  try { exec(cmd, () => {}); } catch (e) { /* بی‌اهمیت */ }
}

// اگر پورت اشغال باشد (مثلاً برنامه از قبل در حال اجراست) به‌جای خطای ترسناک،
// پیام دوستانه نشان بده و مرورگر را روی همان نسخه‌ی در حال اجرا باز کن.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️  پورت ${PORT} از قبل در حال استفاده است.`);
    console.log(`    به نظر می‌رسد «کافه» از قبل در حال اجراست — همان را در مرورگر باز می‌کنم.`);
    console.log(`    The app is already running. Opening it in your browser...\n`);
    openBrowser(`http://localhost:${PORT}/?table=1`);
    setTimeout(() => process.exit(0), 1500);
  } else {
    console.error('خطای سرور:', err.message);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`☕ منوی دیجیتال کافه روی http://localhost:${PORT} اجرا شد`);
  console.log(`   منوی مشتری:    http://localhost:${PORT}/?table=1`);
  console.log(`   ورود مدیر:     http://localhost:${PORT}/login  →  داشبورد: /manager`);
  if (auth.usingDefaultPassword()) {
    console.log('   ⚠️  رمز عبور مدیر روی پیش‌فرض «cafe1234» است.');
    console.log('       برای امنیت، متغیر محیطی ADMIN_PASSWORD را تنظیم کنید یا از پنل تنظیمات تغییر دهید.');
  }
  openBrowser(`http://localhost:${PORT}/?table=1`);
});

