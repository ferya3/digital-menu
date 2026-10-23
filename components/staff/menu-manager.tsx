"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderTree, ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X, Coins, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, num, parsePrice } from "@/lib/utils";
import { compressImage, imageForm, IMAGE_ACCEPT } from "@/lib/client-image";
import type { Menu, MenuCategory, MenuItem } from "@/lib/types";
import {
  staffMenuAction, staffSaveCategoryAction, staffDeleteCategoryAction, staffSaveItemAction, staffCategoryBannerAction,
  staffDeleteItemAction, staffQuickPriceAction,
} from "@/app/staff/actions";
import { CatIcon, Empty, Field, Panel, Switch, inputCls, isImgSrc, useStaff } from "@/components/staff/kit";
import { unwrap } from "@/lib/action-result";

const EMOJIS = ["☕", "🍵", "🥤", "🧊", "🧋", "🍰", "🧁", "🍩", "🍪", "🍦", "🍔", "🍟", "🍕", "🌭", "🥪", "🥗", "🍝", "🍜", "🌮", "🥙", "🍳", "🥞", "🥐", "🍫", "🫖", "🧃"];
const NEW_CAT = "__new__";

/** "USD ($)" — the currency code with its symbol when it differs */
function currencyLabel(code: string) {
  try {
    const sym = new Intl.NumberFormat("en-US", { style: "currency", currency: code }).formatToParts(0).find((p) => p.type === "currency")?.value;
    return sym && sym !== code ? `${code} (${sym})` : code;
  } catch { return code; }
}
/** Price as shown in an input: plain decimal, no trailing zeros ("4.5") */
const priceStr = (n: number | undefined) => (n ? String(n) : "");

