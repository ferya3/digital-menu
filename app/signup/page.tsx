import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/home";
import { SignupForm } from "@/components/platform/signup-form";
import { KIND_LABEL } from "@/lib/seeds";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost } from "@/lib/tenant";
import { cookies } from "next/headers";
import { REF_COOKIE, activeRef } from "@/lib/partners";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up and create your free menu", alternates: { canonical: "/signup" } };

export default async function SignupPage() {
  // Platform root domain only; does not exist on venue subdomains
  if (!(await onPlatformHost())) notFound();
  const p = publicPlatform();
  return (
    <PlatformShell p={p}>
      <main className="mx-auto max-w-xl px-4 py-10">
        {p.allowSignup ? (
          <SignupForm root={p.root} otp={p.otp} kinds={KIND_LABEL} texts={p.c.signup} refCode={activeRef((await cookies()).get(REF_COOKIE)?.value)} />
        ) : (
          <p className="rounded-3xl border border-border bg-card p-6 text-center">Online signup is currently closed{p.c.footer.phone ? `. Contact support: ${p.c.footer.phone}` : "."}</p>
        )}
      </main>
    </PlatformShell>
  );
}
