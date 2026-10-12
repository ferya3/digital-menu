"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, X, Loader2, ImageIcon, QrCode, Printer,
  Check, UtensilsCrossed, FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, money } from "@/lib/utils";
import { compressImage, imageForm } from "@/lib/client-image";
import type { Menu, MenuCategory, MenuItem } from "@/lib/types";
import {
  staffMenuAction, staffAddCategoryAction, staffUpdateCategoryAction,
  staffDeleteCategoryAction, staffSaveItemAction, staffDeleteItemAction,
} from "@/app/staff/actions";

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) => String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
const isImg = (s: string) => /^https?:|^data:|^\/uploads\//.test(s || "");
const input = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type Section = "products" | "categories" | "qr";

export function MenuManager({ flash }: { flash: (m: string) => void }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [section, setSection] = useState<Section>("products");
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<MenuItem | "new" | null>(null);

  const reload = () => staffMenuAction().then(setMenu).catch(() => {});
  useEffect(() => { reload(); }, []);

  const catName = (id: string) => menu?.categories.find((c) => c.id === id)?.name || "—";
  const items = useMemo(() => (!menu ? [] : filter === "all" ? menu.items : menu.items.filter((i) => i.category === filter)), [menu, filter]);

  if (!menu) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Sub active={section === "products"} onClick={() => setSection("products")} icon={<UtensilsCrossed className="size-4" />} label="محصولات" />
        <Sub active={section === "categories"} onClick={() => setSection("categories")} icon={<FolderTree className="size-4" />} label="دسته‌ها" />
        <Sub active={section === "qr"} onClick={() => setSection("qr")} icon={<QrCode className="size-4" />} label="کدهای QR" />
      </div>

      {section === "products" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(input, "w-auto")}>
              <option value="all">همهٔ دسته‌ها</option>
              {menu.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button className="rounded-xl" onClick={() => setEdit("new")}><Plus className="size-4" /> محصول جدید</Button>
          </div>
          <div className="grid gap-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{it.emoji || "☕"}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-bold">{it.name}</span>{!it.available && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ناموجود</span>}</div>
                  <div className="text-xs text-muted-foreground">{catName(it.category)} · <span className="font-semibold text-primary">{money(it.price)}</span>{it.oldPrice ? <span className="line-through"> {money(it.oldPrice)}</span> : null}</div>
                </div>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setEdit(it)} aria-label="ویرایش"><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-9 text-primary" aria-label="حذف" onClick={async () => { if (!confirm(`حذف «${it.name}»؟`)) return; await staffDeleteItemAction(it.id).catch(() => {}); flash("محصول حذف شد"); reload(); }}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            {items.length === 0 && <p className="py-10 text-center text-muted-foreground">محصولی نیست.</p>}
          </div>
        </>
      )}

      {section === "categories" && <Categories menu={menu} reload={reload} flash={flash} />}
      {section === "qr" && <QrPanel />}

      {edit && (
        <ItemForm item={edit === "new" ? null : edit} categories={menu.categories} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); flash("ذخیره شد ✅"); }} />
      )}
    </div>
  );
}

function Sub({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition", active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>{icon}{label}</button>;
}

function ItemForm({ item, categories, onClose, onSaved }: { item: MenuItem | null; categories: MenuCategory[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const [categoryId, setCategoryId] = useState(item?.category || categories[0]?.id || "");
  const [price, setPrice] = useState<number | "">(item?.price ?? "");
  const [oldPrice, setOldPrice] = useState<number | "">(item?.oldPrice || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [emoji, setEmoji] = useState(item?.emoji || "");
  const [tag, setTag] = useState(item?.tag || "");
  const [image, setImage] = useState(item?.image || "");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [available, setAvailable] = useState(item?.available !== false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await staffSaveItemAction({
        id: item?.id, name: name.trim(), categoryId, price: Number(price) || 0,
        oldPrice: Number(oldPrice) || 0, description: desc.trim(), emoji: emoji.trim() || undefined,
        tag: tag.trim(), available, image,
      }, imageBlob ? imageForm(imageBlob) : null);
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : "خطا"); } finally { setSaving(false); }
  }
  const preview = blobUrl || image;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="max-h-[88vh] overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{item ? "ویرایش محصول" : "محصول جدید"}</h2><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام محصول" full><input value={name} onChange={(e) => setName(e.target.value)} className={input} autoFocus placeholder="مثلاً کاپوچینو" /></Field>
          <Field label="دسته"><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="ایموجی (اگر عکس نداری)"><input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={input} placeholder="☕" /></Field>
          <Field label="قیمت (تومان)"><input type="number" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} className={input} placeholder="72000" /></Field>
          <Field label="قیمت قبل از تخفیف"><input type="number" value={oldPrice} onChange={(e) => setOldPrice(e.target.value === "" ? "" : Number(e.target.value))} className={input} placeholder="0" /></Field>
          <Field label="برچسب (اختیاری)"><input value={tag} onChange={(e) => setTag(e.target.value)} className={input} placeholder="محبوب" /></Field>
          <Field label="توضیحات" full><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={cn(input, "min-h-16 resize-y")} /></Field>
          <Field label="عکس محصول" full>
            <div className="flex items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-16 rounded-xl object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-xl bg-muted text-2xl">{emoji || "☕"}</span>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const b = await compressImage(f, 1200); setImageBlob(b); setBlobUrl(URL.createObjectURL(b)); } }} />
              <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /> {preview ? "تغییر عکس" : "آپلود عکس"}</Button>
              {preview && <Button variant="ghost" size="icon" onClick={() => { setImage(""); setImageBlob(null); setBlobUrl(""); }}><X /></Button>}
            </div>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="size-4 accent-primary" /><span className="text-sm">موجود است</span></label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>انصراف</Button>
          <Button className="flex-1 rounded-xl" onClick={save} disabled={saving || !name.trim()}>{saving ? <Loader2 className="animate-spin" /> : "ذخیره"}</Button>
        </div>
      </div>
    </div>
  );
}

