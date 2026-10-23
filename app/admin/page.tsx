import { AdminApp } from "@/components/platform/admin-app";

import { notFound } from "next/navigation";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform admin", robots: { index: false, follow: false } };

/** Platform super-admin panel (root domain only) */
export default async function AdminPage() {
  // Only on the platform's root domain; it doesn't exist on venue subdomains
  if (!(await onPlatformHost())) notFound();
  return <AdminApp />;
}
