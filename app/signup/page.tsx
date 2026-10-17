import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform/home";
import { SignupForm } from "@/components/platform/signup-form";
import { KIND_LABEL } from "@/lib/seeds";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "ثبت‌نام" };

export default async function SignupPage() {
  // فقط روی دامنهٔ اصلیِ پلتفرم؛ روی زیردامنهٔ مجموعه‌ها وجود ندارد
  if (!(await onPlatformHost())) notFound();
  const p = publicPlatform();
  return (
    <PlatformShell p={p}>
      <main className="mx-auto max-w-xl px-4 py-10">
        {p.allowSignup ? (
          <SignupForm root={p.root} otp={p.otp} kinds={KIND_LABEL} texts={p.c.signup} />
        ) : (
          <p className="rounded-3xl border border-border bg-card p-6 text-center">ثبت‌نامِ آنلاین فعلاً بسته است{p.c.footer.phone ? `؛ پشتیبانی: ${p.c.footer.phone}` : "."}</p>
        )}
      </main>
    </PlatformShell>
  );
}
