import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { addCustomer, getSetting } from "@/lib/queries";
import { readSigned, signData } from "@/lib/auth";
import { sendAfeSms } from "@/lib/sms-afe";
import type { CafeInfo, SmsSettings } from "@/lib/types";
import { currentTenant } from "@/lib/tenant-context";

export const DEFAULT_SMS: SmsSettings = {
  provider: "none", apiKey: "", template: "verify", otpEnabled: false,
  username: "", password: "", sender: "", domain: "wide.ir",
};
const COOKIE = "cafe_phone";
const VERIFIED_TTL = 12 * 3600 * 1000;

// کدهای موقت در حافظه (مثل نسخهٔ قبلی): phone -> { code, exp, attempts, lastSent }
type Rec = { code: string; exp: number; attempts: number; lastSent: number };
const g = globalThis as unknown as { __otp?: Map<string, Rec>; __otpIp?: Map<string, { n: number; t: number }> };
const codes = (g.__otp ??= new Map());
const ipHits = (g.__otpIp ??= new Map());

/** نرمال‌سازی شماره (ارقام فارسی، +98، 0098 …) به 09xxxxxxxxx */
export function normalizePhone(raw: string): string {
  let p = String(raw || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
  if (p.startsWith("0098")) p = "0" + p.slice(4);
  else if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2);
  if (p.length === 10 && p.startsWith("9")) p = "0" + p;
  return p;
}
export const isValidPhone = (p: string) => /^09\d{9}$/.test(p);

async function sendSms(phone: string, code: string): Promise<{ demo: boolean }> {
  const sms = { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) };
  if (sms.provider === "wide") {
    const cafe = getSetting<CafeInfo>("cafe", { name: "کافه", logo: "", tagline: "", currency: "toman" });
    try {
      await sendAfeSms(
        { username: sms.username || "", password: sms.password || "", sender: sms.sender || "", domain: sms.domain },
        phone,
        `${cafe.name}\nکد تأیید شما: ${code}`
      );
    } catch (e) {
      console.error("[OTP] wide:", e instanceof Error ? e.message : e);
      throw new Error("ارسال پیامک انجام نشد؛ کمی بعد دوباره تلاش کنید");
    }
    return { demo: false };
  }
  if (sms.provider === "kavenegar" && sms.apiKey) {
    const url =
      `https://api.kavenegar.com/v1/${encodeURIComponent(sms.apiKey)}/verify/lookup.json` +
      `?receptor=${encodeURIComponent(phone)}&token=${encodeURIComponent(code)}` +
      `&template=${encodeURIComponent(sms.template || "verify")}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { return?: { status?: number } };
      if (data?.return?.status !== 200) throw new Error();
    } catch {
      throw new Error("ارسال پیامک انجام نشد؛ کمی بعد دوباره تلاش کنید");
    }
    return { demo: false };
  }
  // حالت آزمایشی: کد فقط روی صفحه نمایش داده می‌شود
  console.log(`[OTP] کد ${code} برای ${phone} (حالت آزمایشی)`);
  return { demo: true };
}

export async function requestOtp(raw: string): Promise<{ ok: boolean; demoCode?: string }> {
  const ip = ((await headers()).get("x-forwarded-for") || "x").split(",")[0].trim();
  const rec = ipHits.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - rec.t > 10 * 60_000) { rec.n = 0; rec.t = Date.now(); }
  if (rec.n >= 6) throw new Error("تعداد درخواست زیاد است؛ کمی بعد دوباره امتحان کنید");
  rec.n += 1;
  ipHits.set(ip, rec);

  const phone = normalizePhone(raw);
  if (!isValidPhone(phone)) throw new Error("شماره موبایل نامعتبر است");
  const key = `${currentTenant().slug}:${phone}`;
  const prev = codes.get(key);
  if (prev && Date.now() - prev.lastSent < 60_000) throw new Error("لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید");
  const code = String(crypto.randomInt(10000, 100000));
  codes.set(key, { code, exp: Date.now() + 2 * 60_000, attempts: 0, lastSent: Date.now() });
  const { demo } = await sendSms(phone, code);
  return { ok: true, demoCode: demo ? code : undefined };
}

export async function verifyOtp(raw: string, input: string, table: string): Promise<{ ok: boolean; phone: string }> {
  const phone = normalizePhone(raw);
  const key = `${currentTenant().slug}:${phone}`;
  const rec = codes.get(key);
  if (!rec) throw new Error("ابتدا کد تأیید را درخواست کنید");
  if (Date.now() > rec.exp) { codes.delete(key); throw new Error("کد منقضی شده؛ دوباره درخواست دهید"); }
  if (rec.attempts >= 5) { codes.delete(key); throw new Error("تعداد تلاش زیاد است؛ دوباره درخواست دهید"); }
  rec.attempts += 1;
  if (normalizePhone(input) !== rec.code) throw new Error("کد واردشده نادرست است");
  codes.delete(key);
  addCustomer(phone, table);
  (await cookies()).set(COOKIE, signData({ phone }, VERIFIED_TTL), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: VERIFIED_TTL / 1000,
  });
  return { ok: true, phone };
}

/** آیا این شماره در همین مرورگر با کد پیامکی تأیید شده؟ */
export async function isVerifiedPhone(raw: string): Promise<boolean> {
  const data = readSigned<{ phone: string }>((await cookies()).get(COOKIE)?.value);
  return !!data && data.phone === normalizePhone(raw);
}

/** پیامکِ آزمایشی از پنلِ مدیر (با همان سامانهٔ تنظیم‌شده) */
export async function sendTestSms(raw: string): Promise<string> {
  const phone = normalizePhone(raw);
  if (!isValidPhone(phone)) throw new Error("شماره موبایل نامعتبر است");
  const sms = { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) };
  const cafe = getSetting<CafeInfo>("cafe", { name: "کافه", logo: "", tagline: "", currency: "toman" });
  if (sms.provider === "wide") {
    return sendAfeSms(
      { username: sms.username || "", password: sms.password || "", sender: sms.sender || "", domain: sms.domain },
      phone,
      `${cafe.name}\nپیامک آزمایشی سامانهٔ منو ✅`
    );
  }
  if (sms.provider === "kavenegar") {
    await sendSms(phone, "12345");
    return "پیامک آزمایشی (الگوی کد تأیید با کد ۱۲۳۴۵) ارسال شد";
  }
  throw new Error("سامانهٔ پیامک انتخاب نشده (حالت آزمایشی)");
}
