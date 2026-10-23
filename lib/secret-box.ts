import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * Encryption of sensitive data in the database (AES-256-GCM): SMS provider credentials, Stripe keys
 * and signing keys. If only the database file (or the data folder) leaks, these stay unreadable.
 * Key: DATA_KEY in the environment, or the file /etc/cafe-menu/data.key (outside the app and data/, 0600, root only)
 * which is created automatically. Regular backups don't include it (only encrypted backups) — key and data kept apart.
 */
const PREFIX = "enc:v1:";
let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const env = (process.env.DATA_KEY || "").trim();
  if (/^[0-9a-f]{64}$/i.test(env)) return (cached = Buffer.from(env, "hex"));
  const file = keyFile();
  const legacy = path.join(process.cwd(), ".data-key");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    // The key from an older version (next to the app) is moved to the safe location
    if (file !== legacy && fs.existsSync(legacy)) { fs.copyFileSync(legacy, file); fs.rmSync(legacy); }
    else fs.writeFileSync(file, crypto.randomBytes(32).toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  }
  fs.chmodSync(file, 0o600);
  const hex = fs.readFileSync(file, "utf8").trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Invalid .data-key");
  return (cached = Buffer.from(hex, "hex"));
}

/** Key file location: DATA_KEY_FILE, or /etc/cafe-menu/data.key on the server (root), or .data-key in development */
export function keyFile(): string {
  if (process.env.DATA_KEY_FILE) return process.env.DATA_KEY_FILE;
  return process.getuid?.() === 0 ? "/etc/cafe-menu/data.key" : path.join(process.cwd(), ".data-key");
}

export const isSealed = (v: string) => typeof v === "string" && v.startsWith(PREFIX);

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function unseal(v: string): string {
  if (!isSealed(v)) return v; // legacy unencrypted value
  const buf = Buffer.from(v.slice(PREFIX.length), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** Setting keys that are stored encrypted */
// admin_pw too (scrypt hash): if only the database leaks, even offline password guessing isn't possible
export const SECRET_SETTINGS = new Set(["sms", "gateways", "session_secret", "platform", "secret", "admin_pw", "partners", "stripe"]);

/** One-time: encrypts legacy unencrypted sensitive values */
export function sealExisting(db: DatabaseSync) {
  // Overwrite deleted data with zeros (so old secrets don't linger in free pages)
  db.exec("PRAGMA secure_delete = ON");
  const rows = db.prepare("SELECT key, value FROM settings").all() as unknown as { key: string; value: string }[];
  let changed = 0;
  for (const r of rows) {
    if (SECRET_SETTINGS.has(r.key) && r.value && !isSealed(r.value)) {
      db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(seal(r.value), r.key);
      changed++;
    }
  }
  // After encrypting legacy values, rewrite the file so no plaintext copy remains
  if (changed) db.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);");
}
