import { AdminApp } from "@/components/platform/admin-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "مدیریتِ پلتفرم" };

/** پنلِ مدیرِ کلِ سامانه (فقط روی دامنهٔ اصلی) */
export default function AdminPage() {
  return <AdminApp />;
}
