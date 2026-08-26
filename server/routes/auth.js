'use strict';

const express = require('express');
const auth = require('../auth');

module.exports = () => {
  const router = express.Router();
  const attempts = new Map(); // ip -> { n, t } برای محدودیت تلاش ورود

  router.post('/login', (req, res) => {
    const ip = req.ip || 'x';
    const rec = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 10 * 60000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 8) return res.status(429).json({ error: 'تلاش بیش از حد؛ چند دقیقه بعد دوباره امتحان کنید' });

    if (!auth.check((req.body || {}).password)) {
      rec.n += 1; attempts.set(ip, rec);
      return res.status(401).json({ error: 'رمز عبور نادرست است' });
    }
    attempts.delete(ip);
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie',
      `${auth.COOKIE}=${auth.sign()}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${12 * 3600}${secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${auth.COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => res.json({ authed: auth.isAuthed(req) }));

  return router;
};
