import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedMenu, type BusinessKind } from "@/lib/seeds";
import { currentTenant } from "@/lib/tenant-context";
import { sealExisting } from "@/lib/secret-box";

// یک اتصال برای هر مجموعه؛ روی globalThis تا با هات‌ری‌لودِ Next دوباره باز نشود
const g = globalThis as unknown as { __cafeDbs?: Map<string, DatabaseSync> };
const dbs = (g.__cafeDbs ??= new Map());

function createDb(dir: string, init?: SeedOptions): DatabaseSync {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "cafe.db"));
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
    -- پیامک گروهی: هر ارسال یک «کمپین» است و برای هر شماره یک ردیف در صف (outbox) دارد
    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id TEXT PRIMARY KEY, message TEXT NOT NULL, created_at TEXT, total INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running', note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sms_outbox (
      campaign_id TEXT NOT NULL, phone TEXT NOT NULL, status TEXT DEFAULT 'queued',
      detail TEXT DEFAULT '', sent_at TEXT DEFAULT '', PRIMARY KEY (campaign_id, phone)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_tbl ON orders(tbl);
    CREATE INDEX IF NOT EXISTS idx_items_cat ON items(category_id);
  `);
  // مهاجرت: ستون‌هایی که بعداً اضافه شده‌اند (روی دیتابیس‌های قدیمی)
  for (const sql of [
    "ALTER TABLE orders ADD COLUMN note TEXT DEFAULT ''",
    "ALTER TABLE categories ADD COLUMN banner TEXT DEFAULT ''",
    // حسابداری: زمان و روشِ پرداخت
    "ALTER TABLE orders ADD COLUMN paid_at TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN pay_method TEXT DEFAULT ''",
    // مشتریانی که نمی‌خواهند پیامکِ تبلیغاتی بگیرند
    "ALTER TABLE customers ADD COLUMN sms_optout INTEGER DEFAULT 0",
  ]) {
    try {
      db.exec(sql);
    } catch {
      /* ستون از قبل هست */
    }
  }
  // سفارش‌های پرداخت‌شدهٔ قدیمی: زمانِ پرداخت ≈ آخرین تغییر؛ روش از روی فیش
  db.exec(`UPDATE orders SET paid_at = updated_at,
             pay_method = CASE WHEN pay_method != '' THEN pay_method WHEN receipt != '' THEN 'receipt' ELSE 'counter' END
           WHERE paid = 1 AND (paid_at IS NULL OR paid_at = '')`);
  // ارسالی که با ری‌استارتِ سرور نیمه‌کاره مانده را «قطع‌شده» علامت بزن (از پنل قابل ادامه است)
  db.exec("UPDATE sms_campaigns SET status='interrupted' WHERE status='running'");
  seed(db, init);
  // اطلاعاتِ حساسِ ذخیره‌شده با نسخه‌های قبلی هم رمز شوند
  sealExisting(db);
  return db;
}

export interface SeedOptions {
  kind: BusinessKind;
  name: string;
  /** منوی نمونه (قابل حذف از پنل) */
  sample: boolean;
}

/** فقط یک‌بار (دیتابیسِ تازه): منوی نمونه + تنظیماتِ اولیه. اگر مدیر همهٔ محصولات را پاک کند دوباره پر نمی‌شود. */
function seed(db: DatabaseSync, init?: SeedOptions) {
  const done = db.prepare("SELECT 1 FROM settings WHERE key = 'seeded'").get();
  if (done) return;
  const count = db.prepare("SELECT COUNT(*) c FROM items").get() as unknown as { c: number };
  if (count.c === 0) {
    const kind = init?.kind || "cafe";
    const { categories, dishes } = seedMenu(kind, init ? init.sample : true);
    const insCat = db.prepare("INSERT INTO categories (id, name, emoji, sort) VALUES (?, ?, ?, ?)");
    categories.forEach((c, i) => insCat.run(c.id, c.name, c.emoji, i));
    const insItem = db.prepare(
      `INSERT INTO items (id, category_id, name, description, price, old_price, emoji, tag, available, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    );
    dishes.forEach((d, i) => insItem.run(d.id, d.category, d.name, d.desc, d.price, d.oldPrice ?? 0, d.emoji, d.tag ?? "", i));
    // تنظیمات پیش‌فرض
    const s = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    const logo = { cafe: "☕", restaurant: "🍽️", fastfood: "🍔", other: "🍴" }[kind];
    s.run("cafe", JSON.stringify({ name: init?.name || "کافه آرتاویل", logo, tagline: "", currency: "toman", kind }));
    s.run("payment", JSON.stringify({ card: "", holder: "", note: "", link: "" }));
  }
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded', 'true')").run();
}

/** دیتابیسِ مجموعهٔ همین درخواست */
export function db(): DatabaseSync {
  const t = currentTenant();
  let d = dbs.get(t.slug);
  if (!d) {
    d = createDb(t.dir);
    dbs.set(t.slug, d);
  }
  return d;
}

/** ساختِ دیتابیسِ مجموعهٔ تازه با منوی متناسب با نوعِ کسب‌وکار (باید داخلِ runAsTenant صدا زده شود) */
export function initTenantDb(init: SeedOptions): DatabaseSync {
  const t = currentTenant();
  const d = createDb(t.dir, init);
  dbs.set(t.slug, d);
  return d;
}

/** بستنِ اتصال (قبل از جابه‌جایی/حذفِ پوشهٔ مجموعه) */
export function closeTenantDb(slug: string) {
  const d = dbs.get(slug);
  if (d) {
    try { d.close(); } catch {}
    dbs.delete(slug);
  }
}
