"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellOff, Check, Download, Loader2, MessageSquareText, Pause, Play, RotateCcw, Search, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTime, num } from "@/lib/utils";
import { smsSegments } from "@/lib/sms-count";
import { unwrap } from "@/lib/action-result";
import {
  staffSetOptOutAction, staffSettingsAction, staffSmsCampaignsAction, staffSmsControlAction,
  staffSmsPreviewAction, staffStartSmsCampaignAction,
} from "@/app/staff/actions";
import type { StaffCustomer } from "@/lib/queries";
import type { Campaign } from "@/lib/bulk-sms";
import { Empty, Panel, Switch, inputCls, useStaff } from "@/components/staff/kit";

/** Opt-out footer for marketing SMS (same text the server appends) */
const CANCEL_FOOTER = "Reply STOP to unsubscribe";

export function CustomersSection({ items, onChange }: { items: StaffCustomer[]; onChange: (fn: (l: StaffCustomer[]) => StaffCustomer[]) => void }) {
  const [tab, setTab] = useState<"list" | "sms">("list");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold">
        {([["list", "Customers", Users], ["sms", "Bulk SMS", MessageSquareText]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 transition", tab === id ? "bg-card shadow" : "text-muted-foreground")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "list" ? <CustomerList items={items} onChange={onChange} /> : <BulkSms items={items} />}
    </div>
  );
}

/* ====================== Customer list ====================== */
function CustomerList({ items, onChange }: { items: StaffCustomer[]; onChange: (fn: (l: StaffCustomer[]) => StaffCustomer[]) => void }) {
  const { flash } = useStaff();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const d = q.replace(/\D/g, "");
    return d ? items.filter((c) => c.phone.replace(/\D/g, "").includes(d)) : items;
  }, [items, q]);

  function exportCsv() {
    const iso = (v: string) => { const d = new Date(v); return isNaN(+d) ? v : d.toISOString(); };
    const rows = [["Phone", "Tables", "Visits", "First visit", "Last visit", "Marketing SMS"]];
    items.forEach((c) => rows.push([c.phone, c.tables.join(" | "), String(c.visits), iso(c.firstSeen), iso(c.lastSeen), c.optOut ? "Unsubscribed" : "Subscribed"]));
    const csv = "\ufeff" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  async function toggleOptOut(c: StaffCustomer) {
    try {
      unwrap(await staffSetOptOutAction(c.phone, !c.optOut));
      onChange((l) => l.map((x) => (x.phone === c.phone ? { ...x, optOut: !c.optOut } : x)));
    } catch (e) { flash(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <Panel
      title="Customer phone list"
      icon={<Users className="size-5 text-primary" />}
      count={num(items.length)}
      action={items.length > 0 && <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>}
    >
      {items.length === 0 ? (
        <Empty text="No phone numbers yet — turn on customer phone verification in Settings and numbers will be collected here" />
      ) : (
        <>
          <div className="relative mb-3 max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number" className={cn(inputCls, "pl-9")} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-left font-semibold">#</th>
                  <th className="p-2.5 text-left font-semibold">Phone</th>
                  <th className="p-2.5 text-left font-semibold">Tables</th>
                  <th className="p-2.5 text-left font-semibold">Visits</th>
                  <th className="p-2.5 text-left font-semibold">Last visit</th>
                  <th className="p-2.5 text-left font-semibold">Marketing SMS</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.phone} className={cn("border-t border-border", c.optOut && "text-muted-foreground")}>
                    <td className="p-2.5 text-muted-foreground">{num(i + 1)}</td>
                    <td className="whitespace-nowrap p-2.5 font-bold">{c.phone}</td>
                    <td className="p-2.5">{c.tables.map((t) => num(t)).join(", ") || "—"}</td>
                    <td className="p-2.5">{num(c.visits || 1)}</td>
                    <td className="p-2.5 text-muted-foreground">{fmtDateTime(c.lastSeen)}</td>
                    <td className="p-2.5">
                      <button onClick={() => toggleOptOut(c)} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition", c.optOut ? "bg-primary/10 text-primary" : "bg-green-600/10 text-green-700 dark:text-green-400")} title="Click to toggle">
                        {c.optOut ? <><BellOff className="size-3.5" /> Unsubscribed</> : <><Check className="size-3.5" /> Subscribed</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ====================== Bulk SMS ====================== */
const DAY = 86_400_000;
const AUDIENCES = [
  { id: "all", label: "All customers", test: () => true },
  { id: "loyal", label: "Loyal — 3 or more visits", test: (c: StaffCustomer) => c.visits >= 3 },
  { id: "once", label: "Visited only once", test: (c: StaffCustomer) => c.visits <= 1 },
  { id: "recent30", label: "Active — last 30 days", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) <= 30 * DAY },
  { id: "recent90", label: "Last 90 days", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) <= 90 * DAY },
  { id: "lapsed", label: "Lapsed — no visit in 60+ days", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) > 60 * DAY },
] as const;

function BulkSms({ items }: { items: StaffCustomer[] }) {
  const { flash, cafeName } = useStaff();
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["id"]>("all");
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [showList, setShowList] = useState(false);
  const [message, setMessage] = useState("");
  const [addCancel, setAddCancel] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => { staffSettingsAction().then((s) => setProvider(s.sms.provider)).catch(() => {}); }, []);

  const loadCampaigns = useCallback(() => { staffSmsCampaignsAction().then(setCampaigns).catch(() => {}); }, []);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  const anyRunning = campaigns.some((c) => c.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(loadCampaigns, 2000);
    return () => window.clearInterval(t);
  }, [anyRunning, loadCampaigns]);

  const aud = AUDIENCES.find((a) => a.id === audience)!;
  const matching = useMemo(() => items.filter((c) => aud.test(c)), [items, aud]);
  const eligible = useMemo(() => matching.filter((c) => !c.optOut), [matching]);
  const optedOut = matching.length - eligible.length;
  const chosen = useMemo(() => eligible.filter((c) => !unchecked.has(c.phone)), [eligible, unchecked]);

  const fullText = addCancel && !message.includes(CANCEL_FOOTER) ? `${message.trim()}\n${CANCEL_FOOTER}` : message.trim();
  const seg = smsSegments(fullText);
  const total = seg.segments * chosen.length;

  const templates = [
    `${cafeName}: 20% off all drinks this week! See you soon.`,
    `${cafeName}: Special offer! Get a free slice of cake with every order this weekend.`,
    `${cafeName}: We miss you! Show this message this week and your second coffee is on us.`,
  ];

  async function sendTest() {
    setTesting(true);
    try {
      const r = unwrap(await staffSmsPreviewAction(testPhone, message, addCancel));
      flash("✅ Test SMS sent — " + r.detail);
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); } finally { setTesting(false); }
  }
  async function send() {
    if (!chosen.length || !message.trim()) return;
    if (!confirm(`Send this SMS to ${num(chosen.length)} ${chosen.length === 1 ? "person" : "people"}?\n(About ${num(total)} SMS segments will be billed by your provider)`)) return;
    setSending(true);
    try {
      const r = unwrap(await staffStartSmsCampaignAction({ message, phones: chosen.map((c) => c.phone), addCancel }));
      flash(`Sending to ${num(r.total)} ${r.total === 1 ? "person" : "people"} started ✅`);
      setMessage("");
      loadCampaigns();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); } finally { setSending(false); }
  }
  async function control(id: string, action: "resume" | "retry" | "cancel") {
    try { unwrap(await staffSmsControlAction(id, action)); loadCampaigns(); }
    catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); }
  }

  if (items.length === 0) {
    return <Panel title="Bulk SMS" icon={<MessageSquareText className="size-5 text-primary" />}><Empty text="No customer numbers yet — once numbers are collected you can send offers and promotions to everyone" /></Panel>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Panel title="Send bulk SMS" icon={<Send className="size-5 text-primary" />}>
          {provider === "none" && (
            <p className="mb-3 rounded-xl bg-amber-500/15 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              ⚠️ No SMS provider is set up. Add your Twilio details under Settings → SMS.
            </p>
          )}

          {/* 1) Recipients */}
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">1) Recipients</label>
          <select value={audience} onChange={(e) => { setAudience(e.target.value as typeof audience); setUnchecked(new Set()); }} className={inputCls}>
            {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label} ({num(items.filter((c) => a.test(c) && !c.optOut).length)})</option>)}
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span><b className="text-primary">{num(chosen.length)}</b> selected</span>
            {optedOut > 0 && <span className="text-xs text-muted-foreground">({num(optedOut)} unsubscribed and excluded)</span>}
            <button onClick={() => setShowList((v) => !v)} className="text-xs font-semibold text-primary underline">{showList ? "Hide list" : "View & edit list"}</button>
          </div>
          {showList && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border">
              <div className="sticky top-0 flex gap-3 border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">
                <button onClick={() => setUnchecked(new Set())}>Select all</button>
                <button onClick={() => setUnchecked(new Set(eligible.map((c) => c.phone)))}>None</button>
              </div>
              {eligible.map((c) => (
                <label key={c.phone} className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-0">
                  <input type="checkbox" className="size-4 accent-primary" checked={!unchecked.has(c.phone)} onChange={() => setUnchecked((u) => { const n = new Set(u); if (n.has(c.phone)) n.delete(c.phone); else n.add(c.phone); return n; })} />
                  <span className="font-semibold">{c.phone}</span>
                  <span className="ms-auto text-[11px] text-muted-foreground">{num(c.visits)} visit{c.visits === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
          )}

          {/* 2) Message */}
          <label className="mb-1 mt-4 block text-xs font-semibold text-muted-foreground">2) Message</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {templates.map((t, i) => (
              <button key={i} onClick={() => setMessage(t)} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold transition hover:bg-muted">Template {num(i + 1)}</button>
            ))}
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="e.g. 20% off all drinks this week…" className={cn(inputCls, "resize-y leading-7")} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{num(seg.chars)} characters{seg.unicode ? " (Unicode)" : ""} · <b className="text-foreground">{num(seg.segments)}</b> segment{seg.segments === 1 ? "" : "s"} per person</span>
            <span>About <b className="text-foreground">{num(total)}</b> segments in total</span>
          </div>
          <div className="mt-3 rounded-2xl bg-muted/50 p-3">
            <Switch checked={addCancel} onChange={setAddCancel} label={`Add “${CANCEL_FOOTER}” at the end`} />
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Marketing messages usually need an opt-out notice. Twilio handles STOP replies automatically, so customers who reply STOP stop receiving messages.</p>
          </div>

          {/* 3) Test & send */}
          <label className="mb-1 mt-4 block text-xs font-semibold text-muted-foreground">3) Send yourself a test first (optional)</label>
          <div className="flex gap-2">
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} inputMode="tel" placeholder="+1 555 123 4567" className={inputCls} />
            <Button variant="outline" className="shrink-0 rounded-xl" onClick={sendTest} disabled={testing || !testPhone.trim() || !message.trim()}>{testing ? <Loader2 className="animate-spin" /> : "Send test"}</Button>
          </div>
          <Button size="lg" className="mt-4 h-12 w-full rounded-2xl text-base" onClick={send} disabled={sending || !chosen.length || !message.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <><Send className="size-5" /> Send to {num(chosen.length)} {chosen.length === 1 ? "person" : "people"}</>}
          </Button>
        </Panel>
      </div>

      <Panel title="Sending history" icon={<MessageSquareText className="size-5 text-primary" />} className="h-fit">
        {campaigns.length === 0 ? <Empty text="Nothing sent yet" /> : (
          <div className="space-y-3">{campaigns.map((c) => <CampaignCard key={c.id} c={c} onControl={control} />)}</div>
        )}
      </Panel>
    </div>
  );
}

