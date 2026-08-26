'use strict';

const express = require('express');
const store = require('../store');
const auth = require('../auth');

const TYPES = ['waiter', 'invoice'];

module.exports = (io) => {
  const router = express.Router();

  // ثبت درخواست گارسون یا فاکتور توسط مشتری
  router.post('/', (req, res) => {
    const { table, type, note } = req.body || {};
    if (!table) return res.status(400).json({ error: 'شماره میز الزامی است' });
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: 'نوع درخواست نامعتبر است' });
    }

    const request = {
      id: store.id('req'),
      table: String(table),
      type, // waiter | invoice
      note: (note || '').toString().slice(0, 200), // متن دلخواه مشتری (مثلاً قاشق اضافه)
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    // برای درخواست صورتحساب، جمع کل میز را ذخیره کن تا صندوق مبلغ بدهی را ببیند
    if (type === 'invoice') {
      const open = store.openBillOrders(table);
      request.amount = open.reduce((sum, o) => sum + (o.total || 0), 0);
      request.orderCount = open.length;
    }
    store.requests.unshift(request);

    io.to('staff').emit('request:new', request);
    res.status(201).json(request);
  });

  // فهرست درخواست‌ها (فقط کارکنان)
  router.get('/', auth.requireAuth, (req, res) => {
    res.json(store.requests);
  });

  // انجام‌شدن درخواست (فقط کارکنان)
  router.patch('/:id', auth.requireAuth, (req, res) => {
    const request = store.requests.find((r) => r.id === req.params.id);
    if (!request) return res.status(404).json({ error: 'درخواست یافت نشد' });
    request.status = 'done';
    io.to('staff').emit('request:updated', request);
    res.json(request);
  });

  return router;
};
