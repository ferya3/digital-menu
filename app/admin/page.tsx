import { AdminApp } from "@/components/platform/admin-app";

import { notFound } from "next/navigation";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "مدیریتِ پلتفرم", robots: { index: false, follow: false } };

/** پنلِ مدیرِ کلِ سامانه (فقط روی دامنهٔ اصلی) */
export default async function AdminPage() {
  // فقط روی دامنهٔ اصلیِ پلتفرم؛ روی زیردامنهٔ مجموعه‌ها وجود ندارد
  if (!(await onPlatformHost())) notFound();
  return <AdminApp />;
}
