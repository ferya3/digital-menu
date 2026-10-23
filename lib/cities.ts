/**
 * City landing pages (/city/<slug>) for searches like "digital menu London".
 * Each city has its own intro, and active venue menus in that city are also listed on the page so the pages aren't duplicates.
 * Edited/added from the super-admin panel → "City pages"; until saved there, these seed cities are shown.
 */
export interface City {
  slug: string;
  /** City name, e.g. "London" */
  name: string;
  /** Paragraph specific to this city (important for page uniqueness) */
  intro: string;
  /** Optional extra text (simple markdown) */
  body: string;
  published: boolean;
  updated: string;
}

export const CITY_SLUG = /^[a-z][a-z0-9-]{1,29}$/;

const D = "2026-10-23";
export const SEED_CITIES: City[] = [
  { slug: "new-york", name: "New York", published: true, updated: D, body: "", intro: "New York has one of the most competitive restaurant scenes in the world, from neighborhood coffee shops to packed Midtown lunch spots. When every minute of a lunch rush counts, letting guests scan a QR code, order from the table and pay by card keeps tables turning and lines short. Updating prices in seconds also helps you keep up with changing costs without reprinting menus." },
  { slug: "london", name: "London", published: true, updated: D, body: "", intro: "London's café culture and diverse food scene attract locals, commuters and visitors from all over the world. A digital menu with photos and short descriptions helps guests who don't know a dish choose with confidence, while table ordering and one-tap bill requests keep service smooth in busy pubs, cafés and restaurants." },
  { slug: "toronto", name: "Toronto", published: true, updated: D, body: "", intro: "Toronto is one of the most multicultural cities in the world, and its restaurants and cafés serve an incredibly diverse crowd. A QR code menu with clear photos makes every dish easy to understand, and guests can order and call a waiter from their phone, with no app to install." },
  { slug: "sydney", name: "Sydney", published: true, updated: D, body: "", intro: "Sydney's café culture runs on great coffee and relaxed brunches, and weekend mornings get busy fast. With a digital menu, guests order straight from the table while your team focuses on making coffee and serving food, and you can mark items as sold out the moment they run out." },
  { slug: "dubai", name: "Dubai", published: true, updated: D, body: "", intro: "Dubai's hospitality scene welcomes residents and visitors from around the globe, and guests expect fast, modern service. A branded QR menu with your logo, colors and a welcome video makes a great first impression, while ordering at the table and card payments keep service quick even on the busiest nights." },
  { slug: "los-angeles", name: "Los Angeles", published: true, updated: D, body: "", intro: "From taco spots to beachside cafés, Los Angeles is known for its varied and fast-moving food scene. A digital menu lets you update specials and prices instantly, highlight bestsellers with tags, and let guests order and pay from their phones, which is ideal for busy counters and patios." },
  { slug: "chicago", name: "Chicago", published: true, updated: D, body: "", intro: "Chicago is famous for its food, from deep-dish pizza to a thriving fine-dining and neighborhood restaurant scene. Ordering at the table sends orders straight to your kitchen with the table number and guest notes, so busy dinner services run with fewer mistakes." },
  { slug: "melbourne", name: "Melbourne", published: true, updated: D, body: "", intro: "Melbourne is widely regarded as one of the world's great coffee cities, with laneway cafés and brunch spots on almost every corner. A QR menu with beautiful photos shows off your coffee and food, while table ordering and waiter calls help a small team handle a full café." },
];

/** Normalize a city name for comparison (lowercase, trimmed, collapsed whitespace, diacritics removed) */
export const normCity = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
