/**
 * Topic landing pages for SEO (one per target keyword): café menu, restaurant menu, fast food menu and QR code menu.
 * Each page has its own heading, copy, benefits and FAQ so search engines see it as a distinct, complete page rather than a copy of the home page.
 * {brand} and {trialDays} are substituted in the texts.
 */
export interface Solution {
  slug: string;
  /** Browser tab / search result title (without the brand name; the site template appends it) */
  title: string;
  description: string;
  /** Short label for links and breadcrumbs */
  label: string;
  h1: string;
  highlight: string;
  intro: string[];
  benefitsTitle: string;
  benefits: { icon: string; title: string; text: string }[];
  /** Long-form text section (simple markdown) */
  body: string;
  faq: { q: string; a: string }[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: "cafe-menu",
    label: "Café digital menu",
    title: "Digital Menu for Cafés & Coffee Shops with QR Ordering",
    description: "A digital menu for cafés and coffee shops: QR codes on every table, drink photos, ordering from the table and an easy admin panel. Try it free for {trialDays} days.",
    h1: "Digital menu for cafés",
    highlight: "A QR menu made for coffee shops",
    intro: [
      "Coffee lovers like to see what they're ordering, know the price and order without waiting in line. With a {brand} digital menu, guests scan the QR code on their table with their phone camera and your café menu opens instantly, with photos, descriptions and up-to-date prices. No app to install.",
      "Coffee, milk and pastry costs change often. With a printed menu, every change means a reprint. With a digital menu, you update the price in your panel and it's live on every table the same second.",
    ],
    benefitsTitle: "Why cafés switch to a digital menu",
    benefits: [
      { icon: "Coffee", title: "Real photos of your drinks", text: "Latte art, cakes and pastries shown in large photos make it easier for guests to choose, and to add something extra." },
      { icon: "Clock", title: "Update prices in seconds", text: "Change prices, mark items as sold out or add seasonal specials from your panel. No more reprinting costs." },
      { icon: "Smartphone", title: "Order from the table", text: "Orders land on your bar and checkout panel with the table number and a sound alert." },
      { icon: "BellRing", title: "Call a waiter in one tap", text: "Guests can call a waiter or request the bill with a single tap, which keeps peak hours under control." },
      { icon: "Users", title: "Customer club", text: "Collect guest phone numbers with SMS verification, then send offers and event news with bulk SMS." },
      { icon: "Palette", title: "Matches your brand", text: "Your logo, colors, category banners and a welcome video, so the menu feels like your café." },
    ],
    body: `## What makes a great café menu?
A great café menu loads fast, has clear categories (hot coffee, cold coffee, tea, cakes and pastries, breakfast) and gives every item a photo and a short description. {brand} has all of this built in, and guests can browse your menu as a **3D carousel**, a **grid** or a **list**.

## How do I set up a digital menu for my café?
1. Sign up for {brand} and choose "Café" as your business type. A sample café menu is created for you.
2. Replace the sample drinks, prices and photos with your own.
3. Print a QR code for each table from your panel and place them on your tables.

For a full walkthrough, read our [step-by-step QR code menu guide](/blog/qr-code-menu-guide).

## Can a digital menu increase café sales?
When guests see a photo of a cheesecake right next to their latte, they're more likely to add it to their order. A "Bestseller" or "New" tag and a discount shown with the old price crossed out draw attention to the items you want to sell. We cover practical techniques in [10 menu design tips that increase sales](/blog/menu-design-tips).

## Payments that suit your café
Let guests pay by card with Stripe, by bank transfer with a receipt upload, or with your card reader at the table or counter. For busy takeaway counters, turn on "pay before preparation" so orders only reach the bar once they're paid.`,
    faq: [
      { q: "Do guests need to install an app to see the café menu?", a: "No. The phone camera reads the QR code and the menu opens in the browser, on both iPhone and Android." },
      { q: "Can I temporarily hide items that are sold out?", a: "Yes. One switch in the panel marks an item as unavailable, and guests can't order it until you switch it back." },
      { q: "Does my café menu get its own address?", a: "Yes. Every café gets its own subdomain, and you can connect your own domain by contacting support." },
      { q: "How much does a digital menu for a café cost?", a: "Your first {trialDays} days are free. After that, you choose a monthly or longer subscription plan, with every feature included." },
    ],
  },
  {
    slug: "restaurant-menu",
    label: "Restaurant digital menu",
    title: "Restaurant Digital Menu with QR Code Table Ordering",
    description: "A restaurant digital menu with QR codes, ordering at the table, card payments and daily accounting. Build your restaurant menu in minutes. Free for {trialDays} days.",
    h1: "Digital menu for restaurants",
    highlight: "From order to bill, on your guest's phone",
    intro: [
      "In a restaurant, the time between a guest sitting down and placing their order directly affects how many tables you can serve in an evening. A {brand} digital menu shortens that gap: guests open the menu with a QR code, choose their dishes, and the order arrives on your kitchen panel with the table number.",
      "Restaurant menus are often long. Clear categories with their own banners, plus a compact list view, help guests find what they want without getting lost in dozens of dishes.",
    ],
    benefitsTitle: "Features restaurants actually need",
    benefits: [
      { icon: "UtensilsCrossed", title: "Long menus, neatly organized", text: "Starters, mains, drinks and desserts in separate categories with their own banners. Easy to browse, even with hundreds of items." },
      { icon: "ChefHat", title: "Orders straight to the kitchen", text: "Orders arrive with the table number and the guest's notes (like \"no onions\"), so there are fewer handwriting mistakes." },
      { icon: "CreditCard", title: "Pay before or after the meal", text: "Card payments with Stripe, bank transfer with receipt, or a card reader at the table. Whatever suits your restaurant." },
      { icon: "Calculator", title: "Daily and monthly accounting", text: "Today's sales, your best-selling dishes and monthly revenue, always up to date." },
      { icon: "BellRing", title: "Waiter calls and bill requests", text: "Requests arrive with the table number, so no table is left waiting." },
      { icon: "Printer", title: "A print-ready QR for every table", text: "Create and print a separate QR code for each table. Orders are automatically linked to the right table." },
    ],
    body: `## Why choose an online restaurant menu over a printed one?
Printed restaurant menus are expensive, wear out quickly and must be reprinted every time a price changes. A digital menu is always up to date, shows photos of your dishes and lets guests order right from the table. See the full comparison in [Paper vs digital menus](/blog/paper-vs-digital-menu).

## How does QR code table ordering work in a restaurant?
1. The guest scans the QR code on the table. The table number is detected automatically.
2. They add dishes to their cart, write any notes for the kitchen and place the order.
3. The order appears on your restaurant panel with a sound alert, and the guest can follow its status on their phone.

Learn more in our [guide to table ordering](/blog/table-ordering).

## Built for busy service
During the rush, your servers can focus on hospitality instead of taking orders. Orders reach the kitchen accurately, with no hard-to-read handwriting, and your end-of-day report is ready when you close. Guests can still call a waiter or request the bill with a tap whenever they need to.

## Your brand, your address
Add your logo, brand color, category banners and a welcome video. Your menu lives on its own subdomain, and you can connect your own domain through support. Ready to start? Check the [pricing](/#pricing) or read [what a digital menu is](/blog/what-is-a-digital-menu) first.`,
    faq: [
      { q: "Can guests view the menu without scanning a table QR code?", a: "Yes. Your main menu address opens the menu in view-only mode. To order, guests scan the QR code on their table so the table number is known." },
      { q: "Can guests add notes to their order?", a: "Yes, for example \"no onions\" or \"not too spicy\". Notes are shown with the order on your panel." },
      { q: "How many tables can I create QR codes for?", a: "There is no limit. Each table gets its own QR code, ready to print." },
      { q: "Is my restaurant's data kept separate from others?", a: "Yes. Each venue has its own database and image folder that no other venue can access." },
    ],
  },
  {
    slug: "fastfood-menu",
    label: "Fast food digital menu",
    title: "Fast Food Digital Menu for Pizza, Burgers & Takeaway",
    description: "A fast food digital menu with QR ordering, pay-before-preparation and big food photos. Sell more pizza, burgers and wraps with less queuing. Free for {trialDays} days.",
    h1: "Digital menu for fast food",
    highlight: "Fast ordering, payment before preparation",
    intro: [
      "In fast food, speed is everything. With a {brand} digital menu, guests order from their phone instead of waiting in line at the counter, and they can pay before their food is prepared. Orders go straight to your kitchen panel.",
      "Big, mouth-watering photos of pizzas and burgers sell themselves, and placing sides and drinks right next to your mains makes it easy for guests to build a bigger order.",
    ],
    benefitsTitle: "Made for pizza, burgers and wraps",
    benefits: [
      { icon: "Zap", title: "Order without the queue", text: "Guests order from their table, so the line at the counter stays short during the rush." },
      { icon: "CreditCard", title: "Pay before preparation", text: "Orders reach the kitchen only after payment is confirmed. No more losses from abandoned orders." },
      { icon: "Star", title: "Bestseller tags and discounts", text: "Highlight specials and discounted items, with the old price crossed out, so they get noticed." },
      { icon: "BarChart3", title: "Best-seller reports", text: "See which burgers and pizzas sell most and build your menu around real data." },
      { icon: "MessageSquareText", title: "SMS offers", text: "Send discount codes and promotions to past customers by bulk SMS to bring them back." },
      { icon: "QrCode", title: "QR codes everywhere", text: "Put QR codes on tables, at the counter, or even on your takeaway bags." },
    ],
    body: `## Why do fast food restaurants need a digital menu?
Fast food menus are full of combos and changing prices, and at peak times the counter becomes the bottleneck. When ordering and payment move to the guest's phone, your cashier and kitchen can focus on getting food out.

## How does pay-before-preparation work?
1. The guest places an order and sees the available payment methods.
2. They pay by card with Stripe, by bank transfer (uploading a receipt), or with the card reader at the counter.
3. You confirm the payment and the order goes to the kitchen.

## Sell more with the right menu
High-quality photos, short descriptions and a "Bestseller" tag directly influence what guests choose. Show deals with the original price crossed out, and toggle items off instantly when they sell out. We share practical techniques in [10 menu design tips](/blog/menu-design-tips).

## Quick to launch
You don't need new hardware: a phone or laptop for the admin panel is enough. Follow our [QR code menu guide](/blog/qr-code-menu-guide) and you can be live today. See plans in the [pricing section](/#pricing).`,
    faq: [
      { q: "Can I accept orders only after they're paid?", a: "Yes. The \"pay before preparation\" option is designed exactly for that." },
      { q: "How do I list different pizza sizes?", a: "Add each size as a separate item with its own price, or mention the sizes in the item description." },
      { q: "Can I show a daily discount?", a: "Yes. The old price is shown crossed out next to the new one, and you can add a tag to the item." },
      { q: "What do I need to get started?", a: "Just a phone or laptop for the admin panel. No extra hardware is required." },
    ],
  },
  {
    slug: "qr-menu",
    label: "QR code menu",
    title: "QR Code Menu Generator for Restaurants and Cafés",
    description: "Create a QR code menu that guests open with their phone camera to browse and order. QR menus for cafés, restaurants and fast food. Your first {trialDays} days are free.",
    h1: "QR code menu generator",
    highlight: "One scan, the full menu on any phone",
    intro: [
      "A QR code menu is a small square code on the table that guests scan with their phone camera to open your full menu. With {brand}, your QR menu is not just a PDF. It's a live menu with photos, categories, up-to-date prices and ordering built in.",
      "Every table has its own QR code. When a guest orders from table 4, the order arrives on your panel marked as table 4.",
    ],
    benefitsTitle: "A QR menu that's more than a PDF",
    benefits: [
      { icon: "QrCode", title: "A unique QR per table", text: "The table number is built into the code, so orders and waiter calls reach the right table." },
      { icon: "Globe", title: "No app to install", text: "Opens with the camera on iPhone and Android. Guests don't need to download anything." },
      { icon: "Clock", title: "Always up to date", text: "Change a price in your panel and it's live instantly. No need to reprint your QR codes." },
      { icon: "ShieldCheck", title: "Locked to your venue", text: "If someone scans a QR code from another venue, the menu warns them, so no orders end up in the wrong place." },
      { icon: "Printer", title: "Ready to print", text: "Print the QR codes for all your tables in one go from the panel." },
      { icon: "Sparkles", title: "Three display modes", text: "3D carousel, grid or list. Guests pick the view they like best." },
    ],
    body: `## How do I create a QR code menu?
1. Sign up and choose an address for your menu (for example, your venue's name).
2. Add your items and prices, or edit the sample menu that's created for you.
3. Enter the number of tables in your panel and print the QR codes.

For a detailed walkthrough, see our [step-by-step QR code menu guide](/blog/qr-code-menu-guide).

## Where should I place the QR codes?
On every table (on a table stand or a sticker), next to the counter, in the window and even on takeaway bags. Make sure the code is easy to read in your normal lighting and is at least about 1.2 × 1.2 inches (3 × 3 cm).

## QR code menu vs PDF menu
A PDF menu is small and hard to read on a phone, has to be recreated every time a price changes and can't take orders. A {brand} QR menu is designed for mobile, always shows your latest prices and sends orders straight to your panel. Guests can also call a waiter or request the bill from the same screen.

## Which businesses is it for?
Any venue where guests read a menu: [cafés](/cafe-menu), [restaurants](/restaurant-menu), [fast food](/fastfood-menu), bakeries, juice bars and ice cream shops. Learn more in [What is a digital menu?](/blog/what-is-a-digital-menu)`,
    faq: [
      { q: "Is the QR code menu free?", a: "Your first {trialDays} days are completely free with every feature enabled. After that, you choose a subscription plan." },
      { q: "Do I need to reprint my QR codes when prices change?", a: "No. The QR code points to your menu address, and the menu always shows your latest prices." },
      { q: "Does it work with all phones?", a: "Yes. The built-in camera on modern iPhone and Android phones reads QR codes directly." },
      { q: "Can I put the QR code on business cards or flyers?", a: "Yes. A QR code for your main menu address (without a table number) opens the menu in view-only mode." },
    ],
  },
];

export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => s.slug === slug);
