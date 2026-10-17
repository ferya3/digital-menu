import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/queries";
import { sendSmsWith } from "@/lib/sms-send";
import { DEFAULT_SMS, isValidPhone, normalizePhone } from "@/lib/otp";
import type { SmsSettings } from "@/lib/types";
import { currentTenant } from "@/lib/tenant-context";

const MAX_RECIPIENTS = 3000;
const MAX_CHARS = 600;
/** پیشوند/پسوندی که پنل‌های ارسال با لینک برای پیامکِ تبلیغاتی می‌خواهند */
export const CANCEL_FOOTER = "لغو 11";

const g = globalThis as unknown as { __smsRunning?: Set<string> };
const running = (g.__smsRunning ??= new Set());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

/** ارسالِ یک پیامکِ متنی با سامانهٔ تنظیم‌شدهٔ همین مجموعه؛ در خطا Error با پیامِ فارسی پرتاب می‌کند */
export async function sendSmsText(phone: string, text: string): Promise<string> {
  return sendSmsWith({ ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) }, phone, text);
}

export interface Campaign {
  id: string; message: string; createdAt: string; status: "running" | "done" | "failed" | "interrupted" | "cancelled";
  note: string; total: number; sent: number; failed: number; queued: number;
}

function counts(id: string) {
  const r = db()
    .prepare("SELECT SUM(status='sent') s, SUM(status='failed') f, SUM(status='queued') q, COUNT(*) t FROM sms_outbox WHERE campaign_id=?")
    .get(id) as unknown as { s: number | null; f: number | null; q: number | null; t: number };
  return { sent: r.s || 0, failed: r.f || 0, queued: r.q || 0, total: r.t || 0 };
}

export function listCampaigns(): Campaign[] {
  const rows = db().prepare("SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT 30").all() as unknown as {
    id: string; message: string; created_at: string; status: Campaign["status"]; note: string;
  }[];
  return rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at, status: r.status, note: r.note, ...counts(r.id) }));
}

/** ساختِ کمپین و شروعِ ارسال در پس‌زمینه. فقط به مشتریانِ ثبت‌شده که «لغو» نکرده‌اند ارسال می‌شود. */
export function startCampaign(message: string, phones: string[], addCancel: boolean) {
  const base = message.trim();
  if (!base) throw new Error("متن پیامک را بنویسید");
  const text = addCancel && !base.includes(CANCEL_FOOTER) ? `${base}\n${CANCEL_FOOTER}` : base;
  if ([...text].length > MAX_CHARS) throw new Error(`متن پیامک بیش از ${MAX_CHARS} نویسه است`);
  const d = db();
  const known = new Map(
    (d.prepare("SELECT phone, sms_optout o FROM customers").all() as unknown as { phone: string; o: number }[]).map((r) => [r.phone, !!r.o])
  );
  const list: string[] = [];
  let skipped = 0;
  for (const raw of new Set(phones.map(normalizePhone))) {
    if (!isValidPhone(raw) || !known.has(raw) || known.get(raw)) { skipped++; continue; }
    list.push(raw);
  }
  if (!list.length) throw new Error("گیرندهٔ معتبری نیست (شماره‌های لغوشده یا نامعتبر حذف می‌شوند)");
  if (list.length > MAX_RECIPIENTS) throw new Error(`حداکثر ${MAX_RECIPIENTS} گیرنده در هر ارسال مجاز است`);
  const id = `sms_${crypto.randomUUID().slice(0, 8)}`;
  d.prepare("INSERT INTO sms_campaigns (id, message, created_at, total, status) VALUES (?,?,?,?, 'running')").run(id, text, now(), list.length);
  const ins = d.prepare("INSERT INTO sms_outbox (campaign_id, phone) VALUES (?,?)");
  d.exec("BEGIN");
  try { for (const p of list) ins.run(id, p); d.exec("COMMIT"); } catch (e) { d.exec("ROLLBACK"); throw e; }
  void run(id);
  return { id, total: list.length, skipped };
}

/** حلقهٔ ارسال: تک‌تک، با فاصلهٔ کوتاه؛ اگر پنل پشت‌سرهم ۳ بار خطا داد (مثلاً نبودِ اعتبار) متوقف می‌شود */
async function run(id: string) {
  const key = `${currentTenant().slug}:${id}`;
  if (running.has(key)) return;
  running.add(key);
  const d = db();
  try {
    const camp = d.prepare("SELECT message FROM sms_campaigns WHERE id=?").get(id) as unknown as { message: string } | undefined;
    if (!camp) return;
    d.prepare("UPDATE sms_campaigns SET status='running', note='' WHERE id=?").run(id);
    let consecutive = 0;
    for (;;) {
      const st = (d.prepare("SELECT status FROM sms_campaigns WHERE id=?").get(id) as unknown as { status: string } | undefined)?.status;
      if (st === "cancelled") return;
      const next = d.prepare("SELECT phone FROM sms_outbox WHERE campaign_id=? AND status='queued' LIMIT 1").get(id) as unknown as { phone: string } | undefined;
      if (!next) break;
      try {
        await sendSmsText(next.phone, camp.message);
        d.prepare("UPDATE sms_outbox SET status='sent', detail='', sent_at=? WHERE campaign_id=? AND phone=?").run(now(), id, next.phone);
        consecutive = 0;
      } catch (e) {
        const detail = (e instanceof Error ? e.message : "خطا").slice(0, 200);
        d.prepare("UPDATE sms_outbox SET status='failed', detail=? WHERE campaign_id=? AND phone=?").run(detail, id, next.phone);
        if (++consecutive >= 3) {
          d.prepare("UPDATE sms_campaigns SET status='failed', note=? WHERE id=?").run(`ارسال متوقف شد: ${detail}`, id);
          return;
        }
      }
      await sleep(300);
    }
    d.prepare("UPDATE sms_campaigns SET status='done' WHERE id=? AND status='running'").run(id);
  } catch (e) {
    d.prepare("UPDATE sms_campaigns SET status='failed', note=? WHERE id=?").run(String(e instanceof Error ? e.message : e).slice(0, 200), id);
  } finally {
    running.delete(key);
  }
}

/** ادامه (نیمه‌کاره/متوقف)، تلاش دوباره برای ناموفق‌ها، یا لغو */
export function controlCampaign(id: string, action: "resume" | "retry" | "cancel") {
  const d = db();
  if (action === "cancel") {
    d.prepare("UPDATE sms_campaigns SET status='cancelled', note='لغو شد' WHERE id=? AND status IN ('running','interrupted','failed')").run(id);
    return { ok: true };
  }
  if (running.has(`${currentTenant().slug}:${id}`)) throw new Error("این ارسال هم‌اکنون در حال اجراست");
  if (action === "retry") d.prepare("UPDATE sms_outbox SET status='queued', detail='' WHERE campaign_id=? AND status='failed'").run(id);
  if (!counts(id).queued) throw new Error("موردِ باقی‌مانده‌ای برای ارسال نیست");
  void run(id);
  return { ok: true };
}
