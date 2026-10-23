"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { adminCitiesAction, adminDeleteCityAction, adminSaveCityAction } from "@/app/platform/actions";
import { CITY_SLUG, type City } from "@/lib/cities";
import { Box, L, Modal, Toggle, err, smallField, type Flash } from "./shared";

const blank = (): City => ({ slug: "", name: "", intro: "", body: "", published: true, updated: "" });

/** City landing pages (/city/<slug>) for "digital menu + city name" searches */
export function Cities({ flash, siteUrl }: { flash: Flash; siteUrl: string }) {
  const [list, setList] = useState<City[] | null>(null);
  const [edit, setEdit] = useState<{ c: City; prev?: string } | null>(null);
  const load = useCallback(() => adminCitiesAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e))), [flash]);
  useEffect(() => { load(); }, [load]);
  const base = siteUrl.replace(/\/$/, "");

  if (!list) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-4">
      <Box title={`City pages (${list.filter((c) => c.published).length.toLocaleString("en-US")} published)`} action={
        <Button size="sm" className="rounded-xl" onClick={() => setEdit({ c: blank() })}><Plus className="size-4" /> New city</Button>
      }>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          Each page targets a search like “digital menu Austin”. Google doesn’t like pages that differ only by the city name, so write a <b className="text-foreground">unique intro</b> for every city and add something about local customers whenever you sign one up.
          Active menus in each city (based on the “City” field in each venue’s settings) are listed on that city’s page automatically.
        </p>
        <div className="divide-y divide-border">
          {list.map((c) => (
            <div key={c.slug} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <b className="block text-sm">Digital menu {c.name}</b>
                <span className="text-xs text-muted-foreground">/city/{c.slug}</span>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", c.published ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>{c.published ? "Published" : "Draft"}</span>
              {c.published && <a href={`${base}/city/${c.slug}`} target="_blank" rel="noopener" aria-label="View" className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="size-4" /></a>}
              <button type="button" aria-label="Edit" onClick={() => setEdit({ c: { ...c }, prev: c.slug })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
              <button type="button" aria-label="Delete" onClick={async () => {
                if (!confirm(`Delete the page for “${c.name}”?`)) return;
                try { unwrap(await adminDeleteCityAction(c.slug)); load(); } catch (e) { flash("❌ " + err(e)); }
              }} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </Box>
      {edit && <CityModal init={edit.c} prev={edit.prev} flash={flash} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function CityModal({ init, prev, flash, onClose, onSaved }: { init: City; prev?: string; flash: Flash; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState(init);
  const [busy, setBusy] = useState(false);
  const put = (x: Partial<City>) => setC((v) => ({ ...v, ...x }));
  async function save() {
    setBusy(true);
    try { unwrap(await adminSaveCityAction(c, prev)); flash("✅ Saved"); onSaved(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={prev ? `Edit ${init.name}` : "New city"} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="City name"><input value={c.name} onChange={(e) => put({ name: e.target.value })} className={smallField} placeholder="Austin" /></L>
          <L t="URL slug" hint={`/city/${c.slug || "…"}`}>
            <input value={c.slug} onChange={(e) => put({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={cn(smallField, c.slug && !CITY_SLUG.test(c.slug) && "border-primary")} placeholder="austin" />
          </L>
        </div>
        <L t="Unique intro for this city" hint={`${c.intro.length.toLocaleString("en-US")} characters — at least two or three genuine sentences about this city’s café and restaurant scene`}>
          <textarea value={c.intro} onChange={(e) => put({ intro: e.target.value })} rows={4} className={cn(smallField, "resize-y leading-7")} />
        </L>
        <L t="Extra content (optional)" hint="## Heading · - list · **bold** · [link](/cafe-menu)">
          <textarea value={c.body} onChange={(e) => put({ body: e.target.value })} rows={6} className={cn(smallField, "resize-y font-mono text-[13px] leading-7")} />
        </L>
        <Toggle checked={c.published} onChange={(v) => put({ published: v })} label="Published (on the site, in the sitemap and on Google)" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="rounded-xl" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </div>
      </div>
    </Modal>
  );
}
