'use strict';

const express = require('express');
const otp = require('../otp');
const sms = require('../sms');
const customers = require('../customers');

module.exports = () => {
  const router = express.Router();
  const ipHits = new Map(); // محدودیت نرخ بر اساس IP (ضد سوءاستفاده و هزینه‌ی پیامک)

  // درخواست کد تأیید
  router.post('/request', async (req, res) => {
    const ip = req.ip || 'x';
    const rec = ipHits.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 10 * 60000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 6) return res.status(429).json({ error: 'تعداد درخواست زیاد است؛ کمی بعد دوباره امتحان کنید' });
    rec.n += 1; ipHits.set(ip, rec);

    const r = otp.request((req.body || {}).phone);
    if (!r.ok) return res.status(400).json({ error: r.error });
    const result = await sms.sendOtp(r.phone, r.code);
    // فقط در حالت آزمایشی کد به کلاینت برگردانده می‌شود (در حالت واقعی هرگز)
    res.json({ ok: true, demo: result.demo, code: result.demo ? r.code : undefined });
  });

  // تأیید کد → ثبت شماره در بانک اطلاعات
  router.post('/verify', (req, res) => {
    const { phone, code, table } = req.body || {};
    const r = otp.verify(phone, code);
    if (!r.ok) return res.status(400).json({ error: r.error });
    customers.add(r.phone, table);
    res.json({ ok: true, phone: r.phone });
  });

  return router;
};