function Categories({ menu, reload, flash }: { menu: Menu; reload: () => void; flash: (m: string) => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const count = (id: string) => menu.items.filter((i) => i.category === id).length;
  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try { await staffAddCategoryAction({ name: name.trim(), emoji: emoji || undefined }); setName(""); setEmoji(""); reload(); flash("دسته اضافه شد ✅"); }
    catch (e) { alert(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="mb-4 rounded-2xl border border-border bg-card p-3">
        <p className="mb-2 text-sm font-bold">دستهٔ جدید</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" className={cn(input, "w-40 flex-1")} />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="ایموجی" className={cn(input, "w-24")} />
          <Button className="rounded-xl" onClick={add} disabled={busy || !name.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />} افزودن</Button>
        </div>
      </div>
      <div className="grid gap-2">
        {menu.categories.map((c) => <CatRow key={c.id} cat={c} count={count(c.id)} reload={reload} flash={flash} />)}
      </div>
    </div>
  );
}
function CatRow({ cat, count, reload, flash }: { cat: MenuCategory; count: number; reload: () => void; flash: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [emoji, setEmoji] = useState(cat.emoji);
  async function save() { await staffUpdateCategoryAction(cat.id, { name: name.trim(), emoji }).catch((e) => alert(e.message)); setEditing(false); reload(); flash("ویرایش شد"); }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{cat.emoji || "🍽️"}</span>
      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "flex-1")} />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="ایموجی" className={cn(input, "w-20")} />
          <Button size="icon" className="size-9" onClick={save}><Check className="size-4" /></Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{cat.name}</div><div className="text-xs text-muted-foreground">{toFa(count)} محصول</div></div>
          <Button variant="ghost" size="icon" className="size-9" onClick={() => setEditing(true)}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-9 text-primary" onClick={async () => { if (!confirm(`حذف «${cat.name}»؟`)) return; try { await staffDeleteCategoryAction(cat.id); flash("دسته حذف شد"); reload(); } catch (e) { alert(e instanceof Error ? e.message : "خطا"); } }}><Trash2 className="size-4" /></Button>
        </>
      )}
    </div>
  );
}

function QrPanel() {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(6);
  const tables = useMemo(() => {
    const a = Math.max(1, Math.min(from, to)), b = Math.max(from, to), list: number[] = [];
    for (let i = a; i <= Math.min(b, a + 49); i++) list.push(i);
    return list;
  }, [from, to]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
        <Field label="از میز"><input type="number" min={1} value={from} onChange={(e) => setFrom(Number(e.target.value) || 1)} className={cn(input, "w-24")} /></Field>
        <Field label="تا میز"><input type="number" min={1} value={to} onChange={(e) => setTo(Number(e.target.value) || 1)} className={cn(input, "w-24")} /></Field>
        <Button variant="outline" className="rounded-xl" onClick={() => window.print()}><Printer className="size-4" /> چاپ</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <div key={t} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-3 text-center text-black">
            <div className="font-extrabold">میز {toFa(t)}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/qr?table=${t}`} alt={`QR میز ${t}`} className="size-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</label>;
}
