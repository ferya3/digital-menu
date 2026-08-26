'use strict';

const crypto = require('crypto');
const settings = require('./settings');

const TTL_MS = 12 * 3600 * 1000; // اعتبار نشست: ۱۲ ساعت
const COOKIE = 'cafe_auth';

// رمز عبور مدیر: اولویت با متغیر محیطی، سپس تنظیمات، در نهایت پیش‌فرض
function password() {
  return process.env.ADMIN_PASSWORD || (settings.get().auth && settings.get().auth.password) || 'cafe1234';
}
const usingDefaultPassword = () => !process.env.ADMIN_PASSWORD && !(settings.get().auth && settings.get().auth.password);

function secret() {
  return process.env.SESSION_SECRET || crypto.createHash('sha256').update('cafe::' + password()).digest('hex');
}

function sign() {
  const payload = Buffer.from(JSON.stringify({ r: 'staff', exp: Date.now() + TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data && data.exp > Date.now();
  } catch (e) { return false; }
}

function cookieValue(cookieHeader) {
  if (!cookieHeader) return '';
  const part = cookieHeader.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  return part ? decodeURIComponent(part.slice(COOKIE.length + 1)) : '';
}

const isAuthed = (req) => verify(cookieValue(req && req.headers && req.headers.cookie));

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'دسترسی غیرمجاز — ابتدا وارد شوید' });
}

// بررسی رمز عبور به‌صورت زمان‌ثابت
function check(attempt) {
  const a = Buffer.from(String(attempt || ''));
  const p = Buffer.from(password());
  if (a.length !== p.length) return false;
  try { return crypto.timingSafeEqual(a, p); } catch (e) { return false; }
}

module.exports = { sign, verify, isAuthed, requireAuth, check, password, usingDefaultPassword, COOKIE };
