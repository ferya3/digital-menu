"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Megaphone, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, num } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminNotifyAction, adminOwnerSmsAction, adminRunRemindersAction, adminSaveAnnouncementAction, adminSaveNotifyAction, type NotifyData } from "@/app/platform/actions";
import type { OwnerAudience } from "@/lib/platform-admin";
import { smsSegments } from "@/lib/sms-count";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const AUD: Record<OwnerAudience, string> = { all: "All venue owners", active: "Active subscription", trial: "On free trial", expired: "Expired", expiring: "Expiring within 7 days" };
const VARS = "{brand} brand name · {name} venue name · {days} days left · {link} dashboard link";

/** Character / SMS segment counter */
function SmsCount({ text }: { text: string }) {
  const c = smsSegments(text);
  return <span className="mt-1 block text-[11px] text-muted-foreground">{num(c.chars)} characters · {num(c.segments)} SMS{c.segments === 1 ? "" : " segments"}{c.unicode ? " (Unicode)" : ""}</span>;
}

/** Notifications: announcement in venue dashboards, automatic renewal reminders, bulk SMS to owners */
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
      {!d.smsReady && <p className="rounded-2xl bg-amber-500/15 p-3 text-sm font-semibold text-amber-800 lg:col-span-2 dark:text-amber-300">To send reminders and bulk SMS, set up Settings → Platform SMS (Twilio) first.</p>}

      <Box title="Announcement in all venue dashboards" action={<Megaphone className="size-5 text-primary" />}>
        <p className="text-xs text-muted-foreground">Shown at the top of every venue’s dashboard (e.g. “Scheduled maintenance tonight at 2 AM” or “Renewal sale”).</p>
        <Toggle checked={a.enabled} onChange={(v) => setA({ enabled: v })} label="Show announcement" />
        <textarea value={a.text} onChange={(e) => setA({ text: e.target.value })} rows={3} className={cn(smallField, "resize-y")} placeholder="Announcement text" />
        <div className="grid grid-cols-2 gap-2">
          <L t="Type"><select value={a.level} onChange={(e) => setA({ level: e.target.value as typeof a.level })} className={smallField}><option value="info">Info (blue)</option><option value="warning">Warning (yellow)</option></select></L>
          <L t="Until (optional)"><input type="date" value={a.until ? a.until.slice(0, 10) : ""} onChange={(e) => setA({ until: e.target.value })} className={smallField} /></L>
        </div>
        <Button className="rounded-xl" disabled={!!busy} onClick={() => run("ann", async () => unwrap(await adminSaveAnnouncementAction(a)), "✅ Announcement saved")}>Save announcement</Button>
      </Box>

      <Box title="Automatic renewal reminders (SMS)" action={<BellRing className="size-5 text-primary" />}>
        <Toggle checked={n.enabled} onChange={(v) => setN({ enabled: v })} label="Send automatically (checked every hour)" />
        <L t="Days before expiry" hint="e.g. 7, 3, 1 — each reminder is sent once per billing period">
          <input value={n.days.join(", ")} onChange={(e) => setN({ days: e.target.value.split(/[^\d]+/).map(Number).filter(Boolean) })} className={smallField} />
        </L>
        <L t="Reminder text" hint={VARS}><textarea value={n.template} onChange={(e) => setN({ template: e.target.value })} rows={3} className={cn(smallField, "resize-y")} /><SmsCount text={n.template} /></L>
        <Toggle checked={n.expired} onChange={(v) => setN({ expired: v })} label="Also send an SMS when the subscription expires" />
        {n.expired && <L t="Expiry SMS text"><textarea value={n.expiredTemplate} onChange={(e) => setN({ expiredTemplate: e.target.value })} rows={3} className={cn(smallField, "resize-y")} /><SmsCount text={n.expiredTemplate} /></L>}
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" disabled={!!busy} onClick={() => run("nt", async () => unwrap(await adminSaveNotifyAction(n)), "✅ Settings saved")}>Save</Button>
          <Button variant="outline" className="rounded-xl" disabled={!!busy || !d.smsReady}
            onClick={() => run("rr", async () => { const r = unwrap(await adminRunRemindersAction()); flash(`Sent ${num(r.sent)} · failed ${num(r.failed)} · already sent ${num(r.skipped)}`); }, "Check complete")}>
            <Play className="size-4" /> Run check now
          </Button>
        </div>
        {d.reminders.length > 0 && (
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {d.reminders.map((r) => <div key={r.key} className="flex justify-between rounded-xl bg-muted/50 px-3 py-1.5"><span>{r.slug} · {r.kind === "expired" ? "expired" : `${num(r.kind.slice(1))} days left`}</span><span className={r.status === "sent" ? "text-green-700 dark:text-green-400" : "text-primary"}>{r.status === "sent" ? "✓" : "✗"} {fmtDateTime(r.at)}</span></div>)}
          </div>
        )}
      </Box>

      <Box title="Bulk SMS to venue owners" className="lg:col-span-2" action={<Send className="size-5 text-primary" />}>
        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            <L t="Recipients">
              <select value={aud} onChange={(e) => setAud(e.target.value as OwnerAudience)} className={smallField}>
                {(Object.keys(AUD) as OwnerAudience[]).map((k) => <option key={k} value={k}>{AUD[k]} ({num(d.audienceCounts[k])})</option>)}
              </select>
            </L>
            <L t="Message" hint={VARS}><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className={cn(smallField, "resize-y")} placeholder="e.g. {brand}: renewal sale — 30% off with code SPRING26" /><SmsCount text={msg} /></L>
            <Button className="w-full rounded-xl" disabled={!!busy || !msg.trim() || !d.smsReady || !d.audienceCounts[aud]}
              onClick={() => { if (confirm(`Send this SMS to ${num(d.audienceCounts[aud])} recipients?`)) run("sms", async () => { unwrap(await adminOwnerSmsAction(msg, aud)); setMsg(""); }, "✅ Sending started"); }}>
              {busy === "sms" ? <Loader2 className="animate-spin" /> : <><Send className="size-4" /> Send to {num(d.audienceCounts[aud])} recipients</>}
            </Button>
          </div>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">History</span>
            {d.campaigns.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing sent yet</p> : d.campaigns.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border p-3 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{c.audience.startsWith("single:") ? `Only ${c.audience.slice(7)}` : AUD[c.audience as OwnerAudience] || c.audience}</span><span>{fmtDateTime(c.at)}</span></div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line">{c.message}</p>
                <div className="mt-1 text-xs"><span className="text-green-700 dark:text-green-400">✓ {num(c.sent)}</span>{c.failed > 0 && <span className="ms-3 text-primary">✗ {num(c.failed)}</span>}<span className="ms-3 text-muted-foreground">of {num(c.total)}{c.status === "running" ? " · sending…" : ""}</span></div>
              </div>
            ))}
          </div>
        </div>
      </Box>
    </div>
  );
}
