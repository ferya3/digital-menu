export interface Dish {
  id: string;
  name: string;
  desc: string;
  price: number;
  oldPrice?: number;
  emoji: string;
  tag?: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: "hot", name: "قهوه‌های گرم", emoji: "☕" },
  { id: "cold", name: "قهوه‌های سرد", emoji: "🧊" },
  { id: "tea", name: "چای و دمنوش", emoji: "🍵" },
  { id: "cooler", name: "نوشیدنی سرد", emoji: "🥤" },
  { id: "dessert", name: "کیک و دسر", emoji: "🍰" },
  { id: "breakfast", name: "صبحانه", emoji: "🍳" },
];

export const DISHES: Dish[] = [
  { id: "esp", category: "hot", name: "اسپرسو", desc: "یک شات غلیظ و پررنگ با کرمای طلایی", price: 45000, emoji: "☕", tag: "محبوب" },
  { id: "cap", category: "hot", name: "کاپوچینو", desc: "اسپرسو، شیر بخارپز و فومِ مخملی", price: 72000, emoji: "☕", tag: "کلاسیک" },
  { id: "lat", category: "hot", name: "کافه لاته", desc: "قهوهٔ ملایم با شیر و لاته‌آرت", price: 78000, oldPrice: 88000, emoji: "🥛" },
  { id: "moc", category: "hot", name: "موکا", desc: "اسپرسو، شکلات و شیر با روکش کاکائو", price: 85000, emoji: "🍫" },
  { id: "ice", category: "cold", name: "آیس لاته", desc: "اسپرسو سرد روی شیر و یخ، تازه و خنک", price: 82000, emoji: "🧊", tag: "خنک" },
  { id: "frap", category: "cold", name: "فراپه", desc: "قهوهٔ بلندشده با یخ، کارامل و خامه", price: 96000, emoji: "🥤" },
  { id: "cbr", category: "cold", name: "کلدbrew", desc: "دَم‌سردِ ۱۸ ساعته، نرم و کم‌اسید", price: 90000, emoji: "🧋", tag: "خاص" },
  { id: "tea1", category: "tea", name: "چای ماسالا", desc: "چای سیاه با شیر و ادویه‌های گرم", price: 60000, emoji: "🍵" },
  { id: "tea2", category: "tea", name: "دمنوش به‌لیمو", desc: "دمنوش آرام‌بخش با عسل", price: 55000, emoji: "🌿" },
  { id: "moj", category: "cooler", name: "موهیتو", desc: "لیمو، نعنا و سودا، تازه و سبک", price: 88000, emoji: "🍋", tag: "تابستانی" },
  { id: "smo", category: "cooler", name: "اسموتی توت", desc: "توت‌فرنگی و موز با ماست", price: 98000, emoji: "🍓" },
  { id: "chz", category: "dessert", name: "چیزکیک", desc: "کیک پنیری خامه‌ای با سس توت‌فرنگی", price: 110000, emoji: "🍰", tag: "پیشنهاد سرآشپز" },
  { id: "brw", category: "dessert", name: "براونی", desc: "براونی شکلاتی نرم با مغز فاج", price: 88000, emoji: "🍫" },
  { id: "crs", category: "breakfast", name: "کروسان کره", desc: "کروسان تازه و ترد، کره‌ای", price: 65000, emoji: "🥐" },
  { id: "oml", category: "breakfast", name: "املت ویژه", desc: "تخم‌مرغ، قارچ و پنیر با نان تست", price: 125000, emoji: "🍳" },
];
