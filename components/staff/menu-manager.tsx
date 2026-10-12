"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderTree, ImageIcon, Loader2, Pencil, Plus, Save, Trash2, X, Coins, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toFa } from "@/lib/utils";
import { compressImage, imageForm } from "@/lib/client-image";
import type { Menu, MenuCategory, MenuItem } from "@/lib/types";
import {
  staffMenuAction, staffSaveCategoryAction, staffDeleteCategoryAction, staffSaveItemAction,
  staffDeleteItemAction, staffQuickPriceAction, staffUpdateSettingsAction,
} from "@/app/staff/actions";
import { CatIcon, Empty, Field, Panel, Switch, inputCls, isImgSrc, useStaff } from "@/components/staff/kit";

const EMOJIS = ["☕", "🍵", "🥤", "🧊", "🧋", "🍰", "🧁", "🍩", "🍪", "🍦", "🍔", "🍟", "🍕", "🌭", "🥪", "🥗", "🍝", "🍜", "🌮", "🥙", "🍳", "🥞", "🥐", "🍫", "🫖", "🧃"];
const NEW_CAT = "__new__";

export function MenuManager({ onCurrency }: { onCurrency: (c: "toman" | "rial") => void }) {
  const { currency, money, flash } = useStaff();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const reload = () => staffMenuAction().then(setMenu).catch(() => flash("خطا در بارگذاری منو"));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // قیمت‌ها به تومان ذخیره می‌شوند؛ در حالت ریال ×۱۰ نمایش داده می‌شوند
  const toDisplay = (t: number) => (currency === "rial" ? t * 10 : t);
  const fromInput = (v: number) => (currency === "rial" ? Math.round(v / 10) : Math.round(v));
  const unit = currency === "rial" ? "ریال" : "تومان";

  async function setCurrency(c: "toman" | "rial") {
    if (c === currency) return;
    onCurrency(c);
    try { await staffUpdateSettingsAction({ cafe: { currency: c } }); flash(`واحد پول روی «${c === "rial" ? "ریال" : "تومان"}» تنظیم شد`); }
    catch { flash("ذخیره واحد پول ناموفق بود"); }
  }

  if (!menu) return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel title="واحد پول" icon={<Coins className="size-5 text-primary" />}>
        <div className="flex max-w-xs rounded-2xl bg-muted p-1">
          {(["toman", "rial"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)} className={cn("flex-1 rounded-xl py-2 text-sm font-bold transition", currency === c ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}>{c === "toman" ? "تومان" : "ریال"}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">قیمت‌ها بر پایهٔ تومان ذخیره می‌شوند؛ تغییر واحد، نمایش قیمت را در کل سایت (منو، فاکتور و …) عوض می‌کند.</p>
      </Panel>

      <Categories menu={menu} reload={reload} />

      <div ref={formRef} className="scroll-mt-20">
        <ProductForm
          key={editing?.id || "new"}
          item={editing}
          categories={menu.categories}
          unit={unit}
          toDisplay={toDisplay}
          fromInput={fromInput}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      </div>

      <Panel title="لیست محصولات" icon={<PackageOpen className="size-5 text-primary" />} count={toFa(menu.items.length)}>
        {menu.items.length === 0 ? <Empty text="هنوز محصولی اضافه نشده است" /> : (
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
                        toDisplay={toDisplay}
                        fromInput={fromInput}
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

/* ---------- ردیف محصول + ویرایش سریع قیمت ---------- */
function ProductRow({ item, money, unit, toDisplay, fromInput, onEdit, onDeleted }: {
  item: MenuItem; money: (n: number) => string; unit: string;
  toDisplay: (n: number) => number; fromInput: (n: number) => number; onEdit: () => void; onDeleted: () => void;
}) {
  const { flash } = useStaff();
  const [price, setPrice] = useState(String(toDisplay(item.price)));
  const [saving, setSaving] = useState(false);
  const onSale = item.oldPrice && item.oldPrice > item.price;

  async function savePrice() {
    const p = fromInput(Number(price) || 0);
    if (p === item.price) return;
    setSaving(true);
    try { await staffQuickPriceAction(item.id, p); item.price = p; flash(`✅ قیمت «${item.name}» ذخیره شد`); }
    catch { flash("ذخیره نشد"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!confirm(`حذف «${item.name}»؟`)) return;
    try { await staffDeleteItemAction(item.id); flash("🗑️ حذف شد"); onDeleted(); } catch { flash("حذف ناموفق بود"); }
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
          {!item.available && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ناموجود</span>}
          {item.tag && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{item.tag}</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {onSale ? <><s>{money(item.oldPrice!)}</s> <b className="text-primary">{money(item.price)}</b></> : money(item.price)}
          {item.desc && " · " + item.desc}
        </div>
      </div>
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <input
          type="number" min={0} step={1000} value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); savePrice(); } }}
          aria-label="قیمت" title={`ویرایش سریع قیمت (${unit})`}
          className={cn(inputCls, "w-28 py-1.5 text-center")} dir="ltr"
        />
        <Button size="icon" className="size-8 shrink-0 rounded-xl" onClick={savePrice} disabled={saving} title="ذخیره قیمت">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}</Button>
        <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={onEdit}><Pencil className="size-3.5" /> ویرایش</Button>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-primary" onClick={remove} aria-label="حذف"><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}

/* ---------- فرم افزودن/ویرایش محصول ---------- */
function ProductForm({ item, categories, unit, toDisplay, fromInput, onCancel, onSaved }: {
  item: MenuItem | null; categories: MenuCategory[]; unit: string;
  toDisplay: (n: number) => number; fromInput: (n: number) => number; onCancel: () => void; onSaved: () => void;
}) {
  const { flash } = useStaff();
  const [name, setName] = useState(item?.name || "");
  const [cat, setCat] = useState(item?.category || categories[0]?.id || NEW_CAT);
  const [newCat, setNewCat] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [price, setPrice] = useState(item ? String(toDisplay(item.price)) : "");
  const [oldPrice, setOldPrice] = useState(item?.oldPrice ? String(toDisplay(item.oldPrice)) : "");
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
    if (!name.trim()) return flash("نام محصول را وارد کنید");
    if (cat === NEW_CAT && !newCat.trim()) return flash("نام دستهٔ جدید را وارد کنید");
    setSaving(true);
    try {
      await staffSaveItemAction({
        id: item?.id,
        name: name.trim(),
        categoryId: cat === NEW_CAT ? "" : cat,
        newCategory: cat === NEW_CAT ? { name: newCat.trim(), emoji: newCatIcon.trim() || "🍽️" } : undefined,
        price: fromInput(Number(price) || 0),
        oldPrice: oldPrice ? fromInput(Number(oldPrice)) : 0,
        description: desc.trim(),
        emoji: emoji.trim() || undefined,
        tag: tag.trim(),
        available,
        image,
      }, blob ? imageForm(blob) : null);
      flash(item ? "✅ محصول ویرایش شد" : "✅ محصول اضافه شد");
      onSaved();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا در ذخیره")); } finally { setSaving(false); }
  }

  return (
    <Panel title={item ? `ویرایش: ${item.name}` : "افزودن محصول"} icon={item ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />} className={cn(item && "ring-2 ring-primary/40")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام محصول *" className="sm:col-span-2"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="مثلاً کاپوچینو" /></Field>
        <Field label="دسته‌بندی">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls}>
            {categories.map((c) => <option key={c.id} value={c.id}>{isImgSrc(c.emoji) ? "" : c.emoji + " "}{c.name}</option>)}
            <option value={NEW_CAT}>➕ دستهٔ جدید…</option>
          </select>
        </Field>
        {cat === NEW_CAT ? (
          <Field label="دستهٔ جدید (ایموجی + نام)">
            <div className="flex gap-2">
              <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} maxLength={4} placeholder="🍔" className={cn(inputCls, "w-16 text-center text-lg")} />
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="مثلاً برگرها" className={inputCls} />
            </div>
          </Field>
        ) : (
          <Field label="برچسب (اختیاری)" hint="مثل «محبوب» — برچسب‌دارها در «منتخب باریستا» می‌آیند"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="محبوب" /></Field>
        )}
        <Field label={`قیمت (${unit})`}><input type="number" min={0} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="0" dir="ltr" /></Field>
        <Field label={`قیمت قبل از تخفیف (${unit} — اختیاری)`}><input type="number" min={0} step={1000} value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className={inputCls} placeholder="خالی = بدون تخفیف" dir="ltr" /></Field>
        {cat === NEW_CAT && <Field label="برچسب (اختیاری)"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="محبوب" /></Field>}
        <Field label="ایموجی (اگر عکس ندارد)"><input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputCls} placeholder="☕" /></Field>
        <Field label="توضیحات / ترکیبات" className="sm:col-span-2"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} className={cn(inputCls, "min-h-16 resize-y")} placeholder="مثلاً اسپرسو با شیر و فوم" /></Field>
        <Field label="عکس محصول" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-2xl">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : emoji || "🍽️"}
            </span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { const b = await compressImage(f, 1200); setBlob(b); setBlobUrl(URL.createObjectURL(b)); } catch { flash("خطا در خواندن عکس"); } } }} />
            <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /> {preview ? "تغییر عکس" : "آپلود عکس"}</Button>
            {preview && <Button variant="ghost" size="icon" onClick={() => { setImage(""); setBlob(null); setBlobUrl(""); }} aria-label="حذف عکس"><X /></Button>}
          </div>
        </Field>
        <div className="sm:col-span-2"><Switch checked={available} onChange={setAvailable} label="موجود است" /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={save} disabled={saving}>{saving ? <><Loader2 className="animate-spin" /> در حال ذخیره…</> : item ? "ذخیره تغییرات" : "ذخیره محصول"}</Button>
        {item && <Button variant="outline" className="rounded-xl" onClick={onCancel}>انصراف</Button>}
      </div>
    </Panel>
  );
}

