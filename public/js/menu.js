(() => {
  'use strict';

  // ---- شماره میز فقط از روی اسکن QR میز (ورود دستی ممنوع است) ----
  const params = new URLSearchParams(location.search);
  const table = params.get('table');

  // ---- وضعیت ----
  let menu = { cafe: {}, categories: [], items: [] };
  const cart = new Map(); // itemId -> qty
  let currentOrderId = null;
  let activeCat = null;
  // 'grid' | 'list' | 'scroll' (کاروسل افقی)
  let viewMode = ['grid', 'list', 'scroll'].includes(localStorage.getItem('cafe_view')) ? localStorage.getItem('cafe_view') : 'grid';
  let cafeInfo = {};                                   // نام/آدرس/لوکیشن/اینستاگرام برای اشتراک‌گذاری
  let payInfo = {};                                    // اطلاعات پرداخت (لینک/کارت)
  let currentOrder = null;                             // سفارش جاری (برای مبلغ فاکتور و آپلود فیش)
  let pendingReceipt = null;                           // data URL فیش انتخاب‌شده
  let phone = localStorage.getItem('cafe_phone') || ''; // شماره موبایل مشتری

  // ---- ابزارها ----
  let currency = 'toman'; // از تنظیمات خوانده می‌شود
  let codeMode = 'number'; // نحوه‌ی نمایش کد سفارش: 'number' یا 'id'
  const fmtCode = (order) => (codeMode === 'id' ? faNum(order.id) : '#' + faNum(order.number || 0));
  const $ = (sel) => document.querySelector(sel);
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const price = (toman) => {
    const n = currency === 'rial' ? toman * 10 : toman; // قیمت‌ها بر پایه‌ی تومان ذخیره می‌شوند
    return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان');
  };
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isImg = (s) => /^(https?:|\/|data:image)/.test(String(s || '')); // آیکون عکسی در برابر ایموجی
  // آیکون خطیِ تمیز اشتراک‌گذاری (رنگ را به ارث می‌برد)
  const SHARE_SVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(() => (t.hidden = true), 2500);
  }
  const openSheet = (id) => ($('#' + id).hidden = false);
  const closeSheet = (id) => ($('#' + id).hidden = true);
  const showBanner = () => ($('#netBanner').hidden = false);

  // اگر صفحه با فایل مستقیم باز شده باشد، API کار نمی‌کند
  if (location.protocol === 'file:') showBanner();

  // ---- اتصال لحظه‌ای ----
  let socket;
  try {
    socket = io();
    socket.on('connect', () => socket.emit('join:table', table));
    socket.on('order:updated', (order) => {
      if (order.id === currentOrderId) updateOrder(order);
      // صورتحساب را زنده نگه دار (تأیید/رد صندوق) اگر شیت باز است
      if (!$('#invoiceSheet').hidden) loadBill();
      // اگر فیش رد شد، حتی بیرون از شیت هم به مشتری اطلاع بده
      if (order.payStatus === 'rejected') toast('❌ فیش شما تأیید نشد — لطفاً بررسی و دوباره ارسال کنید');
    });
    socket.on('menu:updated', () => loadMenu().catch(() => {})); // به‌روزرسانی زنده‌ی منو
    socket.on('connect_error', showBanner);
  } catch (e) { /* socket.io در دسترس نیست */ }

  // ---- لوگو و نام کافه از تنظیمات ----
  async function loadSettings() {
    try {
      const s = await fetch('/api/settings').then((r) => r.json());
      if (s.currency) currency = s.currency === 'rial' ? 'rial' : 'toman';
      cafeInfo = s.cafe || {};
      payInfo = s.payment || {};
      codeMode = s.orderCode === 'id' ? 'id' : 'number';
      if (cafeInfo.mapUrl || cafeInfo.address) $('#locBtn').hidden = false;
      if (s.cafe && s.cafe.name) $('#cafeName').textContent = s.cafe.name;
      if (s.cafe && s.cafe.logo) {
        const logo = s.cafe.logo;
        $('#cafeLogo').innerHTML = /^(https?:|\/)/.test(logo) ? `<img src="${esc(logo)}" alt="لوگو" />` : esc(logo);
      }
      // شعار و تصویر کاور هدر (از مدیریت هدر)
      if (s.cafe && s.cafe.tagline) {
        const t = $('#cafeTagline'); t.textContent = s.cafe.tagline; t.hidden = false;
      }
      if (s.cafe && s.cafe.cover) {
        const h = $('#appHeader');
        h.classList.add('has-cover');
        h.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.55)), url("${s.cafe.cover}")`;
      }
    } catch (e) { /* پیش‌فرض می‌ماند */ }
  }

  // ---- بارگذاری منو ----
  async function loadMenu() {
    menu = await fetch('/api/menu').then((r) => r.json());
    $('#tableLabel').textContent = 'میز ' + faNum(table);
    renderCategories();
    renderMenu();
    setupScrollSpy();
  }

  function renderCategories() {
    const nav = $('#categories');
    const select = $('#catSelect');
    nav.innerHTML = '';
    select.innerHTML = '';
    menu.categories.forEach((cat, i) => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (i === 0 ? ' active' : '');
      chip.dataset.cat = cat.id;
      if (isImg(cat.icon)) chip.innerHTML = `<img class="chip-ic" src="${esc(cat.icon)}" alt="" /> ${esc(cat.name)}`;
      else chip.textContent = (cat.icon ? cat.icon + ' ' : '') + cat.name;
      chip.onclick = () => goToCategory(cat.id);
      nav.appendChild(chip);

      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = (cat.icon && !isImg(cat.icon) ? cat.icon + ' ' : '') + cat.name;
      select.appendChild(opt);
    });
    activeCat = menu.categories[0] && menu.categories[0].id;
    select.onchange = () => goToCategory(select.value);
  }

  function renderMenu() {
    const main = $('#menu');
    main.innerHTML = '';
    menu.categories.forEach((cat) => {
      const items = menu.items.filter((it) => it.categoryId === cat.id && it.available !== false);
      if (items.length === 0) return;

      const section = document.createElement('section');
      section.className = 'cat-section';
      section.id = 'cat-' + cat.id;
      section.dataset.cat = cat.id;
      section.innerHTML = `<h3 class="cat-title">${esc(cat.name)}<span class="u"></span></h3>`;

      if (viewMode === 'list') {
        const wrap = document.createElement('div');
        wrap.className = 'list-wrap';
        items.forEach((item) => wrap.appendChild(renderListItem(item)));
        section.appendChild(wrap);
      } else if (viewMode === 'scroll') {
        // کاورفلوی سه‌بعدی: کارت وسط بزرگ، کناری‌ها کج و محو؛ فلش/نقطه/کشیدن/اتوپلی
        section.appendChild(renderCoverflow(items));
      } else {
        const grid = document.createElement('div');
        grid.className = 'card-grid';
        items.forEach((item) => grid.appendChild(renderCard(item)));
        section.appendChild(grid);
      }
      main.appendChild(section);
    });
  }

  // ردیف حالت سطری: نام راست، قیمت چپ؛ با کلیک باز می‌شود و عکس را نشان می‌دهد
  function renderListItem(item) {
    const onSale = item.oldPrice && item.oldPrice > item.price;
    const priceHtml = onSale ? `<s>${price(item.oldPrice)}</s>${price(item.price)}` : price(item.price);
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="list-head">
        <span class="list-name">${esc(item.name)}</span>
        <span class="list-price">${priceHtml}</span>
        <button class="list-share" title="اشتراک‌گذاری" aria-label="اشتراک‌گذاری">${SHARE_SVG}</button>
        <span class="list-chevron">▾</span>
      </div>
      <div class="list-body">
        <div class="list-img${item.image ? '' : ' no-img'}">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" /><span class="img-wm">${esc(cafeInfo.name || '')}</span>` : (item.emoji || '🍽️')}</div>
        ${item.description ? `<div class="list-desc">${esc(item.description)}</div>` : ''}
        <div class="list-add" id="act-${item.id}"></div>
      </div>`;
    el.querySelector('.list-head').onclick = () => el.classList.toggle('open');
    el.querySelector('.list-share').onclick = (e) => { e.stopPropagation(); shareProduct(item); };
    const img = el.querySelector('.list-img img');
    if (img) {
      img.onerror = () => { const b = el.querySelector('.list-img'); b.classList.add('no-img'); b.innerHTML = item.emoji || '🍽️'; };
      el.querySelector('.list-img').onclick = (e) => { e.stopPropagation(); openLightbox(item.image, item.name); };
    }
    el.querySelector('#act-' + item.id).appendChild(itemControl(item));
    return el;
  }

  // کارت محصول: عکس (قابل بزرگ‌نمایی) + عنوان + ترکیبات + قیمت + دکمه افزودن
  function renderCard(item) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const hasImg = !!item.image;
    const onSale = item.oldPrice && item.oldPrice > item.price;

    // ریبون گوشه: فقط تخفیف
    const ribbon = onSale ? `<div class="card-ribbon"><span>تخفیف</span></div>` : '';

    // نمایش قیمت: در حالت تخفیف، قیمت قبلی خط‌خورده + قیمت جدید
    const priceHtml = onSale
      ? `<span class="price-badge"><s>${price(item.oldPrice)}</s>${price(item.price)}</span>`
      : `<span class="price-badge">${price(item.price)}</span>`;

    card.innerHTML = `
      <div class="product-img${hasImg ? '' : ' no-img'}">
        ${ribbon}
        ${hasImg ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" />` : ''}
        ${hasImg ? `<span class="img-wm">${esc(cafeInfo.name || '')}</span>` : ''}
        <span class="ph">${item.emoji || '🍽️'}</span>
      </div>
      <div class="product-body">
        <h4 class="product-name">${esc(item.name)}</h4>
        <p class="ingredients">${esc(item.description)}</p>
        <div class="share-row"><button class="share-btn" title="اشتراک‌گذاری" aria-label="اشتراک‌گذاری">${SHARE_SVG}</button></div>
        <div class="product-foot">
          ${priceHtml}
          <span class="add-control" id="act-${item.id}"></span>
        </div>
      </div>`;

    const imgBox = card.querySelector('.product-img');
    const imgEl = imgBox.querySelector('img');
    if (imgEl) imgEl.onerror = () => { imgBox.classList.add('no-img'); imgEl.remove(); };
    imgBox.onclick = () => { if (item.image) openLightbox(item.image, item.name); };
    card.querySelector('.share-btn').onclick = (e) => { e.stopPropagation(); shareProduct(item); };
    card.querySelector('#act-' + item.id).appendChild(itemControl(item));
    return card;
  }

  // ---- کاورفلوی سه‌بعدی (حالت کاروسل) ----
  const CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

  function coverCard(item) {
    const onSale = item.oldPrice && item.oldPrice > item.price;
    const priceHtml = onSale ? `<s>${price(item.oldPrice)}</s> ${price(item.price)}` : price(item.price);
    const img = item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" /><span class="cf-wm">${esc(cafeInfo.name || '')}</span>`
      : `<span class="cf-ph">${item.emoji || '🍽️'}</span>`;
    return `<article class="cf-card" data-id="${esc(item.id)}">
      <div class="cf-photo">${img}${onSale ? '<span class="cf-ribbon">تخفیف</span>' : ''}</div>
      <div class="cf-shade"></div>
      <div class="cf-content">
        <button class="cf-share" data-id="${esc(item.id)}" aria-label="اشتراک‌گذاری">${SHARE_SVG}</button>
        <div class="cf-info">
          <h2 class="cf-title">${esc(item.name)}</h2>
          <span class="cf-rule"></span>
          ${item.description ? `<p class="cf-desc">${esc(item.description)}</p>` : ''}
          <div class="cf-foot">
            <span class="cf-price">${priceHtml}</span>
            <button class="cf-add" data-id="${esc(item.id)}" aria-label="افزودن به سبد">+</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderCoverflow(items) {
    const dir = 1; // coverflow keeps an LTR fan; arrows are physical left/right
    const total = items.length;
    const cf = document.createElement('div');
    cf.className = 'cf';
    cf.innerHTML = `
      <div class="cf-amb"></div>
      <div class="cf-stage">${items.map(coverCard).join('')}</div>
      <button class="cf-arrow cf-prev" aria-label="قبلی">${CHEV_L}</button>
      <button class="cf-arrow cf-next" aria-label="بعدی">${CHEV_R}</button>
      <div class="cf-dots">${items.map((_, i) => `<button class="cf-dot" data-i="${i}" aria-label="اسلاید ${i + 1}"></button>`).join('')}</div>`;

    const stage = cf.querySelector('.cf-stage');
    const amb = cf.querySelector('.cf-amb');
    const cards = [...stage.querySelectorAll('.cf-card')];
    const dots = [...cf.querySelectorAll('.cf-dot')];
    let idx = 0;

    function layout() {
      const cw = cards[0] ? cards[0].offsetWidth : 300;
      const d1 = Math.round(cw * 0.72), d2 = Math.round(cw * 1.28);
      cards.forEach((card, i) => {
        const off = (i - idx + total) % total;
        let x = 0, s = 0.4, ry = 0, op = 0, z = 0, fil = 'brightness(0.3)';
        if (off === 0) { x = 0; s = 1; ry = 0; op = 1; z = 30; fil = 'brightness(1)'; }
        else if (off === 1) { x = dir * d1; s = 0.82; ry = -dir * 26; op = 0.62; z = 20; fil = 'brightness(0.72)'; }
        else if (off === 2) { x = dir * d2; s = 0.66; ry = -dir * 40; op = 0.34; z = 10; fil = 'brightness(0.5) blur(1px)'; }
        else if (off === total - 1) { x = -dir * d1; s = 0.82; ry = dir * 26; op = 0.62; z = 20; fil = 'brightness(0.72)'; }
        else if (off === total - 2) { x = -dir * d2; s = 0.66; ry = dir * 40; op = 0.34; z = 10; fil = 'brightness(0.5) blur(1px)'; }
        card.style.transform = `translateX(${x}px) scale(${s}) rotateY(${ry}deg)`;
        card.style.opacity = op;
        card.style.zIndex = z;
        card.style.filter = fil;
        card.classList.toggle('cf-on', off === 0);
      });
      dots.forEach((d, i) => d.classList.toggle('on', i === idx));
      if (items[idx] && items[idx].image) amb.style.backgroundImage = `url("${items[idx].image}")`;
    }
    const go = (n) => { idx = (n + total) % total; layout(); };
    const next = () => go(idx + 1);
    const prev = () => go(idx - 1);

    cf.querySelector('.cf-next').onclick = next;
    cf.querySelector('.cf-prev').onclick = prev;
    dots.forEach((d, i) => (d.onclick = () => go(i)));
    cards.forEach((card, i) => {
      card.onclick = (e) => {
        const off = (i - idx + total) % total;
        if (off !== 0) { go(i); return; }
        const t = e.target.closest('.cf-add, .cf-share');
        const it = items[i];
        if (t && t.classList.contains('cf-add')) { e.stopPropagation(); setQty(it.id, (cart.get(it.id) || 0) + 1); t.dataset.qty = cart.get(it.id) || 0; }
        else if (t && t.classList.contains('cf-share')) { e.stopPropagation(); shareProduct(it); }
        else if (it.image) { openLightbox(it.image, it.name); }
      };
      const im = card.querySelector('.cf-photo img');
      if (im) im.onerror = () => { const p = card.querySelector('.cf-photo'); p.classList.add('no-img'); p.innerHTML = `<span class="cf-ph">${items[i].emoji || '🍽️'}</span>`; };
    });

    // autoplay (paused on hover)
    let timer;
    const stop = () => clearInterval(timer);
    const start = () => { stop(); if (total > 1) timer = setInterval(next, 5000); };
    cf.addEventListener('mouseenter', stop);
    cf.addEventListener('mouseleave', start);

    // touch swipe
    let tx = 0;
    stage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; stop(); }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const dd = e.changedTouches[0].clientX - tx;
      if (Math.abs(dd) > 45) { (dd < 0 ? next : prev)(); }
      start();
    });

    // first layout after it's in the DOM (needs measured width)
    requestAnimationFrame(layout);
    setTimeout(() => { layout(); start(); }, 60);
    return cf;
  }

  // دکمه «+» یا استپر تعداد
  function itemControl(item) {
    const qty = cart.get(item.id) || 0;
    if (qty === 0) {
      const btn = document.createElement('button');
      btn.className = 'add-btn';
      btn.setAttribute('aria-label', 'افزودن به سبد');
      btn.textContent = '+';
      btn.onclick = () => setQty(item.id, 1);
      return btn;
    }
    const wrap = document.createElement('div');
    wrap.className = 'stepper';
    wrap.innerHTML = `<button aria-label="کم">−</button><span>${faNum(qty)}</span><button aria-label="زیاد">+</button>`;
    const [minus, , plus] = wrap.children;
    minus.onclick = () => setQty(item.id, qty - 1);
    plus.onclick = () => setQty(item.id, qty + 1);
    return wrap;
  }

  function setQty(id, qty) {
    if (qty <= 0) cart.delete(id);
    else cart.set(id, qty);
    const holder = document.getElementById('act-' + id);
    if (holder) {
      holder.innerHTML = '';
      holder.appendChild(itemControl(menu.items.find((i) => i.id === id)));
    }
    renderCartBar();
  }

  // ---- لایت‌باکس ----
  function openLightbox(src, alt) {
    if (!src) return;
    $('#lightboxImg').src = src;
    $('#lightboxImg').alt = alt || '';
    $('#lightbox').hidden = false;
  }
  $('#lightbox').onclick = () => ($('#lightbox').hidden = true);

  // ---- اشتراک‌گذاری محصول (همراه لوکیشن کافه) ----
  function shareText(item) {
    const lines = [`${item.name} — ${price(item.price)}`];
    if (cafeInfo.name) lines.push(`☕ ${cafeInfo.name}`);
    if (cafeInfo.address) lines.push(`📍 ${cafeInfo.address}`);
    if (cafeInfo.mapUrl) lines.push(`🗺️ ${cafeInfo.mapUrl}`);
    if (cafeInfo.instagram) lines.push(`📷 ${cafeInfo.instagram}`);
    return lines.join('\n');
  }
  // لینک عمومیِ خودِ محصول (صفحه‌ی اشتراک‌گذاری محصول)
  const productUrl = (item) => location.origin + '/product?id=' + encodeURIComponent(item.id);

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch (e2) { return false; }
    }
  }

  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);

  // اشتراک‌گذاری: روی گوشی → ارسال تصویر محصول به منوی اشتراک گوشی،
  // مشتری اینستاگرام را انتخاب می‌کند و با اکانت خودش استوری یا پست می‌کند.
  async function shareProduct(item) {
    const url = productUrl(item);
    const text = shareText(item) + '\n' + url; // لینک محصول همیشه در کپشن باشد
    if (navigator.share) {
      try {
        // اشتراک فایل عکس (مناسب استوری/پست اینستاگرام) همراه با کپشن
        if (item.image && navigator.canShare) {
          try {
            const blob = await (await fetch(item.image)).blob();
            const file = new File([blob], (item.name || 'product') + '.jpg', { type: blob.type || 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], text, title: item.name });
              return;
            }
          } catch (e) { /* fallback به اشتراک لینک */ }
        }
        await navigator.share({ title: item.name, text, url });
        return;
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('اشتراک‌گذاری انجام نشد');
        return;
      }
    }
    // اشتراک بومی در دسترس نیست (دسکتاپ یا کانتکست ناامن): کپی کامل اطلاعات
    const ok = await copyText(text);
    toast(ok ? 'لینک و مشخصات محصول کپی شد 📋' : 'کپی نشد');
  }

  // ---- دسته فعال + اسکرول ----
  function goToCategory(catId) {
    const el = document.getElementById('cat-' + catId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategory(catId);
  }
  function setActiveCategory(catId) {
    if (catId === activeCat) return;
    activeCat = catId;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === catId));
    const select = $('#catSelect');
    if (select.value !== catId) select.value = catId;
  }
  let scrollSpyOn = false;
  function setupScrollSpy() {
    if (scrollSpyOn) return; // فقط یک‌بار وصل شود
    scrollSpyOn = true;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sections = [...document.querySelectorAll('.cat-section')];
        const offset = 175;
        let current = sections[0];
        for (const s of sections) {
          if (s.getBoundingClientRect().top - offset <= 0) current = s;
        }
        if (current) setActiveCategory(current.dataset.cat);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- سبد خرید ----
  function cartLines() {
    return [...cart.entries()].map(([id, qty]) => {
      const item = menu.items.find((i) => i.id === id);
      return { id, name: item.name, price: item.price, qty };
    });
  }
  const cartCount = () => [...cart.values()].reduce((a, b) => a + b, 0);
  const cartTotal = () => cartLines().reduce((s, l) => s + l.price * l.qty, 0);

  function renderCartBar() {
    const count = cartCount();
    $('#cartBar').hidden = count === 0;
    $('#cartCount').textContent = faNum(count);
    $('#cartBarTotal').textContent = price(cartTotal());
  }

  function renderCart() {
    const box = $('#cartItems');
    box.innerHTML = '';
    cartLines().forEach((line) => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `
        <div><strong>${esc(line.name)}</strong><div class="muted">${price(line.price)}</div></div>
        <div class="stepper"><button>−</button><span>${faNum(line.qty)}</span><button>+</button></div>`;
      const [minus, , plus] = row.querySelector('.stepper').children;
      minus.onclick = () => { setQty(line.id, line.qty - 1); renderCart(); };
      plus.onclick = () => { setQty(line.id, line.qty + 1); renderCart(); };
      box.appendChild(row);
    });
    $('#cartTotal').textContent = price(cartTotal());
    if (cartCount() === 0) closeSheet('cartSheet');
  }

  // ---- ثبت سفارش ----
  async function submitOrder() {
    if (cartCount() === 0) return;
    const btn = $('#confirmOrder');
    btn.disabled = true;
    btn.textContent = 'در حال ارسال…';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, items: cartLines(), note: $('#orderNote').value, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ثبت سفارش');

      currentOrderId = data.id;
      localStorage.setItem('cafe_order_' + table, data.id); // برای پیگیری پس از رفرش
      cart.clear();
      $('#orderNote').value = '';
      renderMenu();
      renderCartBar();
      closeSheet('cartSheet');
      showOrderSheet(data);
      openSheet('orderSheet');
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'تایید و ثبت سفارش';
    }
  }

  const STATUS_FA = {
    new: 'در انتظار تایید آشپزخانه',
    preparing: 'در حال آماده‌سازی ☕',
    ready: 'آماده است! ✅',
    served: 'سرو شد',
    cancelled: 'لغو شد',
  };
  const STATUS_SHORT = { new: 'ثبت شد', preparing: 'آماده‌سازی', ready: 'آماده ✅', served: 'سرو شد', cancelled: 'لغو شد' };

  function showOrderSheet(order) {
    $('#orderId').textContent = fmtCode(order);
    $('#feedbackLink').href = `/feedback?table=${encodeURIComponent(table)}&order=${encodeURIComponent(order.id)}`;
    updateOrder(order);
  }
  let lastPayStatus = null;
  // به‌روزرسانی متن وضعیت در شیت و نوار پیگیری
  function updateOrder(order) {
    currentOrder = order;
    if (order.payStatus === 'confirmed' && lastPayStatus === 'pending') toast('پرداخت شما تأیید شد ✅');
    lastPayStatus = order.payStatus;
    renderPayStatus();
    $('#orderStatusText').textContent = STATUS_FA[order.status] || order.status;
    const tracker = $('#orderTracker');
    const bar = document.querySelector('.bottom-bar');
    if (order.status === 'cancelled') {
      tracker.hidden = true;
      if (bar) bar.classList.remove('with-order');
      localStorage.removeItem('cafe_order_' + table);
      return;
    }
    tracker.hidden = false;
    if (bar) bar.classList.add('with-order');
    tracker.classList.toggle('ready', order.status === 'ready');
    $('#otStatus').textContent = STATUS_SHORT[order.status] || order.status;
  }

  // بازیابی سفارش قبلی پس از رفرش صفحه
  async function restoreOrder() {
    const saved = localStorage.getItem('cafe_order_' + table);
    if (!saved) return;
    try {
      const res = await fetch('/api/orders/' + saved);
      if (!res.ok) { localStorage.removeItem('cafe_order_' + table); return; }
      const order = await res.json();
      currentOrderId = order.id;
      showOrderSheet(order);
    } catch (e) { /* نادیده */ }
  }

  // ---- درخواست گارسون / فاکتور ----
  async function sendRequest(type, note) {
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, type, note: note || '' }),
      });
      if (!res.ok) throw new Error('خطا در ارسال درخواست');
      toast(type === 'waiter' ? 'گارسون به‌زودی می‌آید 🙋' : 'درخواست فاکتور ارسال شد 🧾');
      $('#waiterNote').value = '';
      closeSheet('actionsSheet');
    } catch (err) {
      toast(err.message);
    }
  }

  // ---- صورتحساب و پرداخت ----
  // صورتحساب = تب جاری میز: همه‌ی سفارش‌های پرداخت‌نشده که با هم جمع شده‌اند.
  let bill = { count: 0, total: 0, payStatus: 'none', receipt: '', orders: [] };

  async function openInvoice() {
    closeSheet('actionsSheet'); closeSheet('orderSheet');
    openSheet('invoiceSheet');

    // لینک پرداخت آنلاین
    const link = (payInfo.link || '').trim();
    const payLink = $('#payLink');
    if (link) { payLink.href = link; payLink.hidden = false; } else { payLink.hidden = true; }

    // کارت به کارت
    const card = (payInfo.card || '').trim();
    if (card) {
      $('#payCard').hidden = false;
      $('#cardNumber').textContent = card;
      $('#cardHolder').textContent = payInfo.holder ? 'به نام ' + payInfo.holder : '';
    } else { $('#payCard').hidden = true; }

    $('#payNote').textContent = payInfo.note || '';
    if (!link && !card) $('#payNote').textContent = payInfo.note || 'برای پرداخت با صندوقدار هماهنگ کنید.';

    // بازنشانی بخش فیش
    pendingReceipt = null;
    $('#receiptInput').value = '';
    $('#sendReceipt').hidden = true;

    $('#invTotal').textContent = '…';
    await loadBill();
  }

  // دریافت و نمایش کل صورتحساب میز (همه‌ی سفارش‌های پرداخت‌نشده + جمع کل)
  async function loadBill() {
    try {
      bill = await fetch('/api/orders/table/' + encodeURIComponent(table) + '/bill').then((r) => r.json());
    } catch (e) {
      bill = { count: 0, total: 0, payStatus: 'none', receipt: '', orders: [] };
    }
    renderBill();
  }

  function renderBill() {
    const list = $('#billList');
    if (bill.count > 0) {
      list.innerHTML = bill.orders.map(billRow).join('');
      $('#invTotal').textContent = price(bill.total);
    } else {
      list.innerHTML = '<p class="muted">هنوز صورتحساب بازی ندارید — ابتدا سفارش ثبت کنید.</p>';
      $('#invTotal').textContent = '—';
    }
    // یک فیش بین همه‌ی سفارش‌های میز مشترک است
    if (!pendingReceipt) {
      $('#receiptPreview').innerHTML = bill.receipt ? `<img src="${bill.receipt}" alt="فیش" />` : '';
    }
    renderPayStatus();
  }

  // هر ردیف یک سفارش از صورتحساب: کد + اقلام + مبلغ همان سفارش
  function billRow(o) {
    const items = o.items.map((it) => `${esc(it.name)} ×${faNum(it.qty)}`).join('، ');
    return `<div class="bill-row">
      <div class="bill-row-main"><b>${fmtCode(o)}</b> <span class="muted">${items}</span></div>
      <strong>${price(o.total)}</strong>
    </div>`;
  }

  // وضعیت پرداختِ کل صورتحساب (در انتظار تأیید / رد‌شده توسط صندوق)
  function renderPayStatus() {
    const el = $('#payStatusMsg');
    const ps = bill && bill.payStatus;
    if (ps === 'pending') {
      el.hidden = false; el.style.background = '#fff4e0'; el.style.color = '#d9822b';
      el.textContent = 'فیش ارسال شد — در انتظار تأیید صندوقدار ⏳';
    } else if (ps === 'rejected') {
      el.hidden = false; el.style.background = '#fff4f4'; el.style.color = '#b3141f';
      el.textContent = '❌ فیش تأیید نشد' + (bill.rejectedReason ? ' (' + bill.rejectedReason + ')' : '') + ' — لطفاً فیش معتبر ارسال کنید';
    } else { el.hidden = true; }
  }

  // اشتراک موقعیت کافه با پیام‌رسان‌ها
  async function shareLocation() {
    const lines = ['📍 موقعیت ' + (cafeInfo.name || 'کافه')];
    if (cafeInfo.address) lines.push(cafeInfo.address);
    if (cafeInfo.mapUrl) lines.push(cafeInfo.mapUrl);
    if (cafeInfo.instagram) lines.push('📷 ' + cafeInfo.instagram);
    const text = lines.join('\n');
    const url = cafeInfo.mapUrl || location.origin;
    if (navigator.share) {
      try { await navigator.share({ title: cafeInfo.name || 'موقعیت کافه', text, url }); }
      catch (e) { if (e && e.name !== 'AbortError') toast('اشتراک‌گذاری انجام نشد'); }
      return;
    }
    const ok = await copyText(text + '\n' + (cafeInfo.mapUrl || ''));
    toast(ok ? 'موقعیت کپی شد — در پیام‌رسان جای‌گذاری کنید 📋' : 'کپی نشد');
  }

  $('#receiptInput').onchange = async () => {
    const file = $('#receiptInput').files[0];
    if (!file) return;
    try {
      pendingReceipt = await resizeImage(file, 1000);
      $('#receiptPreview').innerHTML = `<img src="${pendingReceipt}" alt="فیش" />`;
      $('#sendReceipt').hidden = false;
    } catch (e) { toast('خطا در خواندن عکس'); }
  };

  $('#sendReceipt').onclick = async () => {
    if (!pendingReceipt) return;
    if (!bill.count) return toast('صورتحساب بازی برای پرداخت وجود ندارد');
    const btn = $('#sendReceipt'); btn.disabled = true; btn.textContent = 'در حال ارسال…';
    try {
      // یک فیش کل صورتحساب میز (همه‌ی سفارش‌های پرداخت‌نشده) را تسویه می‌کند
      const res = await fetch('/api/orders/table/' + encodeURIComponent(table) + '/receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: pendingReceipt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال فیش');
      toast('✅ فیش ارسال شد — در انتظار تأیید صندوقدار');
      pendingReceipt = null;
      $('#receiptInput').value = ''; $('#sendReceipt').hidden = true;
      await loadBill();
    } catch (err) { toast('❌ ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'ارسال فیش'; }
  };

  $('#copyCard').onclick = async () => {
    const ok = await copyText((payInfo.card || '').replace(/\s/g, ''));
    toast(ok ? 'شماره کارت کپی شد ✅' : 'کپی نشد');
  };
  $('#sendInvoiceReq').onclick = () => sendRequest('invoice', '');

  function resizeImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  // ---- دروازه‌ی ورود: تأیید شماره موبایل با کد پیامکی (OTP) ----
  function normalizePhone(raw) {
    let p = String(raw || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
    if (p.startsWith('0098')) p = '0' + p.slice(4);
    else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
    if (p.length === 10 && p.startsWith('9')) p = '0' + p;
    return p;
  }
  function isVerified() {
    try {
      const v = JSON.parse(localStorage.getItem('cafe_verified') || 'null');
      if (v && v.phone && Date.now() - v.ts < 12 * 3600 * 1000) { phone = v.phone; return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  let gatePhone = '';
  function showGate() {
    if (cafeInfo.name) $('#gateCafe').textContent = cafeInfo.name;
    if (cafeInfo.logo) {
      $('#gateLogo').innerHTML = /^(https?:|\/)/.test(cafeInfo.logo) ? `<img src="${esc(cafeInfo.logo)}" alt="" />` : esc(cafeInfo.logo);
    }
    $('#gateScreen').hidden = false;
  }
  async function gateSend() {
    const p = normalizePhone($('#gatePhone').value);
    if (!/^09\d{9}$/.test(p)) return toast('شماره موبایل را درست وارد کنید (مثل ۰۹۱۲۳۴۵۶۷۸۹)');
    const btn = $('#gateSend'); btn.disabled = true; btn.textContent = 'در حال ارسال…';
    try {
      const res = await fetch('/api/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: p }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال کد');
      gatePhone = p;
      $('#gatePhoneLabel').textContent = faNum(p);
      $('#gateStep1').hidden = true; $('#gateStep2').hidden = false;
      const demo = $('#gateDemo');
      if (data.demo && data.code) { demo.hidden = false; demo.innerHTML = `🔧 حالت آزمایشی (بدون پیامک واقعی): کد شما <b>${faNum(data.code)}</b> است`; }
      else demo.hidden = true;
      $('#gateCode').value = ''; $('#gateCode').focus();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.textContent = 'ارسال کد تأیید'; }
  }
  async function gateVerify() {
    const code = $('#gateCode').value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
    if (!code) return toast('کد تأیید را وارد کنید');
    const btn = $('#gateVerify'); btn.disabled = true; btn.textContent = 'در حال بررسی…';
    try {
      const res = await fetch('/api/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: gatePhone, code, table }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'کد نادرست است');
      phone = gatePhone;
      localStorage.setItem('cafe_phone', phone);
      localStorage.setItem('cafe_verified', JSON.stringify({ phone, ts: Date.now() }));
      $('#gateScreen').hidden = true;
      afterVerified();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.textContent = 'تأیید و ورود'; }
  }
  $('#gateSend').onclick = gateSend;
  $('#gateVerify').onclick = gateVerify;
  $('#gateBack').onclick = () => { $('#gateStep2').hidden = true; $('#gateStep1').hidden = false; };
  $('#gatePhone').addEventListener('keydown', (e) => { if (e.key === 'Enter') gateSend(); });
  $('#gateCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') gateVerify(); });

  // پس از تأیید: اگر میز از روی QR مشخص باشد منو باز می‌شود، وگرنه صفحه‌ی اسکن QR
  function afterVerified() {
    if (!table) { $('#scanScreen').hidden = false; return; }
    loadMenu().then(() => restoreOrder()).catch(() => { showBanner(); toast('خطا در بارگذاری منو'); });
  }

  // ---- رویدادها ----
  $('#requestsBtn').onclick = () => openSheet('actionsSheet');
  $('#cartBar').onclick = () => { renderCart(); openSheet('cartSheet'); };
  $('#confirmOrder').onclick = submitOrder;
  $('#orderTracker').onclick = () => openSheet('orderSheet');
  $('#afterWaiter').onclick = () => { closeSheet('orderSheet'); openSheet('actionsSheet'); };
  $('#invoiceBtn').onclick = openInvoice;
  $('#invoiceBtnOrder').onclick = openInvoice;
  $('#locBtn').onclick = shareLocation;

  // ---- تم تیره/روشن (ذخیره‌شونده؛ در <head> زود اعمال می‌شود تا فلش نزند) ----
  $('#themeToggle').onclick = () => {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('cafe_theme', dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  };

  // تغییر حالت نمایش منو (کارتی/سطری)
  function updateViewToggle() {
    document.querySelectorAll('#viewToggle button').forEach((b) => b.classList.toggle('active', b.dataset.view === viewMode));
  }
  document.querySelectorAll('#viewToggle button').forEach((b) => {
    b.onclick = () => {
      if (viewMode === b.dataset.view) return;
      viewMode = b.dataset.view;
      localStorage.setItem('cafe_view', viewMode);
      updateViewToggle();
      renderMenu();
    };
  });
  updateViewToggle();

  document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => closeSheet(el.dataset.close); });
  document.querySelectorAll('[data-request]').forEach((el) => {
    el.onclick = () => sendRequest(el.dataset.request, el.dataset.request === 'waiter' ? $('#waiterNote').value : '');
  });
  document.querySelectorAll('[data-fill]').forEach((el) => {
    el.onclick = () => {
      const box = $('#waiterNote');
      box.value = box.value ? box.value + '، ' + el.dataset.fill : el.dataset.fill;
      box.focus();
    };
  });
  document.querySelectorAll('.sheet').forEach((sheet) => {
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
  });

  // ---- شروع ----
  (async () => {
    await loadSettings();               // واحد پول، لوگو و نام کافه
    if (isVerified()) afterVerified();  // قبلاً تأیید شده → مستقیم منو
    else showGate();                    // نیاز به تأیید شماره با کد پیامکی
  })();
})();
