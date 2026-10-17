import { PlatformFooter, PlatformNav } from "@/components/platform/home";
import { SignupForm } from "@/components/platform/signup-form";
import { KIND_LABEL } from "@/lib/seeds";
import { publicPlatform } from "../public";

export const dynamic = "force-dynamic";
export const metadata = { title: "ثبت‌نام" };

export default function SignupPage() {
  const p = publicPlatform();
  return (
    <div className="min-h-screen bg-background">
      <PlatformNav p={p} />
      <main className="mx-auto max-w-xl px-4 py-10">
        {p.allowSignup ? (
          <SignupForm root={p.root} trialDays={p.trialDays} otp={p.otp} kinds={KIND_LABEL} />
        ) : (
          <p className="rounded-3xl border border-border bg-card p-6 text-center">ثبت‌نامِ آنلاین فعلاً بسته است{p.support ? `؛ پشتیبانی: ${p.support}` : "."}</p>
        )}
      </main>
      <PlatformFooter p={p} />
    </div>
  );
}
