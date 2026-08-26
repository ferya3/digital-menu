'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const menuPath = path.join(__dirname, '..', 'data', 'menu.json');
const imagesDir = path.join(__dirname, '..', 'public', 'images');

/*
 * منبع داده‌ها.
 * منو از فایل JSON خوانده و روی همان فایل ذخیره می‌شود (قابل ویرایش از پنل مدیریت).
 * سفارش‌ها/درخواست‌ها/نظرها فعلاً در حافظه نگه‌داری می‌شوند.
 */

let menu = { cafe: { name: 'کافه', currency: 'تومان' }, categories: [], items: [] };

function loadMenu() {
  try {
    // اولین اجرا: اگر menu.json نبود، از منوی نمونه (seed) بساز تا با به‌روزرسانی‌ها (git pull) پاک نشود
    if (!fs.existsSync(menuPath)) {
      const seed = path.join(__dirname, '..', 'data', 'menu.seed.json');
      if (fs.existsSync(seed)) fs.copyFileSync(seed, menuPath);
    }
    menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
  } catch (err) {
    console.error('خطا در خواندن فایل منو:', err.message);
  }
  return menu;
}
loadMenu();

function saveMenu() {
  try {
    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2), 'utf8');
  } catch (err) {
    console.error('خطا در ذخیره‌ی منو:', err.message);
  }
}

// داده‌های زمان اجرا (در حافظه)
const orders = [];
const requests = [];
const feedback = [];

let orderSeq = 0;
const nextOrderNumber = () => ++orderSeq; // شماره‌ی ترتیبی سفارش برای پیگیری آسان‌تر

// ماندگاری داده‌های زمان اجرا روی فایل تا با ری‌استارت/دیپلوی مجدد از بین نروند
const runtimePath = path.join(__dirname, '..', 'data', 'runtime.json');
function loadRuntime() {
  try {
    const d = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    if (Array.isArray(d.orders)) orders.push(...d.orders);
    if (Array.isArray(d.requests)) requests.push(...d.requests);
    if (Array.isArray(d.feedback)) feedback.push(...d.feedback);
    if (typeof d.orderSeq === 'number') orderSeq = d.orderSeq;
  } catch (e) { /* اولین اجرا یا فایل نبود */ }
}
function saveRuntime() {
  try {
    fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
    fs.writeFileSync(runtimePath, JSON.stringify({ orders, requests, feedback, orderSeq }), 'utf8');
  } catch (e) { /* نادیده */ }
}
loadRuntime();
setInterval(saveRuntime, 5000).unref();
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => { saveRuntime(); process.exit(0); }));

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

