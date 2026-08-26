'use strict';

const express = require('express');
const customers = require('../customers');
const auth = require('../auth');

module.exports = () => {
  const router = express.Router();

  // ثبت شماره‌ موبایل مشتری (هنگام ورود از روی QR)
  router.post('/', (req, res) => {
    const { phone, table } = req.body || {};
    const c = customers.add(phone, table);
    if (!c) return res.status(400).json({ error: 'شماره موبایل نامعتبر است' });
    res.status(201).json({ ok: true });
  });

  // فهرست شماره‌ها (فقط مدیر)
  router.get('/', auth.requireAuth, (req, res) => res.json(customers.all()));

  // خروجی CSV (فقط مدیر)
  router.get('/export', auth.requireAuth, (req, res) => {
    const rows = [['شماره موبایل', 'میزها', 'تعداد مراجعه', 'اولین بازدید', 'آخرین بازدید']];
    customers.all().forEach((c) => {
      rows.push([c.phone, (c.tables || []).join('|'), c.visits, c.firstSeen, c.lastSeen]);
    });
    const csv = '﻿' + rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    res.send(csv);
  });

  return router;
};
