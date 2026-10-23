"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { findPanelAction } from "@/app/platform/actions";

/** Login: takes the menu address and redirects to that venue's dashboard */
export function FindPanel({ root, support, texts }: { root: string; support: string; texts: { title: string; subtitle: string; help: string } }) {
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      window.location.href = unwrap(await findPanelAction(slug)).url;
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); setBusy(false); }
  }
  return (
    <form onSubmit={go} className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-black">{texts.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{texts.subtitle}</p>
      <div className="mt-6 flex items-center overflow-hidden rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <input required autoFocus value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().trim())} placeholder="bella" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none" />
        <span className="shrink-0 bg-muted px-3 py-3 text-sm text-muted-foreground">.{root}</span>
      </div>
      {err && <p className="mt-3 rounded-2xl bg-primary/10 p-3 text-sm font-semibold text-primary">{err}</p>}
      <Button type="submit" size="lg" className="mt-5 h-12 w-full rounded-2xl" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <><LogIn className="size-5" /> Continue</>}</Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {texts.help}{support ? <> <span>{support}</span></> : null}
      </p>
    </form>
  );
}
