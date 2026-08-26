'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'customers.json');

// بانک اطلاعات شماره‌ موبایل مشتری‌ها (ذخیره روی فایل تا پس از ری‌استارت باقی بماند)
let customers = [];

function load() {
  try {
    customers = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    customers = [];
  }
  return customers;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(customers, null, 2), 'utf8');
  } catch (err) {
    console.error('خطا در ذخیره‌ی مشتری‌ها:', err.message);
  }
}

// نرمال‌سازی شماره (اعداد فارسی، +98، 0098 و ...) به شکل 09xxxxxxxxx
function normalizePhone(raw) {
  if (!raw) return '';
  let p = String(raw)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[^\d]/g, '');
  if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  if (p.length === 10 && p.startsWith('9')) p = '0' + p;
  return p;
}

const isValid = (p) => /^09\d{9}$/.test(p);

function add(rawPhone, table) {
  const phone = normalizePhone(rawPhone);
  if (!isValid(phone)) return null;
  const now = new Date().toISOString();
  let c = customers.find((x) => x.phone === phone);
  if (c) {
    c.visits += 1;
    c.lastSeen = now;
    if (table && !c.tables.includes(String(table))) c.tables.push(String(table));
  } else {
    c = { phone, tables: table ? [String(table)] : [], visits: 1, firstSeen: now, lastSeen: now };
    customers.unshift(c);
  }
  save();
  return c;
}

load();

module.exports = { add, all: () => customers, normalizePhone, isValid };
