import { CATEGORIES, DISHES, type Category, type Dish } from "@/lib/data";

export type BusinessKind = "cafe" | "restaurant" | "fastfood" | "other";
export const KIND_LABEL: Record<BusinessKind, string> = {
  cafe: "Café / Coffee shop",
  restaurant: "Restaurant",
  fastfood: "Fast food",
  other: "Other (bakery, juice bar, ice cream…)",
};

const RESTAURANT: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "starter", name: "Starters", emoji: "🥗" },
    { id: "grill", name: "From the Grill", emoji: "🥩" },
    { id: "main", name: "Mains", emoji: "🍝" },
    { id: "drink", name: "Drinks", emoji: "🥤" },
    { id: "dessert", name: "Desserts", emoji: "🍮" },
  ],
  dishes: [
    { id: "soup", category: "starter", name: "Tomato Basil Soup", desc: "Slow-roasted tomatoes, fresh basil and a swirl of cream", price: 8.5, emoji: "🍲" },
    { id: "salad", category: "starter", name: "Caesar Salad", desc: "Romaine, parmesan, garlic croutons and house Caesar dressing", price: 11, emoji: "🥗" },
    { id: "ribeye", category: "grill", name: "Ribeye Steak", desc: "12 oz ribeye with peppercorn sauce and hand-cut fries", price: 32, emoji: "🥩", tag: "Chef's pick" },
    { id: "burger", category: "grill", name: "House Burger", desc: "Aged beef patty, cheddar, caramelised onions and brioche bun", price: 17.5, emoji: "🍔", tag: "Bestseller" },
    { id: "chicken", category: "grill", name: "Grilled Lemon Chicken", desc: "Herb-marinated chicken breast with roasted vegetables", price: 21, oldPrice: 23.5, emoji: "🍗" },
    { id: "salmon", category: "main", name: "Pan-Seared Salmon", desc: "Crispy-skin salmon with lemon butter and seasonal greens", price: 26, emoji: "🐟" },
    { id: "pasta", category: "main", name: "Mushroom Tagliatelle", desc: "Fresh pasta, wild mushrooms, garlic and parmesan cream", price: 19, emoji: "🍝" },
    { id: "lemonade", category: "drink", name: "Homemade Lemonade", desc: "Freshly squeezed lemons with a hint of mint", price: 4.5, emoji: "🍋" },
    { id: "soda", category: "drink", name: "Soft Drink", desc: "12 oz can (330 ml)", price: 3, emoji: "🥤" },
    { id: "tiramisu", category: "dessert", name: "Tiramisu", desc: "Espresso-soaked ladyfingers with mascarpone and cocoa", price: 9, emoji: "🍮" },
  ],
};

const FASTFOOD: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "pizza", name: "Pizza", emoji: "🍕" },
    { id: "burger", name: "Burgers", emoji: "🍔" },
    { id: "sandwich", name: "Sandwiches & Wraps", emoji: "🌯" },
    { id: "fried", name: "Sides", emoji: "🍟" },
    { id: "drink", name: "Drinks", emoji: "🥤" },
  ],
  dishes: [
    { id: "pepperoni", category: "pizza", name: "Pepperoni Pizza", desc: "Spicy pepperoni, mozzarella and our signature tomato sauce", price: 14.5, emoji: "🍕", tag: "Bestseller" },
    { id: "margherita", category: "pizza", name: "Margherita Pizza", desc: "Tomato, fresh mozzarella and basil", price: 12.5, emoji: "🍕" },
    { id: "cheese", category: "burger", name: "Classic Cheeseburger", desc: "1/4 lb beef patty, cheddar, pickles and house sauce", price: 9.5, emoji: "🍔" },
    { id: "double", category: "burger", name: "Double Smash Burger", desc: "Two smashed patties, double cheese and grilled onions", price: 12.95, oldPrice: 14.5, emoji: "🍔", tag: "New" },
    { id: "hotdog", category: "sandwich", name: "Chili Cheese Dog", desc: "All-beef hot dog with chili, cheese and onions", price: 7.5, emoji: "🌭" },
    { id: "wrap", category: "sandwich", name: "Crispy Chicken Wrap", desc: "Crispy chicken, lettuce, tomato and ranch in a flour tortilla", price: 9, emoji: "🌯" },
    { id: "fries", category: "fried", name: "Seasoned Fries", desc: "Crispy fries with our house seasoning", price: 4, emoji: "🍟" },
    { id: "wings", category: "fried", name: "Buffalo Wings", desc: "6 spicy wings with blue cheese dip", price: 9.5, emoji: "🍗" },
    { id: "cola", category: "drink", name: "Fountain Soda", desc: "Large, free refills", price: 2.75, emoji: "🥤" },
    { id: "shake", category: "drink", name: "Chocolate Milkshake", desc: "Vanilla ice cream blended with chocolate", price: 5.5, emoji: "🥤" },
  ],
};

const OTHER: { categories: Category[]; dishes: Dish[] } = {
  categories: [
    { id: "special", name: "Specials", emoji: "⭐" },
    { id: "drink", name: "Juices & Drinks", emoji: "🥤" },
    { id: "sweet", name: "Ice Cream & Desserts", emoji: "🧁" },
  ],
  dishes: [
    { id: "juice", category: "drink", name: "Fresh Orange Juice", desc: "Freshly squeezed oranges, no added sugar", price: 5.5, emoji: "🍊", tag: "Bestseller" },
    { id: "icecream", category: "sweet", name: "Pistachio Gelato", desc: "Two scoops of house-made pistachio gelato", price: 5.75, emoji: "🍨" },
    { id: "cake", category: "sweet", name: "Cake of the Day", desc: "Freshly baked every morning", price: 6, emoji: "🍰" },
    { id: "box", category: "special", name: "Sweet Treats Box", desc: "A mix of our best-selling treats", price: 18, oldPrice: 21, emoji: "🎁" },
  ],
};

/** Starter menu based on the business kind; sample=false creates the categories only */
export function seedMenu(kind: BusinessKind, sample: boolean): { categories: Category[]; dishes: Dish[] } {
  const set = kind === "restaurant" ? RESTAURANT : kind === "fastfood" ? FASTFOOD : kind === "other" ? OTHER : { categories: CATEGORIES, dishes: DISHES };
  return { categories: set.categories, dishes: sample ? set.dishes : [] };
}

/** Title of the "picks" section, matched to the business kind */
export function picksTitle(kind?: string): string {
  return kind === "restaurant" ? "Chef's picks" : kind === "fastfood" ? "Bestsellers" : kind === "other" ? "Our specials" : "Barista's picks";
}
