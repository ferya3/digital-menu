import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "@/lib/tenant-context";

/**
 * Rate limits and one-time codes — stored on disk (data/limits.db), not in memory;
 * survives server restarts/updates and is shared between processes.
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

/** Counts attempts in a time window; more than max → error */
export function hit(key: string, max: number, windowMs: number, message = "Too many attempts. Please try again in a little while") {
  const d = ldb();
  const now = Date.now();
  const r = d.prepare("SELECT n, t FROM hits WHERE key = ?").get(key) as unknown as { n: number; t: number } | undefined;
  const fresh = !r || now - r.t > windowMs;
  const n = fresh ? 1 : r!.n + 1;
  d.prepare("INSERT INTO hits (key, n, t) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET n = excluded.n, t = excluded.t")
    .run(key, n, fresh ? now : r!.t);
  if (n > max) throw new Error(message);
}
/** Lock check without counting a new attempt (before checking the password, so even a correct guess is rejected while locked) */
export function assertNotLocked(key: string, max: number, windowMs: number, message = "Too many attempts. Please try again in a little while") {
  const r = ldb().prepare("SELECT n, t FROM hits WHERE key = ?").get(key) as unknown as { n: number; t: number } | undefined;
  if (r && Date.now() - r.t <= windowMs && r.n >= max) throw new Error(message);
}
/** One-time token: true the first time, false afterwards (even after a restart) */
export function consumeOnce(key: string, ttlMs: number): boolean {
  const r = ldb().prepare("INSERT OR IGNORE INTO used (key, exp) VALUES (?, ?)").run(key, Date.now() + ttlMs);
  return Number(r.changes) > 0;
}
export function clearHits(key: string) {
  ldb().prepare("DELETE FROM hits WHERE key = ?").run(key);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** New numeric code (6 digits) — only its hash is stored. cooldownMs: minimum gap between two sends */
export function issueCode(key: string, ttlMs: number, cooldownMs = 60_000): string {
  const d = ldb();
  const prev = d.prepare("SELECT last_sent FROM codes WHERE key = ?").get(key) as unknown as { last_sent: number } | undefined;
  if (prev && Date.now() - prev.last_sent < cooldownMs) throw new Error("Please wait a minute and try again");
  const code = String(crypto.randomInt(100000, 1000000));
  d.prepare("INSERT INTO codes (key, hash, exp, attempts, last_sent) VALUES (?, ?, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET hash=excluded.hash, exp=excluded.exp, attempts=0, last_sent=excluded.last_sent")
    .run(key, sha(key + ":" + code), Date.now() + ttlMs, Date.now());
  return code;
}

/** Checks a code: at most 5 attempts per code; a correct code is consumed */
export function checkCode(key: string, input: string) {
  const d = ldb();
  const r = d.prepare("SELECT hash, exp, attempts FROM codes WHERE key = ?").get(key) as unknown as { hash: string; exp: number; attempts: number } | undefined;
  if (!r) throw new Error("Please request a verification code first");
  if (Date.now() > r.exp) { d.prepare("DELETE FROM codes WHERE key = ?").run(key); throw new Error("The code has expired. Please request a new one"); }
  if (r.attempts >= 5) { d.prepare("DELETE FROM codes WHERE key = ?").run(key); throw new Error("Too many attempts. Please request a new code"); }
  d.prepare("UPDATE codes SET attempts = attempts + 1 WHERE key = ?").run(key);
  const a = Buffer.from(sha(key + ":" + input)), b = Buffer.from(r.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("The code you entered is incorrect");
  d.prepare("DELETE FROM codes WHERE key = ?").run(key);
}
