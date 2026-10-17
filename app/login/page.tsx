import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/home";
import { FindPanel } from "@/components/platform/find-panel";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود به پنل" };

export default async function LoginPage() {
  // فقط روی دامنهٔ اصلیِ پلتفرم؛ روی زیردامنهٔ مجموعه‌ها وجود ندارد
  if (!(await onPlatformHost())) notFound();
  const p = publicPlatform();
  return (
    <PlatformShell p={p}>
      <main className="mx-auto max-w-md px-4 py-14">
        <FindPanel root={p.root} texts={p.c.login} support={p.c.footer.phone} />
      </main>
    </PlatformShell>
  );
}
