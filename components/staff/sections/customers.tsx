"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellOff, Check, Download, Loader2, MessageSquareText, Pause, Play, RotateCcw, Search, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, faDateTime, toFa } from "@/lib/utils";
import { smsSegments } from "@/lib/sms-count";
import { unwrap } from "@/lib/action-result";
import {
  staffSetOptOutAction, staffSettingsAction, staffSmsCampaignsAction, staffSmsControlAction,
  staffSmsPreviewAction, staffStartSmsCampaignAction,
} from "@/app/staff/actions";
import type { StaffCustomer } from "@/lib/queries";
import type { Campaign } from "@/lib/bulk-sms";
import { Empty, Panel, Switch, inputCls, useStaff } from "@/components/staff/kit";

export function CustomersSection({ items, onChange }: { items: StaffCustomer[]; onChange: (fn: (l: StaffCustomer[]) => StaffCustomer[]) => void }) {
  const [tab, setTab] = useState<"list" | "sms">("list");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold">
        {([["list", "مشتری‌ها", Users], ["sms", "پیامک گروهی", MessageSquareText]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 transition", tab === id ? "bg-card shadow" : "text-muted-foreground")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "list" ? <CustomerList items={items} onChange={onChange} /> : <BulkSms items={items} />}
    </div>
  );
}

/* ====================== لیست مشتری‌ها ====================== */
function CustomerList({ items, onChange }: { items: StaffCustomer[]; onChange: (fn: (l: StaffCustomer[]) => StaffCustomer[]) => void }) {
  const { flash } = useStaff();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const d = q.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/\D/g, "");
    return d ? items.filter((c) => c.phone.includes(d)) : items;
  }, [items, q]);

  function exportCsv() {
    const rows = [["شماره موبایل", "میزها", "دفعات", "اولین بازدید", "آخرین بازدید", "پیامک تبلیغاتی"]];
    items.forEach((c) => rows.push([c.phone, c.tables.join(" | "), String(c.visits), c.firstSeen, c.lastSeen, c.optOut ? "لغو کرده" : "فعال"]));
    const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  async function toggleOptOut(c: StaffCustomer) {
    try {
      unwrap(await staffSetOptOutAction(c.phone, !c.optOut));
      onChange((l) => l.map((x) => (x.phone === c.phone ? { ...x, optOut: !c.optOut } : x)));
    } catch (e) { flash(e instanceof Error ? e.message : "خطا"); }
  }

  return (
    <Panel
      title="بانک شمارهٔ مشتری‌ها"
      icon={<Users className="size-5 text-primary" />}
      count={toFa(items.length)}
      action={items.length > 0 && <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv}><Download className="size-4" /> خروجی اکسل (CSV)</Button>}
    >
      {items.length === 0 ? (
        <Empty text="هنوز شماره‌ای ثبت نشده است — با روشن‌کردنِ «تأیید شمارهٔ مشتری» در تنظیمات، شماره‌ها اینجا جمع می‌شوند" />
      ) : (
        <>
          <div className="relative mb-3 max-w-xs">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی شماره" className={cn(inputCls, "pr-9")} />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-right font-semibold">#</th>
                  <th className="p-2.5 text-right font-semibold">شماره موبایل</th>
                  <th className="p-2.5 text-right font-semibold">میزها</th>
                  <th className="p-2.5 text-right font-semibold">دفعات</th>
                  <th className="p-2.5 text-right font-semibold">آخرین بازدید</th>
                  <th className="p-2.5 text-right font-semibold">پیامک تبلیغاتی</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.phone} className={cn("border-t border-border", c.optOut && "text-muted-foreground")}>
                    <td className="p-2.5 text-muted-foreground">{toFa(i + 1)}</td>
                    <td className="p-2.5 font-bold" dir="ltr" style={{ textAlign: "right" }}>{toFa(c.phone)}</td>
                    <td className="p-2.5">{c.tables.map((t) => toFa(t)).join("، ") || "—"}</td>
                    <td className="p-2.5">{toFa(c.visits || 1)}</td>
                    <td className="p-2.5 text-muted-foreground">{faDateTime(c.lastSeen)}</td>
                    <td className="p-2.5">
                      <button onClick={() => toggleOptOut(c)} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition", c.optOut ? "bg-primary/10 text-primary" : "bg-green-600/10 text-green-700 dark:text-green-400")} title="با زدن تغییر می‌کند">
                        {c.optOut ? <><BellOff className="size-3.5" /> لغو کرده</> : <><Check className="size-3.5" /> فعال</>}
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

/* ====================== پیامک گروهی ====================== */
const DAY = 86_400_000;
const AUDIENCES = [
  { id: "all", label: "همهٔ مشتری‌ها", test: () => true },
  { id: "loyal", label: "وفادار — ۳ بار یا بیشتر آمده", test: (c: StaffCustomer) => c.visits >= 3 },
  { id: "once", label: "فقط یک‌بار آمده", test: (c: StaffCustomer) => c.visits <= 1 },
  { id: "recent30", label: "فعال — در ۳۰ روز اخیر", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) <= 30 * DAY },
  { id: "recent90", label: "در ۹۰ روز اخیر", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) <= 90 * DAY },
  { id: "lapsed", label: "غیرفعال — بیش از ۶۰ روز نیامده", test: (c: StaffCustomer) => Date.now() - +new Date(c.lastSeen) > 60 * DAY },
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

  const fullText = addCancel && !message.includes("لغو 11") ? `${message.trim()}\nلغو 11` : message.trim();
  const seg = smsSegments(fullText);
  const total = seg.segments * chosen.length;

  const templates = [
    `${cafeName}: این هفته ۲۰٪ تخفیف روی همهٔ نوشیدنی‌ها! منتظر شما هستیم ☕`,
    `${cafeName}: جشنوارهٔ ویژه! با هر سفارش یک کیک هدیه بگیرید 🎂`,
    `${cafeName}: دلمون براتون تنگ شده! این هفته با نشان‌دادن این پیامک، قهوهٔ دوم رایگانه.`,
  ];

  async function sendTest() {
    setTesting(true);
    try {
      const r = unwrap(await staffSmsPreviewAction(testPhone, message, addCancel));
      flash("✅ پیامک آزمایشی ارسال شد — " + r.detail);
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); } finally { setTesting(false); }
  }
  async function send() {
    if (!chosen.length || !message.trim()) return;
    if (!confirm(`پیامک برای ${toFa(chosen.length)} نفر ارسال شود؟\n(حدود ${toFa(total)} پیامک از اعتبار پنل کم می‌شود)`)) return;
    setSending(true);
    try {
      const r = unwrap(await staffStartSmsCampaignAction({ message, phones: chosen.map((c) => c.phone), addCancel }));
      flash(`ارسال برای ${toFa(r.total)} نفر شروع شد ✅`);
      setMessage("");
      loadCampaigns();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); } finally { setSending(false); }
  }
  async function control(id: string, action: "resume" | "retry" | "cancel") {
    try { unwrap(await staffSmsControlAction(id, action)); loadCampaigns(); }
    catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); }
  }

  if (items.length === 0) {
    return <Panel title="پیامک گروهی" icon={<MessageSquareText className="size-5 text-primary" />}><Empty text="هنوز شمارهٔ مشتری‌ای ثبت نشده — بعد از جمع‌شدنِ شماره‌ها می‌توانید برای همه پیامکِ تخفیف و جشنواره بفرستید" /></Panel>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Panel title="ارسال پیامک گروهی" icon={<Send className="size-5 text-primary" />}>
          {provider === "none" && (
            <p className="mb-3 rounded-xl bg-amber-500/15 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              ⚠️ سامانهٔ پیامک انتخاب نشده؛ از «تنظیمات ← سامانهٔ پیامک» وایدی (wide.ir) یا کاوه‌نگار را وارد کنید.
            </p>
          )}

          {/* ۱) مخاطبان */}
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">۱) گیرندگان</label>
          <select value={audience} onChange={(e) => { setAudience(e.target.value as typeof audience); setUnchecked(new Set()); }} className={inputCls}>
            {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label} ({toFa(items.filter((c) => a.test(c) && !c.optOut).length)} نفر)</option>)}
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span><b className="text-primary">{toFa(chosen.length)}</b> نفر انتخاب شده</span>
            {optedOut > 0 && <span className="text-xs text-muted-foreground">({toFa(optedOut)} نفر پیامک را لغو کرده‌اند و حذف شدند)</span>}
            <button onClick={() => setShowList((v) => !v)} className="text-xs font-semibold text-primary underline">{showList ? "بستن فهرست" : "دیدن و ویرایشِ فهرست"}</button>
          </div>
          {showList && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border">
              <div className="sticky top-0 flex gap-3 border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">
                <button onClick={() => setUnchecked(new Set())}>انتخابِ همه</button>
                <button onClick={() => setUnchecked(new Set(eligible.map((c) => c.phone)))}>هیچ‌کدام</button>
              </div>
              {eligible.map((c) => (
                <label key={c.phone} className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-0">
                  <input type="checkbox" className="size-4 accent-primary" checked={!unchecked.has(c.phone)} onChange={() => setUnchecked((u) => { const n = new Set(u); if (n.has(c.phone)) n.delete(c.phone); else n.add(c.phone); return n; })} />
                  <span dir="ltr" className="font-semibold">{toFa(c.phone)}</span>
                  <span className="ms-auto text-[11px] text-muted-foreground">{toFa(c.visits)} بار</span>
                </label>
              ))}
            </div>
          )}

          {/* ۲) متن */}
          <label className="mb-1 mt-4 block text-xs font-semibold text-muted-foreground">۲) متن پیامک</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {templates.map((t, i) => (
              <button key={i} onClick={() => setMessage(t)} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold transition hover:bg-muted">نمونهٔ {toFa(i + 1)}</button>
            ))}
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5} placeholder="مثلاً: این هفته ۲۰٪ تخفیف روی همهٔ نوشیدنی‌ها…" className={cn(inputCls, "resize-y leading-7")} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{toFa(seg.chars)} نویسه · <b className="text-foreground">{toFa(seg.segments)}</b> پیامک برای هر نفر</span>
            <span>جمعاً حدود <b className="text-foreground">{toFa(total)}</b> پیامک</span>
          </div>
          <div className="mt-3 rounded-2xl bg-muted/50 p-3">
            <Switch checked={addCancel} onChange={setAddCancel} label="افزودن «لغو 11» به انتهای پیامک" />
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">پنل‌های ارسال با لینک (مثل wide.ir) برای پیامکِ تبلیغاتی این عبارت را لازم دارند؛ مشتری با ارسال «11» دیگر پیامک نمی‌گیرد.</p>
          </div>

          {/* ۳) آزمایش و ارسال */}
          <label className="mb-1 mt-4 block text-xs font-semibold text-muted-foreground">۳) اول برای خودتان بفرستید (اختیاری)</label>
          <div className="flex gap-2">
            <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} inputMode="tel" dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸۹" className={inputCls} />
            <Button variant="outline" className="shrink-0 rounded-xl" onClick={sendTest} disabled={testing || !testPhone.trim() || !message.trim()}>{testing ? <Loader2 className="animate-spin" /> : "ارسال آزمایشی"}</Button>
          </div>
          <Button size="lg" className="mt-4 h-12 w-full rounded-2xl text-base" onClick={send} disabled={sending || !chosen.length || !message.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <><Send className="size-5" /> ارسال به {toFa(chosen.length)} نفر</>}
          </Button>
        </Panel>
      </div>

      <Panel title="تاریخچهٔ ارسال‌ها" icon={<MessageSquareText className="size-5 text-primary" />} className="h-fit">
        {campaigns.length === 0 ? <Empty text="هنوز ارسالی انجام نشده" /> : (
          <div className="space-y-3">{campaigns.map((c) => <CampaignCard key={c.id} c={c} onControl={control} />)}</div>
        )}
      </Panel>
    </div>
  );
}

