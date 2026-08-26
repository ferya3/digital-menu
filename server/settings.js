'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'settings.json');

// تنظیمات پیش‌فرض. درگاه‌های پرداخت پشتیبانی‌شده: زرین‌پال، بانک ملت، بانک ملی.
const DEFAULTS = {
  cafe: { name: 'کافه نمونه', logo: '☕', tagline: '', cover: '', address: '', mapUrl: '', instagram: '' },
  currency: 'toman', // 'toman' یا 'rial' — قیمت‌ها همیشه بر پایه‌ی تومان ذخیره می‌شوند
  orderCode: 'number', // 'number' = فقط عدد ترتیبی، 'id' = کد کامل
  auth: { password: '' }, // رمز عبور مدیر (اگر متغیر محیطی ADMIN_PASSWORD نباشد)
  // اطلاعات پرداخت که به مشتری نشان داده می‌شود (لینک پرداخت یا کارت به کارت)
  payment: { link: '', card: '', holder: '', note: '' },
  // سامانه‌ی پیامک برای کد تأیید (provider: 'none' یا 'kavenegar')
  sms: { provider: 'none', apiKey: '', sender: '', template: 'verify' },
  payments: [
    {
      id: 'zarinpal',
      name: 'زرین‌پال',
      enabled: false,
      config: { merchantId: '' },
    },
    {
      id: 'mellat',
      name: 'بانک ملت (به‌پرداخت ملت)',
      enabled: false,
      config: { terminalId: '', username: '', password: '' },
    },
    {
      id: 'melli',
      name: 'بانک ملی (سداد)',
      enabled: false,
      config: { merchantId: '', terminalId: '', key: '' },
    },
  ],
};

const clone = (o) => JSON.parse(JSON.stringify(o));
let settings = clone(DEFAULTS);

function load() {
  try {
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    settings = Object.assign(clone(DEFAULTS), onDisk);
  } catch (err) {
    settings = clone(DEFAULTS);
    save(); // اولین بار: فایل را با مقادیر پیش‌فرض بساز
  }
  return settings;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('خطا در ذخیره‌ی تنظیمات:', err.message);
  }
}

function get() {
  return settings;
}

function update(patch) {
  if (patch && typeof patch === 'object') {
    if (patch.cafe) settings.cafe = Object.assign({}, settings.cafe, patch.cafe);
    if (patch.payment) settings.payment = Object.assign({}, settings.payment, patch.payment);
    if (patch.sms) settings.sms = Object.assign({}, settings.sms, patch.sms);
    if (patch.currency === 'toman' || patch.currency === 'rial') settings.currency = patch.currency;
    if (patch.orderCode === 'number' || patch.orderCode === 'id') settings.orderCode = patch.orderCode;
    // رمز عبور فقط در صورت ارسال مقدار غیرخالی به‌روزرسانی می‌شود
    if (patch.auth && typeof patch.auth.password === 'string' && patch.auth.password.trim()) {
      settings.auth = { password: patch.auth.password.trim() };
    }
    if (Array.isArray(patch.payments)) {
      // ادغام بر اساس شناسه: درگاه‌های موجود به‌روزرسانی و درگاه‌های جدید اضافه می‌شوند
      const byId = {};
      settings.payments.forEach((p) => { byId[p.id] = p; });
      patch.payments.forEach((p) => {
        if (!p || !p.id) return;
        byId[p.id] = Object.assign({}, byId[p.id], p);
      });
      settings.payments = Object.values(byId);
    }
    save();
  }
  return settings;
}

// نمای عمومی: بدون اطلاعات محرمانه‌ی درگاه‌ها؛ فقط نام/لوگوی کافه و درگاه‌های فعال.
function publicView() {
  return {
    cafe: settings.cafe,
    currency: settings.currency || 'toman',
    orderCode: settings.orderCode || 'number',
    payment: settings.payment || { link: '', card: '', holder: '', note: '' },
    payments: (settings.payments || [])
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, name: p.name })),
  };
}

load();

module.exports = { get, update, publicView, load };
