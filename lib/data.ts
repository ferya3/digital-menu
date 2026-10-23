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
  { id: "hot", name: "Espresso Bar", emoji: "☕" },
  { id: "cold", name: "Cold Coffee", emoji: "🧊" },
  { id: "tea", name: "Tea & Infusions", emoji: "🍵" },
  { id: "cooler", name: "Smoothies & Coolers", emoji: "🥤" },
  { id: "dessert", name: "Cakes & Pastries", emoji: "🍰" },
  { id: "breakfast", name: "Breakfast", emoji: "🍳" },
];

export const DISHES: Dish[] = [
  { id: "esp", category: "hot", name: "Espresso", desc: "A rich double shot with a golden crema", price: 3, emoji: "☕", tag: "Bestseller" },
  { id: "cap", category: "hot", name: "Cappuccino", desc: "Espresso, steamed milk and velvety microfoam", price: 4.5, emoji: "☕", tag: "Classic" },
  { id: "lat", category: "hot", name: "Caffè Latte", desc: "Smooth espresso with silky milk and latte art", price: 4.75, oldPrice: 5.25, emoji: "🥛" },
  { id: "moc", category: "hot", name: "Mocha", desc: "Espresso, dark chocolate and milk, dusted with cocoa", price: 5.25, emoji: "🍫" },
  { id: "ice", category: "cold", name: "Iced Latte", desc: "Espresso poured over cold milk and ice", price: 5, emoji: "🧊", tag: "Refreshing" },
  { id: "frap", category: "cold", name: "Caramel Frappé", desc: "Blended iced coffee with caramel and whipped cream", price: 5.95, emoji: "🥤" },
  { id: "cbr", category: "cold", name: "Cold Brew", desc: "Steeped for 18 hours: smooth, bold and low in acidity", price: 4.95, emoji: "🧋", tag: "Chef's pick" },
  { id: "tea1", category: "tea", name: "Chai Latte", desc: "Black tea with warm spices and steamed milk", price: 4.25, emoji: "🍵" },
  { id: "tea2", category: "tea", name: "Lemon Verbena Infusion", desc: "Calming herbal infusion served with honey", price: 3.5, emoji: "🌿" },
  { id: "moj", category: "cooler", name: "Virgin Mojito", desc: "Lime, fresh mint and soda, light and zesty", price: 5.5, emoji: "🍋", tag: "New" },
  { id: "smo", category: "cooler", name: "Berry Smoothie", desc: "Strawberry, banana and Greek yogurt", price: 6.25, emoji: "🍓" },
  { id: "chz", category: "dessert", name: "New York Cheesecake", desc: "Creamy baked cheesecake with strawberry coulis", price: 6.5, emoji: "🍰", tag: "Chef's pick" },
  { id: "brw", category: "dessert", name: "Fudge Brownie", desc: "Soft chocolate brownie with a gooey fudge centre", price: 4.25, emoji: "🍫" },
  { id: "crs", category: "breakfast", name: "Butter Croissant", desc: "Freshly baked, flaky and buttery", price: 3.75, emoji: "🥐" },
  { id: "oml", category: "breakfast", name: "Garden Omelette", desc: "Three eggs, mushrooms and cheddar with sourdough toast", price: 9.5, oldPrice: 10.5, emoji: "🍳" },
];
