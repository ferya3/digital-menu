import type { Article } from "@/lib/articles";

/**
 * Starter blog articles (each one targets a main keyword).
 * Used only the first time; once the list is saved in the panel, the saved list replaces them.
 * {brand} and {trialDays} are substituted in the texts.
 */
const D = "2026-10-23";

export const SEED_ARTICLES: Article[] = [
  {
    slug: "what-is-a-digital-menu",
    title: "What Is a Digital Menu? A Complete Guide for Cafés and Restaurants",
    description: "What is a digital menu, how does it work and how is it different from a paper or PDF menu? Benefits, must-have features and tips for cafés and restaurants.",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `A digital menu is the online version of your café or restaurant menu that guests view on their own phone. It usually opens when a guest scans a **QR code** on the table, and unlike a printed menu, it always shows your current items and prices.

Digital menus have gone from a novelty to something many guests now expect. But "digital menu" can mean very different things, from a blurry PDF to a full ordering system. This guide explains how they work, what separates a good one from a bad one, and how to decide whether one is right for your venue.

## How does a digital menu work?
1. The venue owner adds items, photos and prices in an admin panel.
2. A QR code is created and printed for each table.
3. The guest scans the QR code with their phone camera and the menu opens in the browser. There's no app to install.
4. In more complete systems, the guest can order right there, and the order reaches the venue's panel with the table number.

The whole process takes seconds for the guest. For you, the big change is that the menu becomes something you can edit at any time, instead of something you print and live with.

## How is a digital menu different from a PDF menu?
Many venues start by putting a PDF of their printed menu behind a QR code. It's quick, but it isn't really a digital menu:
- A PDF is designed for paper, so guests have to pinch and zoom to read it on a phone.
- Every price change means editing and re-uploading the file.
- There's no way to order, call a waiter or request the bill.

A true digital menu is built for a phone screen. It has categories you can tap through, large, clear photos, and changes go live the moment you save them.

## Benefits of a digital menu for your business
- **No more reprinting:** changing a price takes a few seconds in your panel.
- **Higher sales:** photos of food and drinks, plus tags like "Bestseller" or "Chef's pick", make choosing easier and encourage guests to add more.
- **Faster service:** when guests order from their phone, servers have more time to actually serve.
- **More accurate orders:** orders are recorded with every detail and the guest's own notes, so there are fewer misheard or misread orders.
- **Know your guests:** with phone verification you can build a customer club and send offers by SMS.
- **Reports:** see daily sales and your best-selling items, and improve your menu based on real data.

## What features should a good digital menu have?
- Fast loading, even on a weak mobile connection
- Clear categories and a quality photo for every item
- A unique QR code for each table, so orders never get mixed up
- Ordering from the table, plus "call a waiter" and "request the bill" buttons
- Several payment options, such as card payments, bank transfer or a card reader at the table
- A way to mark items as unavailable when they sell out
- Branding with your logo and colors
- Your own menu address, ideally with the option to use your own domain

> If you're just starting out, you don't need to switch everything on from day one. Start by showing the menu, and once your team is comfortable, turn on ordering at the table.

## Which businesses is a digital menu right for?
Almost any place where guests read a menu: [cafés and coffee shops](/cafe-menu), [restaurants](/restaurant-menu), [fast food](/fastfood-menu), bakeries, juice bars and ice cream shops. The bigger your menu and the more often your prices change, the more you'll benefit.

## Common concerns
**"Some of my guests prefer paper."** That's fine. Keep a few simple printed menus for guests who ask, and make the digital menu your main option.

**"What if a guest's phone battery is dead?"** Your staff can still take the order the traditional way. A digital menu adds a channel; it doesn't remove one.

**"Is it hard to set up?"** With a ready-made platform, it usually takes less time than designing a printed menu.

## Where do I start?
With {brand}, you can build your own digital menu in minutes. A sample menu is ready for you as soon as you sign up, so you just replace it with your own items. Your first {trialDays} days are free. For practical steps, read our [step-by-step QR code menu guide](/blog/qr-code-menu-guide).`,
  },
  {
    slug: "qr-code-menu-guide",
    title: "How to Create a QR Code Menu for Your Café or Restaurant: Step by Step",
    description: "How to build a QR code menu from scratch: preparing items, taking photos, creating a QR code per table, choosing size and placement, and mistakes to avoid.",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `A QR code menu is the simplest way to take your café or restaurant menu digital. In this guide we'll walk through, step by step, how to create a QR menu that guests actually enjoy using, rather than one that makes them pinch and zoom on a PDF.

## Step 1: Prepare your menu content
Before anything else, gather a complete list of your items with this information:
- Item name (short and clear)
- Current price
- A one-line description (main ingredients or flavor)
- Category (for example hot drinks, cold drinks, mains, desserts)
- Any important notes, such as "vegan" or "contains nuts"

Keep descriptions short. Nobody reads long paragraphs on a phone screen. "Crispy-skin salmon with lemon butter and seasonal greens" tells a guest everything they need.

## Step 2: Take good photos
Photos are the single biggest driver of sales on a digital menu. You don't need a professional photographer:
- Shoot in daylight next to a window, without flash.
- Use a simple, consistent background.
- Photograph from a 45-degree angle or directly from above.
- Use the same style for every photo so the whole menu looks consistent.
- Wipe plate edges and glasses before you shoot; small details show up on screen.

If you can't photograph everything at once, start with your bestsellers and most profitable items.

## Step 3: Build your menu in the panel
In {brand}, a sample menu based on your business type is ready as soon as you sign up. Arrange your categories, add your items and upload your photos. Images are compressed automatically so your menu opens quickly, even on slower connections.

This is also the time to add your logo, choose your brand color and, if you like, add category banners and a short welcome video.

## Step 4: Create and print a QR code for each table
Create a separate QR code for each table. The table number is built into the code, so when a guest orders you'll know exactly which table it came from.
- **Size:** at least about 1.2 × 1.2 inches (3 × 3 cm). For table stands, 2 to 3 inches (5 to 7 cm) works better.
- **Material:** print on waterproof stickers or place the code under a protective cover so it survives being wiped down.
- **Contrast:** use a dark code on a light background. Pale, colorful codes may not scan reliably.
- **Call to action:** add a short line next to it, such as "Scan to view the menu and order".

## Step 5: Set up payments and service options
Decide how guests will pay. Common choices are card payments online, bank transfer with a receipt, or paying with a card reader at the table or counter. Busy counters often prefer "pay before preparation", while sit-down restaurants usually let guests pay at the end. Turn on the "call a waiter" and "request the bill" buttons so guests can reach your team without waving.

## Step 6: Test before you launch
Scan every QR code with a few different phones (both iPhone and Android), place a test order, and make sure it arrives on your panel with the correct table number. Check that the sound alert is loud enough to be heard in your kitchen or behind the bar.

## Common QR code menu mistakes
1. Putting a PDF of your printed menu behind the QR code
2. Dark or inconsistent photos
3. A QR code that's too small or placed somewhere poorly lit
4. Forgetting to update prices and mark sold-out items
5. Giving guests no way to call a waiter from the menu
6. Not telling staff how the new system works before launch day

> A QR menu should make things easier for your guests, not harder. If guests still have to wave down a server just to order, your menu isn't finished yet.

## Keep improving
Once you're live, check your reports regularly. Look at which items sell well and which don't, and adjust your menu, photos and tags accordingly. Our [menu design tips](/blog/menu-design-tips) can help.

Ready to start? [Create your QR code menu with {brand}](/qr-menu). Your first {trialDays} days are free.`,
  },
  {
    slug: "paper-vs-digital-menu",
    title: "Paper Menu vs Digital Menu: Cost, Speed and Sales Compared",
    description: "Paper menus vs digital menus compared on printing costs, price updates, hygiene, speed of service and sales. Which is better for your café or restaurant?",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `Many café and restaurant owners are still deciding between a paper menu and a digital menu. Each has its place. In this article we compare the two from several practical angles so you can decide what's right for your venue.

## 1. Cost
A good-quality printed menu (design, printing, binding or laminating) has a real upfront cost, and every time a price or item changes, you either reprint or live with an out-of-date menu. When ingredient costs keep moving, those reprints add up over the year.

A digital menu usually has a predictable subscription cost, and changing it is free. You can update it as often as you like without paying a printer.

## 2. Keeping prices up to date
With printed menus, prices are often corrected with stickers or a pen, which makes the menu look tired. With a digital menu, you change the price in your panel and it's correct on every table instantly. You can also mark a sold-out item as unavailable in one tap, so guests don't order something you can't serve.

## 3. Speed of service
With a paper menu, guests wait for a server to take their order, and then wait again for the bill. With a digital menu that supports ordering, guests order the moment they're ready and the order goes straight to your panel. They can also call a waiter or request the bill from their phone. During the rush, this difference is noticeable. Learn more in our [guide to table ordering](/blog/table-ordering).

## 4. Sales
A digital menu can show a photo for every item and highlight specials and bestsellers with tags. Discounts can be shown with the old price crossed out, which makes the saving obvious. Good photos and well-placed suggestions often lead guests to add a drink or dessert.

On paper, photos are expensive to print and space is limited, so most items get only a name and a price.

## 5. Hygiene
Paper menus pass through dozens of hands every day. With a QR code menu, each guest views the menu on their own phone.

## 6. Guest experience
Some guests, especially those less comfortable with smartphones, simply prefer paper. The easy solution is to keep a few simple printed menus for anyone who asks, while making the digital menu your main option.

A digital menu also helps guests who are unfamiliar with your cuisine. A photo and a short description answer most questions before they need to ask.

## 7. Data and insight
A paper menu can't tell you anything. A digital menu with ordering gives you daily and monthly reports, so you can see which items sell, which don't, and when you're busiest. That makes decisions about your menu much less of a guess.

## 8. Branding
Both can look great. A printed menu can be a beautiful object. A digital menu can carry your logo, brand colors, category banners and even a welcome video, and you can refresh the look any time without starting over.

## Side-by-side summary
- **Changing a price:** paper: reprint / digital: free and instant
- **Item photos:** paper: limited and costly / digital: for every item
- **Ordering:** paper: through a server only / digital: from the guest's phone, or through a server
- **Sold-out items:** paper: tell each table / digital: one switch in the panel
- **Sales reports:** paper: none / digital: daily and monthly

## When does paper still make sense?
If your menu is very small and almost never changes, and you don't plan to offer ordering at the table, a well-designed printed menu may be all you need. Many venues also keep a printed menu as a backup.

## Conclusion
For most cafés and restaurants, a digital menu saves money on printing, speeds up service and gives you data you never had before. The best approach is often to use both: digital as the default, with a few paper menus on hand.

If you'd like to try it yourself, use the [{brand} digital menu](/) free for {trialDays} days. New to the idea? Start with [what a digital menu is](/blog/what-is-a-digital-menu).`,
  },
  {
    slug: "table-ordering",
    title: "Ordering at the Table: Faster Service and Fewer Mistakes",
    description: "How does QR ordering at the table work? Benefits for cafés and restaurants, payment options, waiter calls and tips for a smooth rollout with your staff.",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `Ordering at the table means guests scan the QR code on their table, browse the menu, place their order, and the order arrives on your venue's panel with that table's number. It's more convenient for guests and takes a lot of pressure off your staff during peak hours.

## How does table ordering work?
1. The guest scans the QR code on the table. The table number is detected automatically.
2. They add items to their cart and write notes if needed (for example "oat milk" or "no onions").
3. They place the order, and your panel alerts you with a sound.
4. The guest can follow the status of their order on their phone.

That's it. No app download, no account to create, no waiting for someone to bring a notepad.

## Benefits for your venue
- **More accurate orders:** details are recorded in writing, so nothing gets misheard in a noisy room.
- **Faster service:** guests don't have to wait for a server before they can order.
- **Easier repeat orders:** a second coffee or a dessert is just a few taps away, from the same screen.
- **Less pressure on staff:** servers can focus on bringing food, clearing tables and looking after guests.
- **Better data:** every order is recorded, so your daily and monthly reports are accurate.

## Paying: before or after the meal?
It depends on your type of business:
- **Fast food and busy counters:** pay before preparation, so abandoned or unpaid orders don't cost you money.
- **Sit-down restaurants:** pay at the end, with guests requesting the bill from the menu when they're ready.

Common payment methods include card payments online (for example with Stripe), bank transfer with a receipt upload, and a card reader brought to the table or used at the counter. Offering more than one option means fewer guests get stuck.

## Calling a waiter and requesting the bill
One of the most-used features is surprisingly simple: a "call a waiter" button and a "request the bill" button. The request appears on your panel with the table number, so nobody has to wave across the room to get attention, and your team knows exactly where to go.

## Will guests actually use it?
Most guests already use their phones for everything else, and scanning a QR code is now familiar to many people. Make it obvious and optional: a clear sign on the table, and staff who are happy to take the order the traditional way for anyone who prefers it. Over time, more guests choose to order themselves because it's quicker.

## Tips for a smooth rollout
1. **Prepare your team:** a day before launch, walk them through the panel with a few test orders.
2. **Put the panel device somewhere fixed:** a phone or tablet behind the bar or in the kitchen, where the sound alert can be heard.
3. **Add a short instruction on each table:** "Scan to view the menu and order."
4. **Keep both options open:** guests who want to order in person should always be able to.
5. **Keep the menu accurate:** mark sold-out items as unavailable straight away, so guests never order something you can't serve.
6. **Review after the first week:** ask your team what worked and what didn't, and adjust.

## Common mistakes to avoid
- Launching on your busiest night without testing first
- Placing the panel where nobody hears the alerts
- Letting the menu drift out of date, so guests order items that are sold out
- Using one QR code for the whole venue, so you can't tell which table ordered

> Table ordering doesn't replace your servers. It takes the repetitive work off their plate so they have more time for real hospitality.

## Getting started
{brand} includes ordering at the table with guest notes, waiter calls, bill requests, several payment methods and live order status, all in one panel. See how it works for a [restaurant digital menu](/restaurant-menu) or a [fast food menu](/fastfood-menu), and try it free for {trialDays} days.`,
  },
  {
    slug: "menu-design-tips",
    title: "10 Menu Design Tips That Increase Café and Restaurant Sales",
    description: "Ten practical menu design tips for cafés and restaurants: organizing categories, photos, pricing, writing item descriptions and highlighting profitable items.",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `Your menu isn't just a price list. It's the most important sales tool in your café or restaurant. A few simple changes to how it's organized and written can make choosing easier for guests and increase the value of each order.

Here are ten practical tips you can apply today, whether your menu is printed or digital.

## 1. Keep categories few and clear
Five to eight categories is usually enough. Use simple names guests understand at a glance: "Hot Drinks", "Cold Drinks", "Mains", "Desserts". Avoid clever names that make people guess what's inside.

## 2. Put your bestsellers first
Guests tend to look most closely at the first items in each category. Place your most popular and most profitable items at the top.

## 3. Add a photo to every item
A real, appetizing photo has more influence on what people choose than almost anything else. Make sure all your photos share the same style and lighting so the menu looks professional. A mix of bright and dark, close and far photos makes even great food look less appealing.

## 4. Write short, sensory descriptions
Instead of "Chocolate cake", try "Chocolate cake with dark ganache and toasted hazelnuts". One line is enough. Mention the ingredients and textures that make the dish special, and leave out anything generic.

## 5. Use tags, but sparingly
Tags like "Bestseller", "New" or "Chef's pick" draw the eye to the items you want to sell. Don't overdo it: if everything is special, nothing is.

## 6. Show discounts, don't just announce them
Showing the old price crossed out next to the new price makes a discount feel real. It's far more persuasive than a line of text saying "10% off today".

## 7. Suggest pairings
Dessert next to coffee, fries next to a burger, a drink next to a sandwich. A "Recommended" or "Picks" section on your digital menu does exactly this, and it's one of the easiest ways to raise the average order.

## 8. Keep prices clean
Simple numbers without extra symbols or dotted lines are easier to read. Use the same format throughout the menu. On a digital menu, prices are shown consistently with the same currency format for every item.

## 9. Remove items that don't sell
Check your sales reports every month. An item nobody orders just clutters the menu and ties up stock. A shorter menu is easier to read and easier for your kitchen to execute well.

## 10. Match the layout to your menu and your guests
For a short, visual menu, a carousel or grid view with big photos works best. For a long restaurant menu, a compact list is faster to browse. In {brand}, guests can switch between a 3D carousel, a grid and a list themselves, and their choice is remembered for next time.

## Bonus: keep the menu honest and up to date
Nothing frustrates guests more than ordering something that isn't available. On a digital menu, mark items as unavailable the moment they sell out, and update prices as soon as they change. An accurate menu builds trust, and trust brings guests back.

## Putting it into practice
You don't need to apply all ten tips at once. Pick two or three that fit your menu best, make the changes, and watch your reports for a few weeks. Then try the next ones.

A useful routine:
1. At the start of each month, look at your best and worst sellers.
2. Move your best performers to the top of their category.
3. Retake or improve the photo of one item that should be selling better.
4. Remove or replace one item that consistently underperforms.

> The best menu is one that keeps getting better. Look at your best-seller report every month and make one small change.

If you don't have a digital menu yet, find out [what a digital menu is](/blog/what-is-a-digital-menu), then start with a [digital menu for your café](/cafe-menu) or [restaurant](/restaurant-menu). Your first {trialDays} days with {brand} are free.`,
  },
  {
    slug: "digital-menu-pricing",
    title: "How Much Does a Digital Menu Cost? What Affects the Price",
    description: "What does a digital menu cost and why do prices vary so much? PDF menus, custom-built menu websites and subscription platforms compared, with tips for choosing.",
    cover: "",
    published: true,
    date: D,
    updated: D,
    body: `When you start looking for a digital menu, you'll find prices that vary enormously. That's because "digital menu" is used to describe very different products. In this article we explain what affects the cost, so you can compare options fairly and choose what's right for your venue.

## Three common types of digital menu
### 1. A PDF menu behind a QR code
The cheapest option: a PDF of your printed menu linked from a QR code. It costs very little, but it's hard to read on a phone, has to be recreated every time a price changes, and doesn't let guests order.

### 2. A custom-built menu website
A designer or agency builds a menu website just for you. It can look completely unique, but it usually comes with a significant upfront cost, and every change or new feature may mean paying again. Hosting, a domain and ongoing support are often billed separately.

### 3. A subscription digital menu platform
Platforms like {brand} give you everything for a recurring subscription: the menu, an admin panel, ordering at the table, hosting, your own menu address and ongoing updates. There's no large upfront cost, and new features are added without extra charges.

## What drives the price up or down?
- **Ordering and payments:** a view-only menu is simpler, and cheaper, than one that takes orders and payments.
- **Admin panel and reports:** accounting, a customer club and SMS marketing add real value.
- **Customization:** your logo, brand colors, category banners, a welcome video and a custom domain.
- **Number of venues:** some providers charge per location, others per account.
- **Billing period:** longer subscriptions, such as quarterly or annual plans, often work out cheaper per month.
- **Support:** fast help when something goes wrong in the middle of a busy evening is worth paying for.
- **Hidden extras:** setup fees, per-order fees, payment processing fees or charges for extra users.

## Don't forget payment processing
If you accept card payments online, the payment processor (for example Stripe) charges its own fee on each transaction. This is separate from your menu subscription. Offering alternatives, such as bank transfer or a card reader at the table, gives you and your guests flexibility.

## How to choose the best value
1. **Calculate the total cost for a full year,** not just the starting price. Include reprinting, hosting and the cost of making changes.
2. **Try before you pay.** Choose a service that offers a free trial with all features included.
3. **Check how fast the menu loads on a phone,** ideally on mobile data rather than Wi-Fi. Guests won't wait for a slow menu.
4. **Make sure your data stays yours,** and that you can export important information like your customer list.
5. **Check what happens if you stop paying.** Is your data deleted, or simply paused until you renew?
6. **Ask about your own domain,** if having your menu on your own web address matters to you.

## Think about the return, not just the cost
A digital menu can save you money (no reprinting) and make you money (better photos, tags, suggested pairings and faster service). It can also save staff time on every table. When you compare prices, compare what each option would actually do for your business.

> The cheapest menu isn't always the best value. A menu that increases sales and reduces your team's workload often pays for itself quickly.

## Questions to ask any provider
- Is there a setup fee or a long-term contract?
- Are all features included, or are some sold as add-ons?
- Is there a limit on items, tables or orders?
- Which payment methods can my guests use?
- How do I get support, and how quickly?

## {brand} pricing
{brand} has no setup fee, and your first {trialDays} days are free with every feature included. After that, you choose the plan that suits you. Every plan includes all features, with no limits on menu items or orders. See current plans and prices in our [pricing section](/#pricing), or learn more about [QR code menus](/qr-menu).`,
  },
];