const STATUS: Record<Campaign["status"], { label: string; cls: string }> = {
  running: { label: "Sending…", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  done: { label: "Completed", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  failed: { label: "Stopped", cls: "bg-primary/10 text-primary" },
  interrupted: { label: "Interrupted", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};
function CampaignCard({ c, onControl }: { c: Campaign; onControl: (id: string, a: "resume" | "retry" | "cancel") => void }) {
  const st = STATUS[c.status];
  const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0;
  const active = c.status === "running";
  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", st.cls)}>{active && <Loader2 className="size-3 animate-spin" />}{st.label}</span>
        <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
      </div>
      <p className="line-clamp-2 whitespace-pre-line text-sm">{c.message}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width]", c.failed ? "bg-amber-500" : "bg-green-600")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span className="text-green-700 dark:text-green-400">✓ {num(c.sent)} sent</span>
        {c.failed > 0 && <span className="text-primary">✗ {num(c.failed)} failed</span>}
        {c.queued > 0 && <span>⏳ {num(c.queued)} remaining</span>}
        <span className="ms-auto">of {num(c.total)}</span>
      </div>
      {c.note && <p className="mt-1.5 rounded-lg bg-primary/10 p-2 text-xs text-primary">{c.note}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!active && c.queued > 0 && c.status !== "cancelled" && <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => onControl(c.id, "resume")}><Play className="size-3.5" /> Resume</Button>}
        {!active && c.failed > 0 && <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => onControl(c.id, "retry")}><RotateCcw className="size-3.5" /> Retry failed</Button>}
        {(active || c.status === "interrupted" || c.status === "failed") && c.status !== "cancelled" && c.queued > 0 && <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" onClick={() => onControl(c.id, "cancel")}>{active ? <Pause className="size-3.5" /> : <X className="size-3.5" />} Cancel</Button>}
      </div>
    </article>
  );
}
