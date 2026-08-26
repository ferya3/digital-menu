'use strict';

const settings = require('./settings');

/*
 * ارسال کد تأیید به موبایل.
 * اگر سامانه‌ی پیامک (مثلاً کاوه‌نگار) در تنظیمات فعال باشد، پیامک واقعی ارسال می‌شود؛
 * در غیر این صورت «حالت آزمایشی» فعال است و کد فقط برای تست روی صفحه نمایش داده می‌شود.
 */
async function sendOtp(phone, code) {
  const sms = (settings.get() && settings.get().sms) || {};

  if (sms.provider === 'kavenegar' && sms.apiKey) {
    try {
      const url =
        `https://api.kavenegar.com/v1/${encodeURIComponent(sms.apiKey)}/verify/lookup.json` +
        `?receptor=${encodeURIComponent(phone)}` +
        `&token=${encodeURIComponent(code)}` +
        `&template=${encodeURIComponent(sms.template || 'verify')}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const ok = data && data.return && data.return.status === 200;
      return { sent: !!ok, demo: false };
    } catch (e) {
      console.error('خطا در ارسال پیامک:', e.message);
      return { sent: false, demo: false };
    }
  }

  // حالت آزمایشی
  console.log(`[OTP] کد تأیید ${code} برای ${phone} (حالت آزمایشی — پیامک واقعی ارسال نشد)`);
  return { sent: false, demo: true };
}

module.exports = { sendOtp };
