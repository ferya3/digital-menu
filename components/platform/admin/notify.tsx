"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Megaphone, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, toFa } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminNotifyAction, adminOwnerSmsAction, adminRunRemindersAction, adminSaveAnnouncementAction, adminSaveNotifyAction, type NotifyData } from "@/app/platform/actions";
import type { OwnerAudience } from "@/lib/platform-admin";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const AUD: Record<OwnerAudience, string> = { all: "همهٔ صاحبانِ مجموعه‌ها", active: "اشتراکِ فعال", trial: "دورهٔ آزمایشی", expired: "منقضی‌شده‌ها", expiring: "تا ۷ روزِ دیگر تمام می‌شود" };
const VARS = "{brand} نامِ برند · {name} نامِ مجموعه · {days} روزهای باقی‌مانده · {link} لینکِ پنل";

/** اطلاع‌رسانی: اعلان در پنلِ مجموعه‌ها، یادآوریِ خودکارِ تمدید، پیامکِ گروهی به صاحبان */
export function Notify({ flash }: { flash: Flash }) {
  const [d, setD] = useState<NotifyData | null>(null);
  const [msg, setMsg] = useState("");
  const [aud, setAud] = useState<OwnerAudience>("all");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => adminNotifyAction().then((r) => setD(unwrap(r))).catch((e) => flash("❌ " + err(e))), [flash]);
  useEffect(() => { load(); }, [load]);
  const running = d?.campaigns.some((c) => c.status === "running");
  useEffect(() => { if (!running) return; const t = window.setInterval(load, 2000); return () => window.clearInterval(t); }, [running, load]);
  if (!d) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); flash(ok); load(); } catch (e) { flash("❌ " + err(e)); } finally { setBusy(""); }
  };
  const n = d.notify, a = d.announcement;
  const setN = (p: Partial<typeof n>) => setD({ ...d, notify: { ...n, ...p } });
  const setA = (p: Partial<typeof a>) => setD({ ...d, announcement: { ...a, ...p } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {!d.smsReady && <p className="rounded-2xl bg-amber-500/15 p-3 text-sm font-semibold text-amber-800 lg:col-span-2 dark:text-amber-300">برای یادآوری و پیامکِ گروهی، اول «تنظیمات ← پیامکِ پلتفرم» را تنظیم کنید.</p>}

      <Box title="اعلان در پنلِ همهٔ مجموعه‌ها" action={<Megaphone className="size-5 text-primary" />}>
        <p className="text-xs text-muted-foreground">بالای پنلِ مدیریتِ همهٔ مجموعه‌ها نمایش داده می‌شود (مثلاً «امشب ساعت ۲ به‌روزرسانی داریم» یا «جشنوارهٔ تمدید»).</p>
        <Toggle checked={a.enabled} onChange={(v) => setA({ enabled: v })} label="نمایشِ اعلان" />
        <textarea value={a.text} onChange={(e) => setA({ text: e.target.value })} rows={3} className={cn(smallField, "resize-y")} placeholder="متنِ اعلان" />
        <div className="grid grid-cols-2 gap-2">
          <L t="نوع"><select value={a.level} onChange={(e) => setA({ level: e.target.value as typeof a.level })} className={smallField}><option value="info">اطلاع‌رسانی (آبی)</option><option value="warning">هشدار (زرد)</option></select></L>
          <L t="تا تاریخ (اختیاری)"><input type="date" value={a.until ? a.until.slice(0, 10) : ""} onChange={(e) => setA({ until: e.target.value })} className={smallField} /></L>
        </div>
        <Button className="rounded-xl" disabled={!!busy} onClick={() => run("ann", async () => unwrap(await adminSaveAnnouncementAction(a)), "✅ اعلان ذخیره شد")}>ذخیرهٔ اعلان</Button>
      </Box>

      <Box title="یادآوریِ خودکارِ تمدید (پیامک)" action={<BellRing className="size-5 text-primary" />}>
        <Toggle checked={n.enabled} onChange={(v) => setN({ enabled: v })} label="ارسالِ خودکار (هر ساعت بررسی می‌شود)" />
        <L t="چند روز قبل از پایان" hint="مثلاً ۷، ۳، ۱ — هر یادآوری برای هر دوره فقط یک‌بار">
          <input value={n.days.join("، ")} onChange={(e) => setN({ days: e.target.value.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x))).split(/[^\d]+/).map(Number).filter(Boolean) })} className={smallField} dir="ltr" />
        </L>
        <L t="متنِ یادآوری" hint={VARS}><textarea value={n.template} onChange={(e) => setN({ template: e.target.value })} rows={3} className={cn(smallField, "resize-y")} /></L>
        <Toggle checked={n.expired} onChange={(v) => setN({ expired: v })} label="پیامک در روزِ تمام‌شدن هم فرستاده شود" />
        {n.expired && <L t="متنِ پیامکِ تمام‌شدن"><textarea value={n.expiredTemplate} onChange={(e) => setN({ expiredTemplate: e.target.value })} rows={3} className={cn(smallField, "resize-y")} /></L>}
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" disabled={!!busy} onClick={() => run("nt", async () => unwrap(await adminSaveNotifyAction(n)), "✅ تنظیمات ذخیره شد")}>ذخیره</Button>
          <Button variant="outline" className="rounded-xl" disabled={!!busy || !d.smsReady}
            onClick={() => run("rr", async () => { const r = unwrap(await adminRunRemindersAction()); flash(`ارسال ${toFa(r.sent)} · ناموفق ${toFa(r.failed)} · قبلاً فرستاده ${toFa(r.skipped)}`); }, "بررسی انجام شد")}>
            <Play className="size-4" /> همین حالا بررسی کن
          </Button>
        </div>
        {d.reminders.length > 0 && (
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {d.reminders.map((r) => <div key={r.key} className="flex justify-between rounded-xl bg-muted/50 px-3 py-1.5"><span>{r.slug} · {r.kind === "expired" ? "تمام‌شدن" : `${toFa(r.kind.slice(1))} روز مانده`}</span><span className={r.status === "sent" ? "text-green-700 dark:text-green-400" : "text-primary"}>{r.status === "sent" ? "✓" : "✗"} {faDateTime(r.at)}</span></div>)}
          </div>
        )}
      </Box>

      <Box title="پیامکِ گروهی به صاحبانِ مجموعه‌ها" className="lg:col-span-2" action={<Send className="size-5 text-primary" />}>
        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <L t="گیرندگان">
              <select value={aud} onChange={(e) => setAud(e.target.value as OwnerAudience)} className={smallField}>
                {(Object.keys(AUD) as OwnerAudience[]).map((k) => <option key={k} value={k}>{AUD[k]} ({toFa(d.audienceCounts[k])} نفر)</option>)}
              </select>
            </L>
            <L t="متن" hint={VARS}><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className={cn(smallField, "resize-y")} placeholder="مثلاً: {brand} — جشنوارهٔ تمدید: ۳۰٪ تخفیف با کدِ NOROOZ" /></L>
            <Button className="w-full rounded-xl" disabled={!!busy || !msg.trim() || !d.smsReady || !d.audienceCounts[aud]}
              onClick={() => { if (confirm(`پیامک برای ${toFa(d.audienceCounts[aud])} نفر فرستاده شود؟`)) run("sms", async () => { unwrap(await adminOwnerSmsAction(msg, aud)); setMsg(""); }, "ارسال شروع شد ✅"); }}>
              {busy === "sms" ? <Loader2 className="animate-spin" /> : <><Send className="size-4" /> ارسال به {toFa(d.audienceCounts[aud])} نفر</>}
            </Button>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">تاریخچه</span>
            {d.campaigns.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">هنوز ارسالی نبوده</p> : d.campaigns.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border p-3 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{c.audience.startsWith("single:") ? `فقط ${c.audience.slice(7)}` : AUD[c.audience as OwnerAudience] || c.audience}</span><span>{faDateTime(c.at)}</span></div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line">{c.message}</p>
                <div className="mt-1 text-xs"><span className="text-green-700 dark:text-green-400">✓ {toFa(c.sent)}</span>{c.failed > 0 && <span className="ms-3 text-primary">✗ {toFa(c.failed)}</span>}<span className="ms-3 text-muted-foreground">از {toFa(c.total)}{c.status === "running" ? " · در حال ارسال…" : ""}</span></div>
              </div>
            ))}
          </div>
        </div>
      </Box>
    </div>
  );
}
