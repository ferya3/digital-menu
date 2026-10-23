import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/home";
import { FindPanel } from "@/components/platform/find-panel";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in", robots: { index: false, follow: true } };

export default async function LoginPage() {
  // Platform root domain only; does not exist on venue subdomains
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
