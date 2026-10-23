"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Eye, ImagePlus, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, fmtDate } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import { adminArticlesAction, adminDeleteArticleAction, adminSaveArticleAction, adminUploadCardImageAction } from "@/app/platform/actions";
import { SLUG_RE, readMinutes, type Article } from "@/lib/articles";
import { Prose } from "@/components/platform/prose";
import { Box, L, Toggle, err, smallField, type Flash } from "./shared";

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Article => ({ slug: "", title: "", description: "", cover: "", body: "", published: false, date: today(), updated: today() });

const HELP = "## Heading · ### Subheading · - list · 1. numbered list · > tip · **bold** · [link text](/cafe-menu) · blank line = new paragraph · {brand} = brand name";

/** Blog articles (for SEO): list, write, preview, publish */
export function Articles({ flash, siteUrl }: { flash: Flash; siteUrl: string }) {
  const [list, setList] = useState<Article[] | null>(null);
  const [edit, setEdit] = useState<{ a: Article; prev?: string } | null>(null);
  const load = useCallback(() => adminArticlesAction().then((r) => setList(unwrap(r))).catch((e) => flash("❌ " + err(e))), [flash]);
  useEffect(() => { load(); }, [load]);

  if (!list) return <div className="grid h-60 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  if (edit) return <Editor key={edit.prev || "new"} init={edit.a} prev={edit.prev} siteUrl={siteUrl} flash={flash} onDone={() => { setEdit(null); load(); }} />;

  const pub = list.filter((a) => a.published).length;
  return (
    <div className="space-y-4">
      <Box title={`Articles (${pub.toLocaleString("en-US")} of ${list.length.toLocaleString("en-US")} published)`} action={
        <Button size="sm" className="rounded-xl" onClick={() => setEdit({ a: blank() })}><Plus className="size-4" /> New article</Button>
      }>
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
          Every good article is a new way in from Google. Pick one clear topic per article (e.g. “digital menu for bakeries”), use that phrase in the title and the opening paragraph, and link to other pages of the site.
          Articles are added to <a href={`${siteUrl.replace(/\/$/, "")}/blog`} target="_blank" rel="noopener" className="font-semibold text-primary">/blog</a> and the sitemap automatically.
        </p>
        <div className="divide-y divide-border">
          {list.map((a) => (
            <div key={a.slug} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{a.title}</b>
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>/blog/{a.slug}</span><span>{fmtDate(a.date)}</span><span>{readMinutes(a.body).toLocaleString("en-US")} min read</span>
                </span>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", a.published ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>{a.published ? "Published" : "Draft"}</span>
              {a.published && <a href={`${siteUrl.replace(/\/$/, "")}/blog/${a.slug}`} target="_blank" rel="noopener" aria-label="View" className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ExternalLink className="size-4" /></a>}
              <button type="button" aria-label="Edit" onClick={() => setEdit({ a: { ...a }, prev: a.slug })} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><Pencil className="size-4" /></button>
              <button type="button" aria-label="Delete" onClick={async () => {
                if (!confirm(`Delete the article “${a.title}”?`)) return;
                try { unwrap(await adminDeleteArticleAction(a.slug)); flash("🗑️ Deleted"); load(); } catch (e) { flash("❌ " + err(e)); }
              }} className="grid size-8 place-items-center rounded-lg text-primary hover:bg-primary/10"><Trash2 className="size-4" /></button>
            </div>
          ))}
          {!list.length && <p className="py-8 text-center text-sm text-muted-foreground">No articles yet.</p>}
        </div>
      </Box>
    </div>
  );
}

