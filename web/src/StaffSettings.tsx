import { useEffect, useRef, useState } from "react";
import { Loader2, ImageIcon, X, Save, ChevronDown, CreditCard, Store, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchSettingsAdmin, updateSettings, API, type AdminSettings } from "@/api";

const iconSrc = (p: string) => (/^https?:|^data:/.test(p) ? p : API + p);
const isImg = (s: string) => /^https?:|^data:|^\/images\//.test(s || "");
function readFile(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function StaffSettings({ flash }: { flash: (m: string) => void }) {
  const [s, setS] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const logoFile = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchSettingsAdmin().then(setS).catch(() => {});
  }, []);

  if (!s) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const st = s; // بعد از گارد، غیرِ null است
  const setCafe = (k: string, v: string) => setS({ ...st, cafe: { ...st.cafe, [k]: v } });
  const setPay = (k: string, v: string) => setS({ ...st, payment: { ...st.payment, [k]: v } });
  const setSms = (k: string, v: string) => setS({ ...st, sms: { ...st.sms, [k]: v } });
  const togglePayment = (id: string, enabled: boolean) =>
    setS({ ...st, payments: st.payments.map((p) => (p.id === id ? { ...p, enabled } : p)) });

  async function save() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        cafe: st.cafe,
        currency: st.currency,
        orderCode: st.orderCode,
        payment: st.payment,
        sms: st.sms,
        payments: st.payments,
      };
      if (newPass.trim()) patch.auth = { password: newPass.trim() };
      const up = await updateSettings(patch);
      setS(up);
      setNewPass("");
      flash("تنظیمات ذخیره شد ✅");
    } catch (e) {
      flash(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* اطلاعات کافه */}
      <Card icon={<Store className="h-4 w-4" />} title="اطلاعات کافه">
        <div className="flex items-center gap-3">
          {isImg(s.cafe.logo) ? (
            <img src={iconSrc(s.cafe.logo)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-3xl">
              {s.cafe.logo || "☕"}
            </span>
          )}
          <div className="flex-1">
            <Field label="نام کافه">
              <input value={s.cafe.name} onChange={(e) => setCafe("name", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="لوگو (ایموجی)">
            <div className="flex gap-2">
              <input
                value={isImg(s.cafe.logo) ? "" : s.cafe.logo}
                onChange={(e) => setCafe("logo", e.target.value)}
                placeholder="☕"
                className={inputCls}
              />
              <input ref={logoFile} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCafe("logo", await readFile(f)); }} />
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={() => logoFile.current?.click()} aria-label="آپلود لوگو">
                <ImageIcon className="h-4 w-4" />
              </Button>
              {isImg(s.cafe.logo) && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setCafe("logo", "☕")} aria-label="حذف">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Field>
          <Field label="شعار / زیرعنوان">
            <input value={s.cafe.tagline || ""} onChange={(e) => setCafe("tagline", e.target.value)} className={inputCls} />
          </Field>
          <Field label="آدرس">
            <input value={s.cafe.address || ""} onChange={(e) => setCafe("address", e.target.value)} className={inputCls} />
          </Field>
          <Field label="اینستاگرام">
            <input value={s.cafe.instagram || ""} onChange={(e) => setCafe("instagram", e.target.value)} placeholder="@cafe" className={inputCls} dir="ltr" />
          </Field>
        </div>
        <Field label="واحد پول">
          <div className="flex gap-2">
            {(["toman", "rial"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setS({ ...s, currency: c })}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  s.currency === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                )}
              >
                {c === "toman" ? "تومان" : "ریال"}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      {/* پرداخت */}
      <Card icon={<CreditCard className="h-4 w-4" />} title="اطلاعات پرداخت (کارت‌به‌کارت)">
        <p className="text-xs text-muted-foreground">این اطلاعات هنگام درخواستِ صورتحساب به مشتری نشان داده می‌شود.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="شماره کارت">
            <input value={s.payment.card || ""} onChange={(e) => setPay("card", e.target.value)} className={inputCls} dir="ltr" placeholder="6037-xxxx-xxxx-xxxx" />
          </Field>
          <Field label="به نام">
            <input value={s.payment.holder || ""} onChange={(e) => setPay("holder", e.target.value)} className={inputCls} />
          </Field>
          <Field label="لینک پرداخت (اختیاری)">
            <input value={s.payment.link || ""} onChange={(e) => setPay("link", e.target.value)} className={inputCls} dir="ltr" placeholder="https://…" />
          </Field>
          <Field label="یادداشت پرداخت">
            <input value={s.payment.note || ""} onChange={(e) => setPay("note", e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Card>

      {/* رمز عبور */}
      <Card icon={<Save className="h-4 w-4" />} title="رمز ورود کارکنان">
        <Field label={s.auth.hasPassword ? "رمز جدید (خالی بذار تا تغییر نکنه)" : "تعیین رمز"}>
          <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inputCls} placeholder="••••••" />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          اگر متغیر محیطیِ ADMIN_PASSWORD روی سرور تنظیم شده باشد، همان اولویت دارد.
        </p>
      </Card>

      {/* پیشرفته */}
      <button
        onClick={() => setAdvanced((a) => !a)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold"
      >
        <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> تنظیمات پیشرفته (پیامک و درگاه‌ها)</span>
        <ChevronDown className={cn("h-5 w-5 transition-transform", advanced && "rotate-180")} />
      </button>
      {advanced && (
        <>
          <Card icon={<MessageSquare className="h-4 w-4" />} title="پیامک (کد تأیید)">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="سرویس پیامک">
                <select value={s.sms.provider} onChange={(e) => setSms("provider", e.target.value)} className={inputCls}>
                  <option value="none">غیرفعال</option>
                  <option value="kavenegar">کاوه‌نگار</option>
                </select>
              </Field>
              <Field label="فرستنده">
                <input value={s.sms.sender} onChange={(e) => setSms("sender", e.target.value)} className={inputCls} dir="ltr" />
              </Field>
              <Field label="کلید API" className="sm:col-span-2">
                <input value={s.sms.apiKey} onChange={(e) => setSms("apiKey", e.target.value)} className={inputCls} dir="ltr" />
              </Field>
            </div>
          </Card>
          <Card icon={<CreditCard className="h-4 w-4" />} title="درگاه‌های پرداخت">
            <div className="space-y-2">
              {s.payments.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-input px-3 py-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <input type="checkbox" checked={p.enabled} onChange={(e) => togglePayment(p.id, e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                </label>
              ))}
            </div>
          </Card>
        </>
      )}

      <div className="sticky bottom-3 z-10">
        <Button className="h-12 w-full rounded-2xl text-base shadow-lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> ذخیرهٔ تنظیمات</>}
        </Button>
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-extrabold">{icon}{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
