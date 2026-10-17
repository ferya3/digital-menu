import { isAuthed } from "@/lib/auth";
import { StaffApp } from "@/components/staff/staff-app";
import { tenantPage } from "@/lib/tenant-page";
import { currentTenantRecord } from "@/lib/tenant";
import { tenantState } from "@/lib/platform";
import { activeAnnouncement } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "پنل مدیریت", robots: { index: false, follow: false } };

export default async function StaffPage() {
  // پنل حتی با اشتراکِ تمام‌شده باز می‌شود تا مدیر بتواند تمدید کند
  return tenantPage(async () => {
    const authed = await isAuthed();
    const t = currentTenantRecord();
    const sub = t ? { ...tenantState(t), expiresAt: t.expiresAt, slug: t.slug } : null;
    // اعلانِ مدیرِ کل (مثلاً زمانِ به‌روزرسانی یا جشنواره) بالای پنلِ همهٔ مجموعه‌ها
    const a = t ? activeAnnouncement() : null;
    return <StaffApp initialAuthed={authed} subscription={sub} announcement={a ? { text: a.text, level: a.level } : null} />;
  });
}
