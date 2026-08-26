'use strict';

const express = require('express');
const store = require('../store');
const auth = require('../auth');

module.exports = (io) => {
  const router = express.Router();

  // دریافت کامل منو (عمومی)
  router.get('/', (req, res) => {
    res.json(store.getMenu());
  });

  // از اینجا به بعد فقط مدیر (افزودن/ویرایش/حذف منو)
  router.use(auth.requireAuth);

  // افزودن دسته‌ی جدید
  router.post('/categories', (req, res) => {
    const { name, icon } = req.body || {};
    if (!name) return res.status(400).json({ error: 'نام دسته الزامی است' });
    const cat = store.addCategory({ name, icon });
    store.saveMenu();
    io.emit('menu:updated');
    res.status(201).json(cat);
  });

  // ویرایش دسته (نام/ایکون)
  router.put('/categories/:id', (req, res) => {
    const cat = store.updateCategory(req.params.id, req.body || {});
    if (!cat) return res.status(404).json({ error: 'دسته یافت نشد' });
    io.emit('menu:updated');
    res.json(cat);
  });

  // حذف دسته (فقط اگر محصولی نداشته باشد)
  router.delete('/categories/:id', (req, res) => {
    const r = store.deleteCategory(req.params.id);
    if (!r.ok) return res.status(400).json({ error: r.error });
    io.emit('menu:updated');
    res.json({ ok: true });
  });

  // افزودن محصول جدید
  router.post('/items', (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'نام محصول الزامی است' });
    let categoryId = b.categoryId;
    if (b.newCategory) {
      categoryId = store.addCategory({ name: b.newCategory, icon: b.newCategoryIcon }).id;
    }
    if (!store.findCategory(categoryId)) {
      return res.status(400).json({ error: 'دسته‌بندی نامعتبر است' });
    }
    const item = store.addItem(Object.assign({}, b, { categoryId }));
    io.emit('menu:updated');
    res.status(201).json(item);
  });

  // ویرایش محصول
  router.put('/items/:id', (req, res) => {
    const b = req.body || {};
    if (b.newCategory) {
      b.categoryId = store.addCategory({ name: b.newCategory, icon: b.newCategoryIcon }).id;
    }
    const item = store.updateItem(req.params.id, b);
    if (!item) return res.status(404).json({ error: 'محصول یافت نشد' });
    io.emit('menu:updated');
    res.json(item);
  });

  // حذف محصول
  router.delete('/items/:id', (req, res) => {
    if (!store.deleteItem(req.params.id)) {
      return res.status(404).json({ error: 'محصول یافت نشد' });
    }
    io.emit('menu:updated');
    res.json({ ok: true });
  });

  return router;
};
