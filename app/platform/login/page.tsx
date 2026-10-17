import { PlatformFooter, PlatformNav } from "@/components/platform/home";
import { FindPanel } from "@/components/platform/find-panel";
import { publicPlatform } from "../public";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود به پنل" };

export default function LoginPage() {
  const p = publicPlatform();
  return (
    <div className="min-h-screen bg-background">
      <PlatformNav p={p} />
      <main className="mx-auto max-w-md px-4 py-14">
        <FindPanel root={p.root} support={p.support} />
      </main>
      <PlatformFooter p={p} />
    </div>
  );
}