/* ---------- دسته‌بندی‌ها ---------- */
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
    if (!name.trim()) return flash("نام دسته را وارد کنید");
    setBusy(true);
    try {
      // اگر عکسِ قبلی دست‌نخورده بماند، همان مسیر نگه داشته می‌شود
      const keep = !iconBlob && iconUrl && !icon ? iconUrl : icon;
      await staffSaveCategoryAction({ id: editing?.id, name: name.trim(), emoji: keep || "🍽️" }, iconBlob ? imageForm(iconBlob) : null);
      flash(editing ? "✅ دسته ویرایش شد" : "✅ دسته اضافه شد");
      reset(); reload();
    } catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا")); } finally { setBusy(false); }
  }
  async function remove(c: MenuCategory) {
    if (!confirm(`حذف دستهٔ «${c.name}»؟`)) return;
    try { await staffDeleteCategoryAction(c.id); flash("🗑️ دسته حذف شد"); if (editing?.id === c.id) reset(); reload(); }
    catch (e) { flash("❌ " + (e instanceof Error ? e.message : "خطا در حذف")); }
  }

  return (
    <Panel title="دسته‌بندی‌ها" icon={<FolderTree className="size-5 text-primary" />} count={toFa(menu.categories.length)}>
      {menu.categories.length === 0 ? <Empty text="دسته‌ای وجود ندارد" /> : (
        <div className="space-y-2">
          {menu.categories.map((c) => (
            <div key={c.id} className={cn("flex items-center gap-3 rounded-2xl border border-border bg-background p-2", editing?.id === c.id && "ring-2 ring-primary/40")}>
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-xl"><CatIcon icon={c.emoji} /></span>
              <span className="min-w-0 flex-1 truncate font-bold">{c.name} <span className="text-xs font-normal text-muted-foreground">({toFa(count(c.id))} محصول)</span></span>
              <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => startEdit(c)}>ویرایش</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-xl text-primary" onClick={() => remove(c)}>حذف</Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{editing ? `✏️ ویرایش دسته: ${editing.name}` : "افزودن دستهٔ جدید"}</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { setIcon(e); setIconBlob(null); setIconUrl(""); }} className={cn("grid size-9 place-items-center rounded-xl border text-lg transition hover:bg-muted", icon === e ? "border-primary bg-primary/10" : "border-border")}>{e}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={icon} onChange={(e) => { setIcon(e.target.value); setIconBlob(null); setIconUrl(""); }} maxLength={4} placeholder="🍔" className={cn(inputCls, "w-16 text-center text-lg")} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته (مثلاً برگرها)" className={inputCls} onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { const b = await compressImage(f, 240); setIconBlob(b); setIconUrl(URL.createObjectURL(b)); setIcon(""); } catch { flash("عکس خوانده نشد"); } } }} />
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><ImageIcon className="size-4" /> آپلود عکس آیکون</Button>
          <span className="text-[11px] text-muted-foreground">اختیاری — به‌جای ایموجی عکس خودت را بگذار</span>
          {iconUrl && (
            <span className="relative size-10 overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="" className="size-full object-cover" />
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button className="rounded-xl" onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : editing ? "ذخیره تغییرات" : <><Plus className="size-4" /> افزودن دسته</>}</Button>
          {editing && <Button variant="outline" className="rounded-xl" onClick={reset}>انصراف</Button>}
        </div>
      </div>
    </Panel>
  );
}