export function MenuManager() {
  const { currency, money, flash } = useStaff();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const reload = () => staffMenuAction().then(setMenu).catch(() => flash("Couldn't load the menu"));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prices are stored as decimal numbers in the venue currency (set in Settings)
  const unit = currencyLabel(currency);

  if (!menu) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Coins className="size-4 shrink-0 text-primary" />
        <span>Prices are in <b className="text-foreground">{unit}</b>. You can change the currency in Settings.</span>
      </div>

      <Categories menu={menu} reload={reload} />

      <div ref={formRef} className="scroll-mt-20">
        <ProductForm
          key={editing?.id || "new"}
          item={editing}
          categories={menu.categories}
          unit={unit}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      </div>

      <Panel title="Menu items" icon={<PackageOpen className="size-5 text-primary" />} count={num(menu.items.length)}>
        {menu.items.length === 0 ? <Empty text="No items yet" /> : (
          <div className="space-y-4">
            {menu.categories.map((cat) => {
              const items = menu.items.filter((it) => it.category === cat.id);
              if (!items.length) return null;
              return (
                <div key={cat.id}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-extrabold">
                    <span className="grid size-7 place-items-center overflow-hidden rounded-lg bg-muted text-base"><CatIcon icon={cat.emoji} /></span>
                    {cat.name}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <ProductRow
                        key={it.id + it.price + currency}
                        item={it}
                        money={money}
                        unit={unit}
                        onEdit={() => { setEditing(it); formRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                        onDeleted={reload}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------- Item row + quick price edit ---------- */
function ProductRow({ item, money, unit, onEdit, onDeleted }: {
  item: MenuItem; money: (n: number) => string; unit: string; onEdit: () => void; onDeleted: () => void;
}) {
  const { flash } = useStaff();
  const [price, setPrice] = useState(String(item.price));
  const [saving, setSaving] = useState(false);
  const onSale = item.oldPrice && item.oldPrice > item.price;

  async function savePrice() {
    const p = parsePrice(price);
    if (p === item.price) return;
    setSaving(true);
    try { await staffQuickPriceAction(item.id, p); item.price = p; setPrice(String(p)); flash(`✅ Price for “${item.name}” saved`); }
    catch { flash("Couldn't save"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!confirm(`Delete “${item.name}”?`)) return;
    try { await staffDeleteItemAction(item.id); flash("🗑️ Deleted"); onDeleted(); } catch { flash("Couldn't delete"); }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-2.5 sm:flex-nowrap", !item.available && "opacity-60")}>
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="size-full object-cover" />
        ) : item.emoji || "🍽️"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-bold">{item.name}</span>
          {!item.available && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Unavailable</span>}
          {item.tag && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{item.tag}</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {onSale ? <><s>{money(item.oldPrice!)}</s> <b className="text-primary">{money(item.price)}</b></> : money(item.price)}
          {item.desc && " · " + item.desc}
        </div>
      </div>
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <input
          type="number" inputMode="decimal" min={0} step={0.01} value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); savePrice(); } }}
          aria-label="Price" title={`Quick price edit (${unit})`}
          className={cn(inputCls, "w-28 py-1.5 text-center")}
        />
        <Button size="icon" className="size-8 shrink-0 rounded-xl" onClick={savePrice} disabled={saving} title="Save price">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}</Button>
        <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={onEdit}><Pencil className="size-3.5" /> Edit</Button>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-primary" onClick={remove} aria-label="Delete"><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}

/* ---------- Add/edit item form ---------- */
function ProductForm({ item, categories, unit, onCancel, onSaved }: {
  item: MenuItem | null; categories: MenuCategory[]; unit: string; onCancel: () => void; onSaved: () => void;
}) {
  const { flash } = useStaff();
  const [name, setName] = useState(item?.name || "");
  const [cat, setCat] = useState(item?.category || categories[0]?.id || NEW_CAT);
  const [newCat, setNewCat] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [oldPrice, setOldPrice] = useState(priceStr(item?.oldPrice));
  const [desc, setDesc] = useState(item?.desc || "");
  const [emoji, setEmoji] = useState(item?.emoji || "");
  const [tag, setTag] = useState(item?.tag || "");
  const [image, setImage] = useState(item?.image || "");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [available, setAvailable] = useState(item?.available !== false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const preview = blobUrl || image;

  async function save() {
    if (!name.trim()) return flash("Enter an item name");
    if (cat === NEW_CAT && !newCat.trim()) return flash("Enter a name for the new category");
    setSaving(true);
    try {
      unwrap(await staffSaveItemAction({
        id: item?.id,
        name: name.trim(),
        categoryId: cat === NEW_CAT ? "" : cat,
        newCategory: cat === NEW_CAT ? { name: newCat.trim(), emoji: newCatIcon.trim() || "🍽️" } : undefined,
        price: parsePrice(price),
        oldPrice: oldPrice ? parsePrice(oldPrice) : 0,
        description: desc.trim(),
        emoji: emoji.trim() || undefined,
        tag: tag.trim(),
        available,
        image,
      }, blob ? imageForm(blob) : null));
      flash(item ? "✅ Item updated" : "✅ Item added");
      onSaved();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Couldn't save")); } finally { setSaving(false); }
  }

  return (
    <Panel title={item ? `Edit: ${item.name}` : "Add item"} icon={item ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />} className={cn(item && "ring-2 ring-primary/40")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Item name *" className="sm:col-span-2"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Cappuccino" /></Field>
        <Field label="Category">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls}>
            {categories.map((c) => <option key={c.id} value={c.id}>{isImgSrc(c.emoji) ? "" : c.emoji + " "}{c.name}</option>)}
            <option value={NEW_CAT}>➕ New category…</option>
          </select>
        </Field>
        {cat === NEW_CAT ? (
          <Field label="New category (emoji + name)">
            <div className="flex gap-2">
              <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} maxLength={4} placeholder="🍔" className={cn(inputCls, "w-16 text-center text-lg")} />
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Burgers" className={inputCls} />
            </div>
          </Field>
        ) : (
          <Field label="Tag (optional)" hint="e.g. “Popular” — tagged items appear under “Featured”"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="Popular" /></Field>
        )}
        <Field label={`Price (${unit})`}><input type="number" inputMode="decimal" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="0.00" /></Field>
        <Field label={`Price before discount (${unit}, optional)`}><input type="number" inputMode="decimal" min={0} step={0.01} value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className={inputCls} placeholder="Empty = no discount" /></Field>
        {cat === NEW_CAT && <Field label="Tag (optional)"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="Popular" /></Field>}
        <Field label="Emoji (if there's no photo)"><input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputCls} placeholder="☕" /></Field>
        <Field label="Description / ingredients" className="sm:col-span-2"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={cn(inputCls, "min-h-16 resize-y")} placeholder="e.g. Espresso with steamed milk and foam" /></Field>
        <Field label="Item photo" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : emoji || "🍽️"}
            </span>
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { const b = await compressImage(f, 1200); setBlob(b); setBlobUrl(URL.createObjectURL(b)); } catch { flash("Couldn't read the image"); } } }} />
            <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /> {preview ? "Change photo" : "Upload photo"}</Button>
            {preview && <Button variant="ghost" size="icon" onClick={() => { setImage(""); setBlob(null); setBlobUrl(""); }} aria-label="Remove photo"><X /></Button>}
          </div>
        </Field>
        <div className="sm:col-span-2"><Switch checked={available} onChange={setAvailable} label="Available" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={save} disabled={saving}>{saving ? <><Loader2 className="animate-spin" /> Saving…</> : item ? "Save changes" : "Save item"}</Button>
        {item && <Button variant="outline" className="rounded-xl" onClick={onCancel}>Cancel</Button>}
      </div>
    </Panel>
  );
}

/* ---------- Full-width promo banner per category ---------- */
function CategoryBanner({ cat, reload }: { cat: MenuCategory; reload: () => void }) {
  const { flash } = useStaff();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  async function upload(f: File) {
    setBusy(true);
    try {
      const b = await compressImage(f, 1800, 0.86);
      unwrap(await staffCategoryBannerAction(cat.id, imageForm(b)));
      flash(`✅ Banner for “${cat.name}” saved`);
      reload();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Remove the banner for “${cat.name}”?`)) return;
    setBusy(true);
    try { unwrap(await staffCategoryBannerAction(cat.id, null)); flash("Banner removed"); reload(); }
    catch { flash("Error"); } finally { setBusy(false); }
  }
  return (
    <div className="mt-2">
      <input ref={ref} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      {cat.banner ? (
        <div className="relative overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cat.banner + "?w=720"} alt="" className="aspect-[12/5] w-full object-cover" />
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8 rounded-xl bg-white/90 text-stone-900" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <><ImageIcon className="size-3.5" /> Replace banner</>}</Button>
            <Button size="sm" variant="outline" className="h-8 rounded-xl bg-white/90 text-primary" disabled={busy} onClick={remove}><Trash2 className="size-3.5" /> Remove</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />} Add a promo banner (full width, above this category — 1200×500 recommended)
        </button>
      )}
    </div>
  );
}

/* ---------- Categories ---------- */
function Categories({ menu, reload }: { menu: Menu; reload: () => void }) {
  const { flash } = useStaff();
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [iconUrl, setIconUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const count = useMemo(() => (id: string) => menu.items.filter((i) => i.category === id).length, [menu]);

  function reset() { setEditing(null); setName(""); setIcon(""); setIconBlob(null); setIconUrl(""); }
  function startEdit(c: MenuCategory) {
    setEditing(c); setName(c.name);
    if (isImgSrc(c.emoji)) { setIcon(""); setIconUrl(c.emoji); } else { setIcon(c.emoji); setIconUrl(""); }
    setIconBlob(null);
  }
  async function save() {
    if (!name.trim()) return flash("Enter a category name");
    setBusy(true);
    try {
      // Keep the existing image path if it wasn't changed
      const keep = !iconBlob && iconUrl && !icon ? iconUrl : icon;
      unwrap(await staffSaveCategoryAction({ id: editing?.id, name: name.trim(), emoji: keep || "🍽️" }, iconBlob ? imageForm(iconBlob) : null));
      flash(editing ? "✅ Category updated" : "✅ Category added");
      reset(); reload();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Error")); } finally { setBusy(false); }
  }
  async function remove(c: MenuCategory) {
    if (!confirm(`Delete the category “${c.name}”?`)) return;
    try { unwrap(await staffDeleteCategoryAction(c.id)); flash("🗑️ Category deleted"); if (editing?.id === c.id) reset(); reload(); }
    catch (e) { flash("❌ " + (e instanceof Error ? e.message : "Couldn't delete")); }
  }

  return (
    <Panel title="Categories" icon={<FolderTree className="size-5 text-primary" />} count={num(menu.categories.length)}>
      {menu.categories.length === 0 ? <Empty text="No categories yet" /> : (
        <div className="space-y-2">
          {menu.categories.map((c) => (
            <div key={c.id} className={cn("rounded-2xl border border-border bg-background p-2", editing?.id === c.id && "ring-2 ring-primary/40")}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-xl"><CatIcon icon={c.emoji} /></span>
                <span className="min-w-0 flex-1 truncate font-bold">{c.name} <span className="text-xs font-normal text-muted-foreground">({num(count(c.id))} {count(c.id) === 1 ? "item" : "items"})</span></span>
                <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => startEdit(c)}>Edit</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" onClick={() => remove(c)}>Delete</Button>
              </div>
              <CategoryBanner cat={c} reload={reload} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{editing ? `✏️ Editing category: ${editing.name}` : "Add a new category"}</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { setIcon(e); setIconBlob(null); setIconUrl(""); }} className={cn("grid size-9 place-items-center rounded-xl border text-lg transition hover:bg-muted", icon === e ? "border-primary bg-primary/10" : "border-border")}>{e}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={icon} onChange={(e) => { setIcon(e.target.value); setIconBlob(null); setIconUrl(""); }} maxLength={4} placeholder="🍔" className={cn(inputCls, "w-16 text-center text-lg")} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name (e.g. Burgers)" className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { const b = await compressImage(f, 240); setIconBlob(b); setIconUrl(URL.createObjectURL(b)); setIcon(""); } catch { flash("Couldn't read the image"); } } }} />
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /> Upload icon image</Button>
          <span className="text-[11px] text-muted-foreground">Optional — use your own image instead of an emoji</span>
          {iconUrl && (
            <span className="relative size-10 overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="" className="size-full object-cover" />
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button className="rounded-xl" onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : editing ? "Save changes" : <><Plus className="size-4" /> Add category</>}</Button>
          {editing && <Button variant="outline" className="rounded-xl" onClick={reset}>Cancel</Button>}
        </div>
      </div>
    </Panel>
  );
}