const STATUS: Record<Campaign["status"], { label: string; cls: string }> = {
  running: { label: "در حال ارسال…", cls: "bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  done: { label: "تمام شد", cls: "bg-green-600/10 text-green-700 dark:text-green-400" },
  failed: { label: "متوقف شد", cls: "bg-primary/10 text-primary" },
  interrupted: { label: "نیمه‌کاره ماند", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  cancelled: { label: "لغو شد", cls: "bg-muted text-muted-foreground" },
};
function CampaignCard({ c, onControl }: { c: Campaign; onControl: (id: string, a: "resume" | "retry" | "cancel") => void }) {
  const st = STATUS[c.status];
  const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0;
  const active = c.status === "running";
  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", st.cls)}>{active && <Loader2 className="size-3 animate-spin" />}{st.label}</span>
        <span className="text-[11px] text-muted-foreground">{faDateTime(c.createdAt)}</span>
      </div>
      <p className="line-clamp-2 whitespace-pre-line text-sm">{c.message}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-[width]", c.failed ? "bg-amber-500" : "bg-green-600")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span className="text-green-700 dark:text-green-400">✓ {toFa(c.sent)} ارسال‌شده</span>
        {c.failed > 0 && <span className="text-primary">✗ {toFa(c.failed)} ناموفق</span>}
        {c.queued > 0 && <span>⏳ {toFa(c.queued)} باقی‌مانده</span>}
        <span className="ms-auto">از {toFa(c.total)}</span>
      </div>
      {c.note && <p className="mt-1.5 rounded-lg bg-primary/10 p-2 text-xs text-primary">{c.note}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!active && c.queued > 0 && c.status !== "cancelled" && <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => onControl(c.id, "resume")}><Play className="size-3.5" /> ادامهٔ ارسال</Button>}
        {!active && c.failed > 0 && <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => onControl(c.id, "retry")}><RotateCcw className="size-3.5" /> تلاش دوباره برای ناموفق‌ها</Button>}
        {(active || c.status === "interrupted" || c.status === "failed") && c.status !== "cancelled" && c.queued > 0 && <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" onClick={() => onControl(c.id, "cancel")}>{active ? <Pause className="size-3.5" /> : <X className="size-3.5" />} لغو</Button>}
      </div>
    </article>
  );
}
