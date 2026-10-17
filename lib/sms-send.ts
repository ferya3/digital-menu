import "server-only";
import { sendAfeSms } from "@/lib/sms-afe";
import type { SmsSettings } from "@/lib/types";

/** ارسالِ پیامکِ متنی با تنظیماتِ داده‌شده (هم برای هر مجموعه و هم برای خودِ پلتفرم) */
export async function sendSmsWith(sms: SmsSettings, phone: string, text: string): Promise<string> {
  if (sms.provider === "wide") {
    return sendAfeSms({ username: sms.username || "", password: sms.password || "", sender: sms.sender || "", domain: sms.domain }, phone, text);
  }
  if (sms.provider === "kavenegar") {
    if (!sms.apiKey) throw new Error("کلید API کاوه‌نگار ثبت نشده است");
    const body = new URLSearchParams({ receptor: phone, message: text });
    if (sms.sender) body.set("sender", sms.sender);
    const res = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(sms.apiKey)}/sms/send.json`, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { return?: { status?: number; message?: string } };
    if (data?.return?.status !== 200) throw new Error(data?.return?.message || "ارسال با کاوه‌نگار انجام نشد");
    return "ارسال شد";
  }
  throw new Error("سامانهٔ پیامک انتخاب نشده — از تنظیمات ← سامانهٔ پیامک، «وایدی» یا «کاوه‌نگار» را انتخاب کنید");
}
