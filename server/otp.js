'use strict';

const customers = require('./customers');

// کدهای تأیید موقت در حافظه: phone -> { code, expiresAt, attempts, lastSent }
const codes = new Map();

const genCode = () => String(Math.floor(10000 + Math.random() * 90000)); // ۵ رقمی

function request(rawPhone) {
  const phone = customers.normalizePhone(rawPhone);
  if (!customers.isValid(phone)) return { ok: false, error: 'شماره موبایل نامعتبر است' };

  const now = Date.now();
  const existing = codes.get(phone);
  if (existing && now - existing.lastSent < 60000) {
    return { ok: false, error: 'لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید' };
  }

  const code = genCode();
  codes.set(phone, { code, expiresAt: now + 2 * 60000, attempts: 0, lastSent: now });
  return { ok: true, phone, code };
}

function verify(rawPhone, inputCode) {
  const phone = customers.normalizePhone(rawPhone);
  const rec = codes.get(phone);
  if (!rec) return { ok: false, error: 'ابتدا کد تأیید را درخواست کنید' };
  if (Date.now() > rec.expiresAt) { codes.delete(phone); return { ok: false, error: 'کد منقضی شده؛ دوباره درخواست دهید' }; }
  if (rec.attempts >= 5) { codes.delete(phone); return { ok: false, error: 'تعداد تلاش زیاد است؛ دوباره درخواست دهید' }; }
  rec.attempts += 1;
  if (String(inputCode || '').trim() !== rec.code) return { ok: false, error: 'کد واردشده نادرست است' };
  codes.delete(phone);
  return { ok: true, phone };
}

module.exports = { request, verify };
