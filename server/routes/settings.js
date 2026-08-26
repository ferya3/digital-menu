'use strict';

const express = require('express');
const settings = require('../settings');
const store = require('../store');
const auth = require('../auth');

module.exports = () => {
  const router = express.Router();

  // عمومی: نام/لوگوی کافه و درگاه‌های فعال (بدون اطلاعات محرمانه)
  router.get('/', (req, res) => res.json(settings.publicView()));

  // مدیریت: همه‌ی تنظیمات (پشت احراز هویت). رمز عبور هرگز برگردانده نمی‌شود.
  router.get('/admin', auth.requireAuth, (req, res) => {
    const s = settings.get();
    res.json(Object.assign({}, s, { auth: { hasPassword: !!(s.auth && s.auth.password) } }));
  });
  router.put('/admin', auth.requireAuth, (req, res) => {
    const body = req.body || {};
    // اگر تصویر کاور/لوگو به‌صورت base64 آمده باشد، آن را ذخیره و به مسیر تبدیل کن
    if (body.cafe) {
      if (typeof body.cafe.cover === 'string' && body.cafe.cover.startsWith('data:')) {
        body.cafe.cover = store.saveItemImage(body.cafe.cover, 'cover');
      }
      if (typeof body.cafe.logo === 'string' && body.cafe.logo.startsWith('data:')) {
        body.cafe.logo = store.saveItemImage(body.cafe.logo, 'logo');
      }
    }
    const s = settings.update(body);
    res.json(Object.assign({}, s, { auth: { hasPassword: !!(s.auth && s.auth.password) } }));
  });

  return router;
};
