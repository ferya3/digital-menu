'use strict';

const express = require('express');
const store = require('../store');
const customers = require('../customers');
const auth = require('../auth');
const watermark = require('../watermark');
const settings = require('../settings');

const STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];

module.exports = (io) => {
  const router = express.Router();

  // ثبت سفارش جدید توسط مشتری
  router.post('/', (req, res) => {
    const { table, items, note, phone } = req.body || {};
    if (!table) return res.status(400).json({ error: 'شماره میز الزامی است' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'سبد خرید خالی است' });
    }

    // قیمت‌ها را از روی منوی سرور محاسبه می‌کنیم تا قابل دستکاری از سمت کاربر نباشد
    const lineItems = [];
    for (const line of items) {
      const item = store.getItem(line && line.id);
      if (!item || item.available === false) continue;
      const qty = Math.max(1, parseInt(line.qty, 10) || 1);
      lineItems.push({ id: item.id, name: item.name, price: item.price, qty });
    }
    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'هیچ آیتم معتبری در سبد نیست' });
    }

    const total = lineItems.reduce((sum, l) => sum + l.price * l.qty, 0);
    const now = new Date().toISOString();
    const customerPhone = customers.normalizePhone(phone || '');
    const order = {
      id: store.id('ord'),
      number: store.nextOrderNumber(),
      table: String(table),
      items: lineItems,
      note: (note || '').toString().slice(0, 500),
      phone: customers.isValid(customerPhone) ? customerPhone : '',
      total,
      status: 'new',
      paid: false,
      payStatus: 'none', // none | pending (فیش آمده) | confirmed (تأیید صندوقدار)
      createdAt: now,
      updatedAt: now,
    };
    store.orders.unshift(order);
    if (order.phone) customers.add(order.phone, table); // جمع‌آوری در بانک اطلاعات

    io.to('staff').emit('order:new', order);
    res.status(201).json(order);
  });

  // فهرست همه‌ی سفارش‌ها (فقط کارکنان)
  router.get('/', auth.requireAuth, (req, res) => {
    res.json(store.orders);
  });

  // صورتحساب جاری یک میز: همه‌ی سفارش‌های پرداخت‌نشده‌ی آن میز + جمع کل (مشتری)
  router.get('/table/:table/bill', (req, res) => {
    const table = String(req.params.table);
    const open = store.openBillOrders(table);
    const total = open.reduce((sum, o) => sum + (o.total || 0), 0);
    const receipt = (open.find((o) => o.receipt) || {}).receipt || '';
    const rejected = open.find((o) => o.payStatus === 'rejected');
    res.json({
      table,
      count: open.length,
      total,
      // آپلود تازه (pending) بر رد قبلی اولویت دارد؛ وگرنه رد را نشان بده
      payStatus: open.some((o) => o.payStatus === 'pending') ? 'pending' : (rejected ? 'rejected' : 'none'),
      rejectedReason: rejected ? (rejected.rejectedReason || '') : '',
      receipt,
      orders: open.map((o) => ({
        id: o.id, number: o.number, items: o.items, total: o.total,
        status: o.status, paid: o.paid, payStatus: o.payStatus,
        receipt: o.receipt || '', createdAt: o.createdAt,
      })),
    });
  });

  // بارگذاری یک رسید پرداخت برای کل صورتحساب میز (مشتری) → به همه‌ی سفارش‌های باز می‌چسبد
  router.post('/table/:table/receipt', async (req, res) => {
    const table = String(req.params.table);
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'تصویر رسید لازم است' });
    const open = store.openBillOrders(table);
    if (open.length === 0) return res.status(404).json({ error: 'صورتحساب بازی برای این میز وجود ندارد' });

    const total = open.reduce((sum, o) => sum + (o.total || 0), 0);
    // بررسی تقلب: اگر همین تصویر قبلاً جای دیگری استفاده شده باشد، احتمالاً اسکرین‌شات تکراری است
    const hash = watermark.hashImage(image);
    const openIds = new Set(open.map((o) => o.id));
    const reused = !!hash && store.orders.some((o) => o.receiptHash === hash && !openIds.has(o.id));
    const token = watermark.makeToken();
    const now = new Date().toISOString();

    // مهرِ ضدجعل روی تصویر در سمت سرور حک می‌شود (مشتری نمی‌تواند دورش بزند)
    let toSave = image;
    try {
      toSave = await watermark.stampReceipt(image, {
        table, amount: total, amountText: Number(total).toLocaleString('en-US'),
        cafe: (settings.get().cafe || {}).name, token, date: new Date(),
      });
    } catch (e) { /* اگر حک‌کردن شکست خورد، تصویر خام ذخیره می‌شود تا پرداخت بلاک نشود */ }

    const saved = store.saveItemImage(toSave, 'receipt-t' + table);
    open.forEach((order) => {
      order.receipt = saved;
      order.receiptAt = now;
      order.receiptHash = hash;
      order.receiptToken = token;
      order.receiptReused = reused;
      order.payStatus = 'pending'; // منتظر تأیید صندوق
      order.updatedAt = now;
      io.to('staff').emit('order:updated', order);
      io.to(`table:${order.table}`).emit('order:updated', order);
    });
    res.status(201).json({ ok: true, receipt: saved, count: open.length, reused });
  });

  // دریافت یک سفارش (برای پیگیری وضعیت توسط مشتری)
  router.get('/:id', (req, res) => {
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });
    res.json(order);
  });

  // آپلود عکس فیش پرداخت توسط مشتری → به همان سفارش می‌چسبد
  router.post('/:id/receipt', async (req, res) => {
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ error: 'تصویر فیش الزامی است' });

    const hash = watermark.hashImage(image);
    const reused = !!hash && store.orders.some((o) => o.receiptHash === hash && o.id !== order.id);
    const token = watermark.makeToken();

    let toSave = image;
    try {
      toSave = await watermark.stampReceipt(image, {
        table: order.table, amount: order.total, amountText: Number(order.total).toLocaleString('en-US'),
        cafe: (settings.get().cafe || {}).name, token, date: new Date(),
      });
    } catch (e) { /* در صورت خطا، تصویر خام ذخیره می‌شود */ }

    order.receipt = store.saveItemImage(toSave, 'receipt-' + order.id);
    order.receiptAt = new Date().toISOString();
    order.receiptHash = hash;
    order.receiptToken = token;
    order.receiptReused = reused;
    order.payStatus = 'pending'; // در انتظار تأیید صندوقدار
    order.updatedAt = new Date().toISOString();
    io.to('staff').emit('order:updated', order);
    io.to(`table:${order.table}`).emit('order:updated', order);
    res.status(201).json({ ok: true, receipt: order.receipt, reused });
  });

  // تغییر وضعیت سفارش یا علامت‌گذاری پرداخت (فقط کارکنان)
  router.patch('/:id', auth.requireAuth, (req, res) => {
    const order = store.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'سفارش یافت نشد' });

    const { status, paid, payStatus, reason } = req.body || {};
    if (status && STATUSES.includes(status)) order.status = status;
    if (typeof paid === 'boolean') order.paid = paid;
    if (['none', 'pending', 'confirmed', 'rejected'].includes(payStatus)) {
      order.payStatus = payStatus;
      if (payStatus === 'confirmed') order.paid = true; // تأیید صندوقدار = پرداخت‌شده
      if (payStatus === 'rejected') { // صندوق فیش را رد کرد؛ مشتری باید دوباره پرداخت کند
        order.paid = false;
        order.rejectedReason = (reason || '').toString().slice(0, 200);
        // فیشِ ردشده را از سفارش پاک کن؛ اگر سفارش دیگری همان فایل را استفاده نمی‌کند، فایل را حذف کن
        const file = order.receipt;
        order.receipt = '';
        order.receiptHash = '';
        order.receiptToken = '';
        order.receiptReused = false;
        if (file && !store.orders.some((o) => o.id !== order.id && o.receipt === file)) {
          store.deleteImage(file);
        }
      }
    }
    order.updatedAt = new Date().toISOString();

    io.to('staff').emit('order:updated', order);
    io.to(`table:${order.table}`).emit('order:updated', order);
    res.json(order);
  });

  return router;
};
