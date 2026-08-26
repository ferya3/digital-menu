import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ImageIcon,
  QrCode,
  Printer,
  Check,
  UtensilsCrossed,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchMenuRaw,
  addCategory,
  updateCategory,
  deleteCategory,
  addItem,
  updateItem,
  deleteItem,
  qrUrl,
  tableMenuUrl,
  API,
  type ServerMenu,
  type ServerItem,
  type ServerCategory,
} from "@/api";

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toFa = (v: string | number) => String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
const money = (n: number) => toFa((n || 0).toLocaleString("en-US")) + " تومان";
const iconSrc = (p: string) => (/^https?:|^data:/.test(p) ? p : API + p);
const isImg = (s: string) => /^https?:|^data:|^\/images\//.test(s || "");

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

type Section = "products" | "categories" | "qr";

export default function ManageMenu({ flash }: { flash: (m: string) => void }) {
  const [menu, setMenu] = useState<ServerMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("products");
  const [editItem, setEditItem] = useState<ServerItem | "new" | null>(null);
  const [filter, setFilter] = useState("all");

  const reload = () =>
    fetchMenuRaw()
      .then((m) => {
        setMenu(m);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    reload();
  }, []);

  const catName = (id: string) => menu?.categories.find((c) => c.id === id)?.name || "—";
  const items = useMemo(() => {
    if (!menu) return [];
    return filter === "all" ? menu.items : menu.items.filter((i) => i.categoryId === filter);
  }, [menu, filter]);

  if (loading || !menu) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* sub-nav */}
      <div className="mb-4 flex gap-2">
        <SubTab active={section === "products"} onClick={() => setSection("products")} icon={<UtensilsCrossed className="h-4 w-4" />} label="محصولات" />
        <SubTab active={section === "categories"} onClick={() => setSection("categories")} icon={<FolderTree className="h-4 w-4" />} label="دسته‌ها" />
        <SubTab active={section === "qr"} onClick={() => setSection("qr")} icon={<QrCode className="h-4 w-4" />} label="کدهای QR" />
      </div>

      {section === "products" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="all">همهٔ دسته‌ها</option>
              {menu.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button className="rounded-xl" onClick={() => setEditItem("new")}>
              <Plus className="h-4 w-4" /> محصول جدید
            </Button>
          </div>

          <div className="grid gap-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                <Thumb item={it} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{it.name}</span>
                    {it.available === false && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">ناموجود</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {catName(it.categoryId)} ·{" "}
                    <span className="font-semibold text-primary">{money(it.price)}</span>
                    {it.oldPrice > 0 && <span className="line-through"> {money(it.oldPrice)}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditItem(it)} aria-label="ویرایش">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-primary"
                  aria-label="حذف"
                  onClick={async () => {
                    if (!confirm(`حذف «${it.name}»؟`)) return;
                    await deleteItem(it.id).catch(() => {});
                    flash("محصول حذف شد");
                    reload();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {items.length === 0 && <p className="py-10 text-center text-muted-foreground">محصولی نیست.</p>}
          </div>
        </>
      )}

      {section === "categories" && (
        <CategoryManager menu={menu} reload={reload} flash={flash} />
      )}

      {section === "qr" && <QrPanel />}

      {editItem && (
        <ItemForm
          item={editItem === "new" ? null : editItem}
          categories={menu.categories}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null);
            reload();
            flash("ذخیره شد ✅");
          }}
        />
      )}
    </div>
  );
}

