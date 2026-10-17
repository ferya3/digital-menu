import { isAuthed } from "@/lib/auth";
import { StaffApp } from "@/components/staff/staff-app";
import { tenantPage } from "@/lib/tenant-page";
import { currentTenantRecord } from "@/lib/tenant";
import { tenantState } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // پنل حتی با اشتراکِ تمام‌شده باز می‌شود تا مدیر بتواند تمدید کند
  return tenantPage(async () => {
    const authed = await isAuthed();
    const t = currentTenantRecord();
    const sub = t ? { ...tenantState(t), expiresAt: t.expiresAt, slug: t.slug } : null;
    return <StaffApp initialAuthed={authed} subscription={sub} />;
  });
}
