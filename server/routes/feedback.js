'use strict';

const express = require('express');
const store = require('../store');
const auth = require('../auth');

module.exports = (io) => {
  const router = express.Router();

  // ثبت نظر و امتیاز توسط مشتری
  router.post('/', (req, res) => {
    const { table, orderId, rating, comment } = req.body || {};
    const r = parseInt(rating, 10);
    if (!r || r < 1 || r > 5) {
      return res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۵ باشد' });
    }

    const entry = {
      id: store.id('fb'),
      table: table ? String(table) : null,
      orderId: orderId || null,
      rating: r,
      comment: (comment || '').toString().slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    store.feedback.unshift(entry);

    io.to('staff').emit('feedback:new', entry);
    res.status(201).json({ ok: true });
  });

  // فهرست نظرها (فقط مدیر)
  router.get('/', auth.requireAuth, (req, res) => {
    res.json(store.feedback);
  });

  return router;
};
