import type { CarouselItem } from "@/components/ui/3-d-coverflow-carousel";

export interface Dish extends CarouselItem {
  id: string;
  price: number;
  oldPrice?: number;
  category: string;
}

export const CATEGORIES = [
  { id: "hot", name: "قهوه‌های گرم" },
  { id: "cold", name: "قهوه‌های سرد" },
  { id: "dessert", name: "کیک و دسر" },
];

export const DISHES: Dish[] = [
  { id: "esp", category: "hot", tag: "#محبوب", titleLine1: "اسپرسو", titleLine2: "— تک‌شات", desc: "یک شات غلیظ و پررنگ قهوه با کرمای طلایی", img: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&auto=format&fit=crop&q=80", price: 45000, ctaText: "افزودن" },
  { id: "cap", category: "hot", tag: "#کلاسیک", titleLine1: "کاپوچینو", titleLine2: "— فوم مخملی", desc: "اسپرسو، شیر بخارپز و لایه‌ای نرم از فوم شیر", img: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&auto=format&fit=crop&q=80", price: 68000, ctaText: "افزودن" },
  { id: "lat", category: "hot", tag: "#پرطرفدار", titleLine1: "لاته", titleLine2: "— لطیف", desc: "قهوهٔ ملایم با شیر بخارپز و طرح لاته‌آرت", img: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&auto=format&fit=crop&q=80", price: 72000, oldPrice: 85000, ctaText: "افزودن" },
  { id: "moc", category: "hot", tag: "#شکلاتی", titleLine1: "موکا", titleLine2: "— کاکائو", desc: "ترکیب اسپرسو، شکلات و شیر با روکش کاکائو", img: "https://images.unsplash.com/photo-1607681034540-2c46cc71896d?w=800&auto=format&fit=crop&q=80", price: 82000, ctaText: "افزودن" },
  { id: "ice", category: "cold", tag: "#خنک", titleLine1: "آیس لاته", titleLine2: "— یخ", desc: "اسپرسو سرد روی شیر و یخ، تازه و خنک", img: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&auto=format&fit=crop&q=80", price: 78000, ctaText: "افزودن" },
  { id: "frap", category: "cold", tag: "#شیک", titleLine1: "فراپه", titleLine2: "— کاراملی", desc: "قهوهٔ بلندشده با یخ، کارامل و خامه", img: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&auto=format&fit=crop&q=80", price: 95000, ctaText: "افزودن" },
  { id: "chz", category: "dessert", tag: "#خاص", titleLine1: "چیزکیک", titleLine2: "— توت‌فرنگی", desc: "کیک پنیری خامه‌ای با سس توت‌فرنگی تازه", img: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&auto=format&fit=crop&q=80", price: 110000, ctaText: "افزودن" },
  { id: "brw", category: "dessert", tag: "#شکلاتی", titleLine1: "براونی", titleLine2: "— فاج", desc: "براونی شکلاتی نرم با مغز فاج و گردو", img: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80", price: 88000, ctaText: "افزودن" },
];
