import { CATEGORIES, DISHES, type Category, type Dish } from "@/lib/data";

export type BusinessKind = "cafe" | "restaurant" | "fastfood" | "other";
export const KIND_LABEL: Record<BusinessKind, string> = {
  cafe: "کافه / کافی‌شاپ",
  restaurant: "رستوران",
  fastfood: "فست‌فود",
  other: "سایر (قنادی، آبمیوه، بستنی…)",
};

const RESTAURANT: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "starter", name: "پیش‌غذا", emoji: "🥗" },
    { id: "kabab", name: "کباب‌ها", emoji: "🍢" },
    { id: "main", name: "غذای اصلی", emoji: "🍛" },
    { id: "drink", name: "نوشیدنی", emoji: "🥤" },
    { id: "dessert", name: "دسر", emoji: "🍮" },
  ],
  dishes: [
    { id: "soup", category: "starter", name: "سوپ جو", desc: "سوپ جوی خانگی با هویج و جعفری", price: 85000, emoji: "🍲" },
    { id: "salad", category: "starter", name: "سالاد شیرازی", desc: "خیار، گوجه، پیاز و آبغوره", price: 45000, emoji: "🥗" },
    { id: "koobide", category: "kabab", name: "چلوکباب کوبیده", desc: "دو سیخ کوبیدهٔ گوسفندی با برنج ایرانی", price: 420000, emoji: "🍢", tag: "محبوب" },
    { id: "joojeh", category: "kabab", name: "چلوجوجه کباب", desc: "جوجهٔ زعفرانی با برنج و گوجهٔ کبابی", price: 380000, emoji: "🍗" },
    { id: "barg", category: "kabab", name: "چلوکباب برگ", desc: "فیلهٔ گوساله، مزه‌دارشده با پیاز و زعفران", price: 690000, emoji: "🥩", tag: "پیشنهاد سرآشپز" },
    { id: "ghormeh", category: "main", name: "چلو خورش قورمه‌سبزی", desc: "قورمه‌سبزیِ جاافتاده با گوشت گوسفندی", price: 320000, emoji: "🍛" },
    { id: "zereshk", category: "main", name: "زرشک‌پلو با مرغ", desc: "ران مرغ زعفرانی با زرشک‌پلو", price: 340000, emoji: "🍗" },
    { id: "doogh", category: "drink", name: "دوغ محلی", desc: "دوغ گازدار با نعنا", price: 35000, emoji: "🥛" },
    { id: "soda", category: "drink", name: "نوشابه", desc: "قوطی ۳۳۰ میلی‌لیتری", price: 30000, emoji: "🥤" },
    { id: "sholeh", category: "dessert", name: "شله‌زرد", desc: "شله‌زردِ زعفرانی با دارچین", price: 60000, emoji: "🍮" },
  ],
};

const FASTFOOD: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "pizza", name: "پیتزا", emoji: "🍕" },
    { id: "burger", name: "برگر", emoji: "🍔" },
    { id: "sandwich", name: "ساندویچ", emoji: "🌭" },
    { id: "fried", name: "سوخاری و پیش‌غذا", emoji: "🍟" },
    { id: "drink", name: "نوشیدنی", emoji: "🥤" },
  ],
  dishes: [
    { id: "pepperoni", category: "pizza", name: "پیتزا پپرونی", desc: "پپرونی تند، پنیر موتزارلا و سس مخصوص", price: 380000, emoji: "🍕", tag: "محبوب" },
    { id: "mix", category: "pizza", name: "پیتزا مخلوط", desc: "ژامبون، قارچ، فلفل دلمه‌ای و پنیر", price: 360000, emoji: "🍕" },
    { id: "cheese", category: "burger", name: "چیزبرگر", desc: "۱۵۰ گرم گوشت خالص، پنیر چدار و سس", price: 290000, emoji: "🍔" },
    { id: "double", category: "burger", name: "دبل برگر", desc: "دو لایه گوشت، پنیر و قارچ", price: 420000, emoji: "🍔", tag: "پیشنهاد ویژه" },
    { id: "hotdog", category: "sandwich", name: "هات‌داگ", desc: "سوسیس آلمانی، خیارشور و سس", price: 180000, emoji: "🌭" },
    { id: "olivieh", category: "sandwich", name: "ساندویچ الویه", desc: "الویهٔ خانگی با نان باگت", price: 150000, emoji: "🥪" },
    { id: "fries", category: "fried", name: "سیب‌زمینی سرخ‌کرده", desc: "سیب‌زمینی ترد با ادویهٔ مخصوص", price: 120000, emoji: "🍟" },
    { id: "wings", category: "fried", name: "بال سوخاری", desc: "۶ تکه بال تند سوخاری", price: 260000, emoji: "🍗" },
    { id: "cola", category: "drink", name: "نوشابه", desc: "قوطی ۳۳۰ میلی‌لیتری", price: 35000, emoji: "🥤" },
    { id: "shake", category: "drink", name: "شیک شکلات", desc: "بستنی وانیلی و شکلات", price: 160000, emoji: "🥤" },
  ],
};

const OTHER: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "special", name: "پیشنهاد ویژه", emoji: "⭐" },
    { id: "drink", name: "نوشیدنی", emoji: "🥤" },
    { id: "sweet", name: "شیرینی و دسر", emoji: "🧁" },
  ],
  dishes: [
    { id: "juice", category: "drink", name: "آب پرتقال طبیعی", desc: "پرتقال تازه، بدون شکر", price: 90000, emoji: "🍊", tag: "محبوب" },
    { id: "icecream", category: "sweet", name: "بستنی سنتی", desc: "بستنی زعفرانی با پسته", price: 80000, emoji: "🍨" },
    { id: "cake", category: "sweet", name: "کیک روز", desc: "کیک تازهٔ هر روز", price: 95000, emoji: "🍰" },
    { id: "box", category: "special", name: "باکس ویژه", desc: "ترکیبی از محصولات پرفروش", price: 250000, emoji: "🎁" },
  ],
};

/** منوی شروع بر اساسِ نوعِ کسب‌وکار؛ sample=false فقط دسته‌ها را می‌سازد */
export function seedMenu(kind: BusinessKind, sample: boolean): { categories: Category[]; dishes: Dish[] } {
  const set = kind === "restaurant" ? RESTAURANT : kind === "fastfood" ? FASTFOOD : kind === "other" ? OTHER : { categories: CATEGORIES, dishes: DISHES };
  return { categories: set.categories, dishes: sample ? set.dishes : [] };
}

/** عنوانِ بخشِ «منتخب» متناسب با نوعِ کسب‌وکار */
export function picksTitle(kind?: string): string {
  return kind === "restaurant" ? "پیشنهاد سرآشپز" : kind === "fastfood" ? "پرفروش‌ها" : kind === "other" ? "پیشنهاد ویژه" : "منتخب باریستا";
}
