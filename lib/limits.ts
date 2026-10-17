import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "@/lib/tenant-context";

/**
 * محدودیتِ تعدادِ درخواست و کدهای یک‌بارمصرف — روی دیسک (data/limits.db)، نه در حافظه؛
 * با ری‌استارت/به‌روزرسانیِ سرور از بین نمی‌رود و بین پروسه‌ها مشترک است.
 */
const g = globalThis as unknown as { __limitsDb?: DatabaseSync };
function ldb(): DatabaseSync {
  if (g.__limitsDb) return g.__limitsDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new DatabaseSync(path.join(DATA_DIR, "limits.db"));
  d.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS hits (key TEXT PRIMARY KEY, n INTEGER, t INTEGER);
    CREATE TABLE IF NOT EXISTS codes (key TEXT PRIMARY KEY, hash TEXT, exp INTEGER, attempts INTEGER, last_sent INTEGER);
    CREATE TABLE IF NOT EXISTS used (key TEXT PRIMARY KEY, exp INTEGER);`);
  d.prepare("DELETE FROM used WHERE exp < ?").run(Date.now());
  d.prepare("DELETE FROM hits WHERE t < ?").run(Date.now() - 86_400_000);
  d.prepare("DELETE FROM codes WHERE exp < ?").run(Date.now() - 3600_000);
  g.__limitsDb = d;
  return d;
}

/** شمارشِ تلاش در یک پنجرهٔ زمانی؛ بیش از max ← خطا */
export function hit(key: string, max: number, windowMs: number, message = "تعداد تلاش زیاد است؛ کمی بعد دوباره امتحان کنید") {
  const d = ldb();
  const now = Date.now();
  const r = d.prepare("SELECT n, t FROM hits WHERE key = ?").get(key) as unknown as { n: number; t: number } | undefined;
  const fresh = !r || now - r.t > windowMs;
  const n = fresh ? 1 : r!.n + 1;
  d.prepare("INSERT INTO hits (key, n, t) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET n = excluded.n, t = excluded.t")
    .run(key, n, fresh ? now : r!.t);
  if (n > max) throw new Error(message);
}
/** قفل بودن بدونِ شمردنِ تلاشِ تازه (قبل از بررسیِ رمز؛ تا حدسِ درست هم در زمانِ قفل رد شود) */
export function assertNotLocked(key: string, max: number, windowMs: number, message = "تعداد تلاش زیاد است؛ کمی بعد دوباره امتحان کنید") {
  const r = ldb().prepare("SELECT n, t FROM hits WHERE key = ?").get(key) as unknown as { n: number; t: number } | undefined;
  if (r && Date.now() - r.t <= windowMs && r.n >= max) throw new Error(message);
}
/** توکنِ یک‌بارمصرف: بارِ اول true، از آن به بعد (حتی بعد از ری‌استارت) false */
export function consumeOnce(key: string, ttlMs: number): boolean {
  const r = ldb().prepare("INSERT OR IGNORE INTO used (key, exp) VALUES (?, ?)").run(key, Date.now() + ttlMs);
  return Number(r.changes) > 0;
}
export function clearHits(key: string) {
  ldb().prepare("DELETE FROM hits WHERE key = ?").run(key);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** کدِ عددیِ تازه (۶ رقم) — فقط هشِ آن ذخیره می‌شود. cooldownMs: فاصلهٔ حداقل بین دو ارسال */
export function issueCode(key: string, ttlMs: number, cooldownMs = 60_000): string {
  const d = ldb();
  const prev = d.prepare("SELECT last_sent FROM codes WHERE key = ?").get(key) as unknown as { last_sent: number } | undefined;
  if (prev && Date.now() - prev.last_sent < cooldownMs) throw new Error("لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید");
  const code = String(crypto.randomInt(100000, 1000000));
  d.prepare("INSERT INTO codes (key, hash, exp, attempts, last_sent) VALUES (?, ?, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET hash=excluded.hash, exp=excluded.exp, attempts=0, last_sent=excluded.last_sent")
    .run(key, sha(key + ":" + code), Date.now() + ttlMs, Date.now());
  return code;
}

/** بررسیِ کد: حداکثر ۵ تلاش برای هر کد؛ کدِ درست یک‌بار مصرف می‌شود */
export function checkCode(key: string, input: string) {
  const d = ldb();
  const r = d.prepare("SELECT hash, exp, attempts FROM codes WHERE key = ?").get(key) as unknown as { hash: string; exp: number; attempts: number } | undefined;
  if (!r) throw new Error("ابتدا کد تأیید را درخواست کنید");
  if (Date.now() > r.exp) { d.prepare("DELETE FROM codes WHERE key = ?").run(key); throw new Error("کد منقضی شده؛ دوباره درخواست دهید"); }
  if (r.attempts >= 5) { d.prepare("DELETE FROM codes WHERE key = ?").run(key); throw new Error("تعداد تلاش زیاد است؛ دوباره درخواست دهید"); }
  d.prepare("UPDATE codes SET attempts = attempts + 1 WHERE key = ?").run(key);
  const a = Buffer.from(sha(key + ":" + input)), b = Buffer.from(r.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("کد واردشده نادرست است");
  d.prepare("DELETE FROM codes WHERE key = ?").run(key);
}
