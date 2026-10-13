/**
 * نتیجهٔ خطا از Server Action.
 * روی نسخهٔ واقعی (production) Next پیامِ خطاهای پرتاب‌شده را پنهان می‌کند و فقط یک متنِ انگلیسیِ گنگ می‌رسد؛
 * برای همین اکشن‌ها خطا را «برمی‌گردانند» و کلاینت با unwrap دوباره آن را (با پیامِ فارسیِ درست) پرتاب می‌کند.
 */
export type ActionFail = { __error: string };

export function unwrap<T>(r: T | ActionFail): T {
  if (r && typeof r === "object" && "__error" in (r as object)) throw new Error((r as ActionFail).__error);
  return r as T;
}
