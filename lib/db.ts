import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, DISHES } from "@/lib/data";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "cafe.db");

// سینگلتون روی globalThis تا با هات‌ری‌لودِ Next دوباره باز نشود
const g = globalThis as unknown as { __cafeDb?: DatabaseSync };

function createDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT DEFAULT '🍽️', sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT DEFAULT '', price INTEGER DEFAULT 0, old_price INTEGER DEFAULT 0,
      emoji TEXT DEFAULT '🍽️', image TEXT DEFAULT '', tag TEXT DEFAULT '',
      available INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, number INTEGER, tbl TEXT, items TEXT, total INTEGER,
      status TEXT DEFAULT 'new', paid INTEGER DEFAULT 0, pay_status TEXT DEFAULT 'none',
      receipt TEXT DEFAULT '', receipt_hash TEXT DEFAULT '', receipt_reused INTEGER DEFAULT 0,
      rejected_reason TEXT DEFAULT '', phone TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, tbl TEXT, type TEXT, note TEXT DEFAULT '', status TEXT DEFAULT 'pending',
      amount INTEGER DEFAULT 0, order_count INTEGER DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, tbl TEXT, order_id TEXT, rating INTEGER, comment TEXT DEFAULT '', created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
      phone TEXT PRIMARY KEY, tables TEXT DEFAULT '', visits INTEGER DEFAULT 1,
      first_seen TEXT, last_seen TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE INDEX IF NOT EXISTS idx_orders_tbl ON orders(tbl);
    CREATE INDEX IF NOT EXISTS idx_items_cat ON items(category_id);
  `);
  // مهاجرت: ستون‌هایی که بعداً اضافه شده‌اند (روی دیتابیس‌های قدیمی)
  for (const sql of ["ALTER TABLE orders ADD COLUMN note TEXT DEFAULT ''"]) {
    try {
      db.exec(sql);
    } catch {
      /* ستون از قبل هست */
    }
  }
  seed(db);
  return db;
}

function seed(db: DatabaseSync) {
  const count = db.prepare("SELECT COUNT(*) c FROM items").get() as unknown as { c: number };
  if (count.c > 0) return;
  const insCat = db.prepare(
    "INSERT INTO categories (id, name, emoji, sort) VALUES (?, ?, ?, ?)"
  );
  CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name, c.emoji, i));
  const insItem = db.prepare(
    `INSERT INTO items (id, category_id, name, description, price, old_price, emoji, tag, available, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  DISHES.forEach((d, i) =>
    insItem.run(
      d.id, d.category, d.name, d.desc, d.price, d.oldPrice ?? 0, d.emoji, d.tag ?? "", i
    )
  );
  // تنظیمات پیش‌فرض
  const s = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  s.run("cafe", JSON.stringify({ name: "کافه آرتاویل", logo: "☕", tagline: "", currency: "toman" }));
  s.run("payment", JSON.stringify({ card: "", holder: "", note: "", link: "" }));
}

export function db(): DatabaseSync {
  if (!g.__cafeDb) g.__cafeDb = createDb();
  return g.__cafeDb;
}