// صورتحساب باز هر میز = سفارش‌های لغو‌نشده و پرداخت‌نشده‌ی همان میز (قدیمی‌تر اول).
// چند سفارش از یک میز روی هم جمع می‌شوند و یک صورتحساب واحد می‌سازند.
function openBillOrders(table) {
  const t = String(table);
  return orders
    .filter((o) => String(o.table) === t && o.status !== 'cancelled' && !o.paid)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// حذف یک تصویر آپلودشده از public/images (هنگام پاک‌کردن فیشِ ردشده).
// فقط فایل‌های داخل پوشه‌ی images را دست می‌زند؛ basename از خروج از مسیر جلوگیری می‌کند.
function deleteImage(webPath) {
  try {
    if (typeof webPath !== 'string' || !webPath.startsWith('/images/')) return;
    const file = path.join(imagesDir, path.basename(webPath));
    if (file.startsWith(imagesDir) && fs.existsSync(file)) fs.unlinkSync(file);
  } catch (e) { /* بی‌خیال — پاک‌سازی بهترین‌تلاش */ }
}

// اگر تصویر به‌صورت data URL (base64) آمده باشد، آن را در public/images ذخیره و مسیر را برمی‌گرداند.
// اگر آدرس/مسیر معمولی باشد، همان را برمی‌گرداند.
function saveItemImage(dataUrl, itemId) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) return typeof dataUrl === 'string' ? dataUrl : '';
  const ext = /jpe?g/i.test(m[1]) ? 'jpg' : m[1].toLowerCase();
  fs.mkdirSync(imagesDir, { recursive: true });
  const file = `${itemId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(imagesDir, file), Buffer.from(m[2], 'base64'));
  return '/images/' + file;
}

const findCategory = (catId) => menu.categories.find((c) => c.id === catId);

function addCategory({ name, icon }) {
  let ic = (icon && String(icon).trim()) || '🍽️';
  if (/^data:image\//i.test(ic)) ic = saveItemImage(ic, 'cat'); // عکس آیکون آپلودشده -> ذخیره در فایل
  const cat = { id: id('cat'), name: String(name).trim(), icon: ic };
  menu.categories.push(cat);
  return cat;
}

function updateCategory(catId, data) {
  const cat = menu.categories.find((c) => c.id === catId);
  if (!cat) return null;
  if (data.name != null && String(data.name).trim()) cat.name = String(data.name).trim();
  if (data.icon != null && String(data.icon).trim()) {
    let ic = String(data.icon).trim();
    if (/^data:image\//i.test(ic)) ic = saveItemImage(ic, 'cat'); // عکس آیکون آپلودشده -> ذخیره در فایل
    cat.icon = ic;
  }
  saveMenu();
  return cat;
}

function deleteCategory(catId) {
  if (menu.items.some((it) => it.categoryId === catId)) {
    return { ok: false, error: 'این دسته محصول دارد؛ ابتدا محصولات آن را حذف یا به دسته‌ی دیگر منتقل کنید' };
  }
  const i = menu.categories.findIndex((c) => c.id === catId);
  if (i < 0) return { ok: false, error: 'دسته یافت نشد' };
  menu.categories.splice(i, 1);
  saveMenu();
  return { ok: true };
}

function addItem(data) {
  const item = {
    id: id('item'),
    categoryId: data.categoryId,
    name: String(data.name).trim(),
    description: String(data.description || '').trim(),
    price: Math.max(0, Math.round(Number(data.price) || 0)), // همیشه بر پایه‌ی تومان ذخیره می‌شود
    oldPrice: Math.max(0, Math.round(Number(data.oldPrice) || 0)), // قیمت قبل از تخفیف (۰ یعنی بدون تخفیف)
    rating: Math.min(5, Math.max(0, Number(data.rating) || 0)),    // امتیاز ۰ تا ۵
    emoji: data.emoji || '🍽️',
    image: '',
    available: data.available !== false,
  };
  if (data.image) item.image = saveItemImage(data.image, item.id);
  menu.items.push(item);
  saveMenu();
  return item;
}

function updateItem(itemId, data) {
  const item = menu.items.find((i) => i.id === itemId);
  if (!item) return null;
  if (data.name != null) item.name = String(data.name).trim();
  if (data.description != null) item.description = String(data.description).trim();
  if (data.price != null) item.price = Math.max(0, Math.round(Number(data.price) || 0));
  if (data.oldPrice != null) item.oldPrice = Math.max(0, Math.round(Number(data.oldPrice) || 0));
  if (data.rating != null) item.rating = Math.min(5, Math.max(0, Number(data.rating) || 0));
  if (data.categoryId != null) item.categoryId = data.categoryId;
  if (data.emoji != null) item.emoji = data.emoji;
  if (typeof data.available === 'boolean') item.available = data.available;
  if (data.image) item.image = saveItemImage(data.image, item.id);
  else if (data.image === '') item.image = '';
  saveMenu();
  return item;
}

function deleteItem(itemId) {
  const i = menu.items.findIndex((it) => it.id === itemId);
  if (i < 0) return false;
  menu.items.splice(i, 1);
  saveMenu();
  return true;
}

module.exports = {
  loadMenu,
  getMenu: () => menu,
  getItem: (itemId) => menu.items.find((i) => i.id === itemId),
  saveMenu,
  saveItemImage,
  deleteImage,
  findCategory,
  addCategory,
  updateCategory,
  deleteCategory,
  addItem,
  updateItem,
  deleteItem,
  orders,
  requests,
  feedback,
  id,
  nextOrderNumber,
  openBillOrders,
};