function Editor({ init, prev, siteUrl, flash, onDone }: { init: Article; prev?: string; siteUrl: string; flash: Flash; onDone: () => void }) {
  const [a, setA] = useState(init);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [preview, setPreview] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const put = (patch: Partial<Article>) => setA((x) => ({ ...x, ...patch }));
  const slugOk = SLUG_RE.test(a.slug);

  async function save() {
    setBusy(true);
    try { unwrap(await adminSaveArticleAction(a, prev)); flash("✅ Article saved"); onDone(); }
    catch (e) { flash("❌ " + err(e)); } finally { setBusy(false); }
  }
  async function upload(f: File) {
    setUp(true);
    try { const { url } = unwrap(await adminUploadCardImageAction(imageForm(await compressImage(f, 1600, 0.86)))); put({ cover: url }); }
    catch (e) { flash("❌ " + err(e)); } finally { setUp(false); }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[60px] z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={onDone}><ArrowLeft className="size-4" /> Back</Button>
        <span className="flex-1" />
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPreview((v) => !v)}><Eye className="size-4" /> {preview ? "Edit" : "Preview"}</Button>
        <Button size="sm" className="rounded-xl" disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <Save className="size-4" />} Save</Button>
      </div>

      {preview ? (
        <Box title="Preview">
          <h1 className="text-2xl font-black leading-[1.5]">{a.title || "Untitled"}</h1>
          <p className="font-semibold leading-8 text-foreground/80">{a.description}</p>
          <Prose text={a.body} />
        </Box>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Box title={prev ? "Edit article" : "New article"}>
            <L t="Title (article headline and Google result title)" hint={`${a.title.length.toLocaleString("en-US")} characters — ideally under 60, with the keyword first`}>
              <input value={a.title} onChange={(e) => put({ title: e.target.value })} className={smallField} placeholder="e.g. Digital menus for bakeries: the complete guide" />
            </L>
            <L t="Short description (below the title on Google)" hint={`${a.description.length.toLocaleString("en-US")} characters — best: 120 to 160`}>
              <textarea value={a.description} onChange={(e) => put({ description: e.target.value })} rows={2} className={cn(smallField, "resize-y leading-7")} />
            </L>
            <L t="Article body" hint={HELP}>
              <textarea value={a.body} onChange={(e) => put({ body: e.target.value })} rows={22} className={cn(smallField, "resize-y font-mono text-[13px] leading-7")} placeholder={"Introduction…\n\n## First heading\nText…\n\n- Point 1\n- Point 2"} />
            </L>
          </Box>
          <div className="space-y-4">
            <Box title="Publishing">
              <Toggle checked={a.published} onChange={(v) => put({ published: v })} label={a.published ? "Published (on the site and Google)" : "Draft (admin only)"} />
              <L t="URL slug" hint={slugOk || !a.slug ? `/blog/${a.slug || "…"}` : "Lowercase letters, numbers and hyphens only"}>
                <input value={a.slug} onChange={(e) => put({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="bakery-digital-menu" className={cn(smallField, a.slug && !slugOk && "border-primary")} />
              </L>
              <L t="Publish date"><input type="date" value={a.date} onChange={(e) => put({ date: e.target.value })} className={smallField} /></L>
              {prev && a.published && <a href={`${siteUrl.replace(/\/$/, "")}/blog/${prev}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs font-semibold text-primary"><ExternalLink className="size-3.5" /> View on site</a>}
            </Box>
            <Box title="Cover image (optional)">
              {a.cover
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={a.cover} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
                : <div className="grid aspect-[16/9] place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">No cover</div>}
              <p className="text-[11px] text-muted-foreground">Recommended size: 1600 × 900 px (16:9)</p>
              <div className="flex gap-2">
                <input ref={file} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
                <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={up} onClick={() => file.current?.click()}>{up ? <Loader2 className="animate-spin" /> : <ImagePlus className="size-4" />} {a.cover ? "Change" : "Upload"}</Button>
                {a.cover && <Button type="button" size="sm" variant="ghost" className="rounded-xl text-primary" onClick={() => put({ cover: "" })}>Remove</Button>}
              </div>
            </Box>
          </div>
        </div>
      )}
    </div>
  );
}