function Thumb({ item }: { item: ServerItem }) {
  if (item.image) {
    return <img src={iconSrc(item.image)} alt={item.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
      {item.emoji || "☕"}
    </span>
  );
}

function SubTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition",
        active ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------- product form ---------- */
function ItemForm({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: ServerItem | null;
  categories: ServerCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [categoryId, setCategoryId] = useState(item?.categoryId || categories[0]?.id || "");
  const [price, setPrice] = useState<number | "">(item?.price ?? "");
  const [oldPrice, setOldPrice] = useState<number | "">(item?.oldPrice || "");
  const [description, setDescription] = useState(item?.description || "");
  const [emoji, setEmoji] = useState(item?.emoji || "");
  const [image, setImage] = useState(item?.image || "");
  const [available, setAvailable] = useState(item?.available !== false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        categoryId,
        price: Number(price) || 0,
        oldPrice: Number(oldPrice) || 0,
        description: description.trim(),
        emoji: emoji.trim() || undefined,
        available,
        // فقط اگر عکسِ تازه (data URL) انتخاب شده باشد ارسال کن
        ...(image && image.startsWith("data:") ? { image } : {}),
      };
      if (item) await updateItem(item.id, body);
      else await addItem(body);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="max-h-[88vh] overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{item ? "ویرایش محصول" : "محصول جدید"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام محصول" className="sm:col-span-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="مثلاً کاپوچینو" autoFocus />
          </Field>

          <Field label="دسته">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="ایموجی (اگر عکس نداری)">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={inputCls} placeholder="☕" />
          </Field>

          <Field label="قیمت (تومان)">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} placeholder="72000" />
          </Field>

          <Field label="قیمت قبل از تخفیف (اختیاری)">
            <input type="number" value={oldPrice} onChange={(e) => setOldPrice(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} placeholder="0" />
          </Field>

          <Field label="توضیحات" className="sm:col-span-2">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputCls, "min-h-[64px] resize-y")} placeholder="توضیح کوتاه محصول" />
          </Field>

          <Field label="عکس محصول" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {image ? (
                <img src={iconSrc(image)} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-xl bg-secondary text-2xl">{emoji || "☕"}</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setImage(await readFile(f));
                }}
              />
              <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="h-4 w-4" /> {image ? "تغییر عکس" : "آپلود عکس"}
              </Button>
              {image && (
                <Button variant="ghost" size="icon" onClick={() => setImage("")} aria-label="حذف عکس">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Field>

          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            <span className="text-sm">موجود است (در منو نمایش داده شود)</span>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            انصراف
          </Button>
          <Button className="flex-1 rounded-xl" onClick={save} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "ذخیره"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- categories ---------- */
function CategoryManager({ menu, reload, flash }: { menu: ServerMenu; reload: () => void; flash: (m: string) => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const count = (id: string) => menu.items.filter((i) => i.categoryId === id).length;

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addCategory({ name: name.trim(), icon: icon || undefined });
      setName("");
      setIcon("");
      reload();
      flash("دسته اضافه شد ✅");
    } catch (e) {
      alert(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* add new */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-3">
        <p className="mb-2 text-sm font-bold">دستهٔ جدید</p>
        <div className="flex flex-wrap items-center gap-2">
          {icon ? (
            isImg(icon) ? (
              <img src={iconSrc(icon)} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-2xl">{icon}</span>
            )
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">🍽️</span>
          )}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته" className={cn(inputCls, "w-40 flex-1")} />
          <input value={isImg(icon) ? "" : icon} onChange={(e) => setIcon(e.target.value)} placeholder="ایموجی" className={cn(inputCls, "w-24")} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setIcon(await readFile(f));
            }}
          />
          <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="h-4 w-4" /> عکس
          </Button>
          <Button className="rounded-xl" onClick={add} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-4 w-4" />} افزودن
          </Button>
        </div>
      </div>

      {/* list */}
      <div className="grid gap-2">
        {menu.categories.map((c) => (
          <CategoryRow key={c.id} cat={c} count={count(c.id)} reload={reload} flash={flash} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ cat, count, reload, flash }: { cat: ServerCategory; count: number; reload: () => void; flash: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [icon, setIcon] = useState(cat.icon);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function save() {
    await updateCategory(cat.id, { name: name.trim(), icon }).catch((e) => alert(e.message));
    setEditing(false);
    reload();
    flash("دسته ویرایش شد");
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
      {isImg(icon) ? (
        <img src={iconSrc(icon)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">{icon || "🍽️"}</span>
      )}
      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cn(inputCls, "flex-1")} />
          <input value={isImg(icon) ? "" : icon} onChange={(e) => setIcon(e.target.value)} placeholder="ایموجی" className={cn(inputCls, "w-20")} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setIcon(await readFile(f)); }} />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => fileRef.current?.click()} aria-label="عکس">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-9 w-9" onClick={save} aria-label="ذخیره">
            <Check className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{cat.name}</div>
            <div className="text-xs text-muted-foreground">{toFa(count)} محصول</div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditing(true)} aria-label="ویرایش">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-primary"
            aria-label="حذف"
            onClick={async () => {
              if (!confirm(`حذف دستهٔ «${cat.name}»؟`)) return;
              try {
                await deleteCategory(cat.id);
                flash("دسته حذف شد");
                reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "خطا");
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------- QR ---------- */
function QrPanel() {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(6);
  const tables = useMemo(() => {
    const a = Math.max(1, Math.min(from, to));
    const b = Math.max(from, to);
    const list: number[] = [];
    for (let i = a; i <= Math.min(b, a + 49); i++) list.push(i);
    return list;
  }, [from, to]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
        <Field label="از میز">
          <input type="number" min={1} value={from} onChange={(e) => setFrom(Number(e.target.value) || 1)} className={cn(inputCls, "w-24")} />
        </Field>
        <Field label="تا میز">
          <input type="number" min={1} value={to} onChange={(e) => setTo(Number(e.target.value) || 1)} className={cn(inputCls, "w-24")} />
        </Field>
        <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> چاپ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" id="qr-grid">
        {tables.map((t) => (
          <div key={t} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-3 text-center text-black">
            <div className="font-extrabold">میز {toFa(t)}</div>
            <img src={qrUrl(t)} alt={`QR میز ${t}`} className="h-40 w-40" />
            <div className="break-all text-[10px] text-neutral-500" dir="ltr">
              {tableMenuUrl(t)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
