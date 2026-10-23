import { isAuthed } from "@/lib/auth";
import { StaffApp } from "@/components/staff/staff-app";
import { tenantPage } from "@/lib/tenant-page";
import { currentTenantRecord } from "@/lib/tenant";
import { tenantState } from "@/lib/platform";
import { activeAnnouncement } from "@/lib/platform-admin";
import { demoHints } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function StaffPage() {
  // The panel opens even with an expired subscription so the manager can renew
  return tenantPage(async () => {
    const authed = await isAuthed();
    const t = currentTenantRecord();
    const sub = t ? { ...tenantState(t), expiresAt: t.expiresAt, slug: t.slug } : null;
    // Platform admin announcement (e.g. maintenance or a promotion) shown on every venue's panel
    const a = t ? activeAnnouncement() : null;
    const d = demoHints();
    return <StaffApp initialAuthed={authed} subscription={sub} announcement={a ? { text: a.text, level: a.level } : null} demo={d ? { password: d.staff, resetHours: d.resetHours } : null} />;
  });
}
