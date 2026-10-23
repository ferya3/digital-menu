import "server-only";
import { cookies } from "next/headers";
import { checkCode, hit, issueCode } from "@/lib/limits";
import { clientIp, cookieOpts } from "@/lib/security";
import { addCustomer, getSetting } from "@/lib/queries";
import { readSigned, signData } from "@/lib/auth";
import { sendSmsWith } from "@/lib/sms-send";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type { CafeInfo, SmsSettings } from "@/lib/types";
import { currentTenant } from "@/lib/tenant-context";

export const DEFAULT_SMS: SmsSettings = { provider: "none", accountSid: "", authToken: "", from: "", otpEnabled: false };
const COOKIE = "cafe_phone";
const VERIFIED_TTL = 12 * 3600 * 1000;

export { normalizePhone, isValidPhone };

const smsSettings = () => ({ ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) });
const cafeName = () => getSetting<CafeInfo>("cafe", { name: "Our café", logo: "", tagline: "", currency: "USD" }).name;

async function sendSms(phone: string, code: string): Promise<{ demo: boolean }> {
  const sms = smsSettings();
  if (sms.provider === "twilio") {
    try {
      await sendSmsWith(sms, phone, `${cafeName()}: your verification code is ${code}`);
    } catch (e) {
      console.error("[OTP] twilio:", e instanceof Error ? e.message : e);
      throw new Error("Could not send the SMS — please try again in a moment");
    }
    return { demo: false };
  }
  // Demo mode (no SMS provider): the code is shown on screen only
  console.log(`[OTP] code ${code} for ${phone} (demo mode)`);
  return { demo: true };
}

export async function requestOtp(raw: string): Promise<{ ok: boolean; demoCode?: string }> {
  const phone = normalizePhone(raw);
  if (!isValidPhone(phone)) throw new Error("Invalid phone number — include your country code, e.g. +1 555 123 4567");
  const slug = currentTenant().slug;
  // Persistent rate limits (survive restarts): 6 per IP and 5 per number every 10 minutes
  hit(`otp-ip:${slug}:${await clientIp()}`, 6, 10 * 60_000);
  hit(`otp-phone:${slug}:${phone}`, 5, 10 * 60_000);
  const code = issueCode(`otp:${slug}:${phone}`, 2 * 60_000);
  const { demo } = await sendSms(phone, code);
  return { ok: true, demoCode: demo ? code : undefined };
}

export async function verifyOtp(raw: string, input: string, table: string): Promise<{ ok: boolean; phone: string }> {
  const phone = normalizePhone(raw);
  const slug = currentTenant().slug;
  // On top of 5 attempts per code: at most 15 wrong attempts per hour per number
  hit(`otp-verify:${slug}:${phone}`, 15, 3600_000);
  checkCode(`otp:${slug}:${phone}`, String(input || "").replace(/\D/g, ""));
  addCustomer(phone, table);
  (await cookies()).set(COOKIE, signData({ phone }, VERIFIED_TTL), await cookieOpts(VERIFIED_TTL / 1000));
  return { ok: true, phone };
}

/** Has this number been verified with an SMS code in this browser? */
export async function isVerifiedPhone(raw: string): Promise<boolean> {
  const data = readSigned<{ phone: string }>((await cookies()).get(COOKIE)?.value);
  return !!data && data.phone === normalizePhone(raw);
}

/** Test SMS from the staff panel (uses the configured provider) */
export async function sendTestSms(raw: string): Promise<string> {
  const phone = normalizePhone(raw);
  if (!isValidPhone(phone)) throw new Error("Invalid phone number — include your country code, e.g. +1 555 123 4567");
  const sms = smsSettings();
  if (sms.provider !== "twilio") throw new Error("No SMS provider configured (demo mode)");
  return sendSmsWith(sms, phone, `${cafeName()}: test message from your digital menu ✅`);
}
