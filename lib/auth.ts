import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getSetting, setSetting } from "@/lib/queries";

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

/** رمزِ ضعیف: کوتاه‌تر از ۸ نویسه یا رمزِ پیش‌فرضِ قدیمی */
export const isWeakPassword = (pw: string) => pw.length < 8 || /^(cafe1234|12345678|password|admin123?)$/i.test(pw);

/**
 * رمز مدیر: اگر در تنظیمات هش ذخیره شده باشد از آن، وگرنه ADMIN_PASSWORD (رمزِ زمانِ نصب).
 * رمزِ پیش‌فرضِ ثابت دیگر وجود ندارد. خروجیِ mustChange: رمزِ نصب ضعیف است و باید همین حالا عوض شود.
 */
export function checkAdmin(pw: string): { ok: boolean; mustChange: boolean } {
  const stored = getSetting<string>("admin_pw", "");
  if (stored) {
    const ok = verifyPassword(pw, stored);
    // admin_pw_weak: رمزِ منتقل‌شده از نصبِ قدیمی ضعیف بوده ← باید عوض شود
    return { ok, mustChange: ok && getSetting<boolean>("admin_pw_weak", false) === true };
  }
  const env = process.env.ADMIN_PASSWORD || "";
  if (!env) return { ok: false, mustChange: false };
  const ok = crypto.timingSafeEqual(sha(pw), sha(env));
  return { ok, mustChange: ok && isWeakPassword(env) };
}
export function setAdminPassword(pw: string) {
  if (isWeakPassword(pw)) throw new Error("رمزِ پنل حداقل ۸ نویسه باشد و رمزِ ساده/پیش‌فرض نباشد");
  setSetting("admin_pw_weak", false);
  setSetting("admin_pw", hashPassword(pw));
}

function secret(): string {
  let s = getSetting<string>("session_secret", "");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    setSetting("session_secret", s);
  }
  return process.env.SESSION_SECRET || s;
}

export function signSession(mustChange = false): string {
  const payload = Buffer.from(JSON.stringify({ r: "staff", exp: Date.now() + TTL_MS, ...(mustChange ? { mc: 1 } : {}) })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
/** null = نشستِ نامعتبر؛ mustChange = فقط اجازهٔ عوض‌کردنِ رمز */
function readSession(token: string | undefined): { mustChange: boolean } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number; mc?: number };
    return data.exp > Date.now() ? { mustChange: !!data.mc } : null;
  } catch {
    return null;
  }
}
export function verifySessionToken(token: string | undefined): boolean {
  const s = readSession(token);
  return !!s && !s.mustChange;
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
export async function startSession(mustChange = false) {
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, signSession(mustChange), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
    secure: https, // روی HTTPS کوکی هرگز روی اتصالِ ناامن فرستاده نمی‌شود
  });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifySessionToken(token);
}
/** نشستی که فقط برای عوض‌کردنِ رمزِ ضعیف باز شده */
export async function needsPasswordChange(): Promise<boolean> {
  return !!readSession((await cookies()).get(COOKIE)?.value)?.mustChange;
}
