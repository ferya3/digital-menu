import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSetting, setSetting } from "@/lib/queries";
import { currentTenant, saasEnabled } from "@/lib/tenant-context";

const COOKIE = "cafe_session";
const TTL_MS = 12 * 3600 * 1000;

function scryptHex(pw: string, salt: string) {
  return crypto.scryptSync(pw, salt, 64).toString("hex");
}
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${scryptHex(pw, salt)}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(scryptHex(pw, salt));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest();

/** رمز مدیر: اگر در تنظیمات هش ذخیره شده باشد از آن، وگرنه ADMIN_PASSWORD یا پیش‌فرض */
export function checkAdmin(pw: string): boolean {
  const stored = getSetting<string>("admin_pw", "");
  if (stored) return verifyPassword(pw, stored);
  // در حالتِ چندمستاجری هر مجموعه رمزِ خودش را دارد؛ رمزِ پیش‌فرض/محیطی پذیرفته نمی‌شود
  if (saasEnabled()) return false;
  const def = process.env.ADMIN_PASSWORD || "cafe1234";
  return crypto.timingSafeEqual(sha(pw), sha(def));
}
export function setAdminPassword(pw: string) {
  setSetting("admin_pw", hashPassword(pw));
}

function secret(): string {
  let s = getSetting<string>("session_secret", "");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("session_secret", s);
  }
  // کلید به نامِ مجموعه گره خورده: توکنِ یک مجموعه روی مجموعهٔ دیگر معتبر نیست
  const base = process.env.SESSION_SECRET || s;
  return crypto.createHmac("sha256", base).update("tenant:" + currentTenant().slug).digest("hex");
}

export function signSession(): string {
  const payload = Buffer.from(JSON.stringify({ r: "staff", exp: Date.now() + TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

/** دادهٔ کوچکِ امضاشده (مثلاً شمارهٔ تأییدشدهٔ مشتری) برای کوکی */
export function signData(data: Record<string, unknown>, ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function readSigned<T>(token: string | undefined): T | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/* helpers used inside Server Actions */
export async function startSession() {
  (await cookies()).set(COOKIE, signSession(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifySessionToken(token);
}
