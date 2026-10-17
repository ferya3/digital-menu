import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, tenantOrNull } from "@/lib/tenant-context";

/**
 * ارسالِ پیامک با «ارسال با لینک»ِ عصر فرا ارتباط و نمایندگی‌هایش (wide.ir، afe.ir، …).
 * برگردانِ همان منطقِ مقاومِ ریپوزیتوریِ فیش حقوق (lib/sms.php):
 *  - مسیرِ استاندارد /Url/SendSMS.aspx با پارامترهای Username, Password, Number, Mobile, SMS
 *  - اول HTTPS (رمزِ پنل روی شبکهٔ رمزنشده نرود)؛ اگر وصل نشد، همان آدرس با http
 *  - متنِ چندخطی، و اگر پاسخ نامشخص بود نسخهٔ تک‌خطی
 *  - دامنهٔ اصلی تا ۳ بار با فاصلهٔ ۱٫۳ ثانیه (محدودیتِ نرخِ موقت)، بعد دامنه‌های جایگزین
 *  - خطای واقعیِ پنل (مثل نبودِ اعتبار) بی‌درنگ برگردانده می‌شود
 */
export interface AfeConfig {
  username: string;
  password: string;
  /** شمارهٔ اختصاصی (خطِ ارسال) */
  sender: string;
  /** دامنهٔ پنل (مثلاً wide.ir)؛ خالی = wide.ir */
  domain?: string;
}

const TIMEOUT_MS = 15_000;
// لاگِ خطا کنارِ دادهٔ همان مجموعه (پیامک‌های خودِ پلتفرم در data/)
const logFile = () => path.join(tenantOrNull()?.dir || DATA_DIR, "sms-errors.log");

/** آدرسِ ارسال از دامنهٔ واردشده (فقط نامِ دامنه؛ برای جلوگیری از درخواست به آدرس‌های دلخواه) */
function sendUrl(domain: string): string | null {
  let d = domain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
  if (!d) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  return `https://www.${d}/Url/SendSMS.aspx`;
}

/** فهرستِ آدرس‌های نامزد: دامنهٔ تنظیم‌شده + wide.ir + afe.ir */
function candidates(c: AfeConfig): string[] {
  // قلابِ تست (مثل AFE_CANDIDATES در ریپوی فیش)؛ در محیطِ واقعی تنظیم نمی‌شود
  const override = process.env.AFE_CANDIDATES;
  if (override) return override.split(",").map((x) => x.trim()).filter(Boolean);
  const list: string[] = [];
  const custom = c.domain ? sendUrl(c.domain) : null;
  if (custom) list.push(custom);
  list.push("https://www.wide.ir/Url/SendSMS.aspx", "https://www.afe.ir/Url/SendSMS.aspx");
  return [...new Set(list)];
}

/** متنِ وضعیت: بخشِ پیش از اولین تگ HTML (مطابق نمونه‌کدِ رسمی) */
const statusText = (body: string) => {
  const b = body.trim();
  const i = b.indexOf("<");
  return (i === -1 ? b : b.slice(0, i)).trim();
};
/** موفق: «Send Successfully» یا یک شناسهٔ عددی */
const isSuccess = (body: string) => {
  if (/send successfully/i.test(body)) return true;
  const s = statusText(body).replace(/[,\s]/g, "");
  return s !== "" && /^\d+$/.test(s);
};

async function get(url: string): Promise<{ code: number; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, redirect: "follow" });
    return { code: res.status, body: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

/** یک درخواست؛ اگر HTTPS وصل نشد با http دوباره (برخی پنل‌های قدیمی فقط http دارند) */
async function requestTo(base: string, c: AfeConfig, phone: string, text: string) {
  const qs = new URLSearchParams({ Username: c.username.trim(), Password: c.password.trim(), Number: c.sender.trim(), Mobile: phone, SMS: text });
  const url = `${base}?${qs}`;
  try {
    return await get(url);
  } catch (e) {
    if (!url.startsWith("https://")) throw e;
    return await get("http://" + url.slice("https://".length));
  }
}

function logFailure(host: string, code: number, body: string, phone: string) {
  try {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    const clean = body.replace(/\s+/g, " ").trim().slice(0, 400);
    fs.appendFileSync(logFile(), `[${new Date().toISOString()}] host=${host} http=${code} to=${phone}\n  ${clean}\n`);
  } catch {}
}

type Attempt = { result: "sent" | "error" | "unknown"; detail: string; code: number; body: string };

/** یک تلاش روی یک دامنه (چندخطی، سپس تک‌خطی) */
async function attempt(c: AfeConfig, phone: string, text: string, base: string): Promise<Attempt> {
  const variants = [text];
  const collapsed = text.replace(/\s*\r?\n\s*/g, " - ").trim();
  if (collapsed && collapsed !== text) variants.push(collapsed);
  let last = { code: 0, body: "" };
  for (const v of variants) {
    let r: { code: number; body: string };
    try {
      r = await requestTo(base, c, phone, v);
    } catch {
      return { result: "unknown", detail: "عدم دسترسی", code: 0, body: "connect error" };
    }
    if (isSuccess(r.body)) return { result: "sent", detail: statusText(r.body), ...r };
    const st = statusText(r.body);
    if (st) return { result: "error", detail: st, ...r }; // خطای واقعیِ پنل
    last = r;
  }
  return { result: "unknown", detail: "پاسخ نامشخص", ...last };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ارسال؛ در صورتِ خطا Error با پیامِ فارسی پرتاب می‌کند */
export async function sendAfeSms(c: AfeConfig, phone: string, text: string): Promise<string> {
  if (!c.username.trim() || !c.password.trim()) throw new Error("نام کاربری/رمز پنل پیامک در تنظیمات ثبت نشده است");
  if (!c.sender.trim()) throw new Error("شمارهٔ اختصاصی (خط ارسال) در تنظیمات ثبت نشده است");
  const [primary, ...rest] = candidates(c);
  const host = (b: string) => new URL(b).host;

  // دامنهٔ اصلی: تا ۳ بار با فاصله (عبور از محدودیتِ نرخِ موقت)
  for (let i = 1; i <= 3; i++) {
    const r = await attempt(c, phone, text, primary);
    if (r.result === "sent") return `پیامک ارسال شد (پاسخ پنل: ${r.detail.slice(0, 80)})`;
    if (r.result === "error") throw new Error(r.detail.slice(0, 160));
    logFailure(host(primary), r.code, r.body, phone);
    if (i < 3) await sleep(1300);
  }
  // دامنه‌های جایگزین (یک‌بار)
  for (const base of rest) {
    const r = await attempt(c, phone, text, base);
    if (r.result === "sent") return `پیامک ارسال شد (پاسخ پنل: ${r.detail.slice(0, 80)})`;
    if (r.result === "error") throw new Error(r.detail.slice(0, 160));
    logFailure(host(base), r.code, r.body, phone);
  }
  throw new Error("ارسال نشد — پاسخ نامشخص از پنل (احتمالاً محدودیت موقت). جزئیات در data/sms-errors.log ثبت شد.");
}
