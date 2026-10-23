import { notFound } from "next/navigation";
import { PlatformShell, RichText } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";
import { onPlatformHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

/** This page's text is edited in Platform admin → Site content → Legal */
export default async function LegalPage() {
  if (!(await onPlatformHost())) notFound();
  const p = publicPlatform();
  return (
    <PlatformShell p={p}>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <RichText text={p.c.legal.terms} />
        </article>
      </main>
    </PlatformShell>
  );
}
