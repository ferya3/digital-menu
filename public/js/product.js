(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const id = new URLSearchParams(location.search).get('id');
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let currency = 'toman';
  const price = (t) => {
    const n = currency === 'rial' ? t * 10 : t;
    return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان');
  };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2500); }

  let cafe = {}, item = null;

  async function load() {
    let menu = { items: [] }, settings = {};
    try {
      [menu, settings] = await Promise.all([
        fetch('/api/menu').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);
    } catch (e) { $('#pName').textContent = 'خطا در بارگذاری'; return; }

    cafe = settings.cafe || {};
    currency = settings.currency === 'rial' ? 'rial' : 'toman';
    if (cafe.name) { $('#cafeName').textContent = cafe.name; document.title = cafe.name; }
    if (cafe.logo) $('#cafeLogo').innerHTML = /^(https?:|\/)/.test(cafe.logo) ? `<img src="${esc(cafe.logo)}" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover">` : esc(cafe.logo);

    item = (menu.items || []).find((i) => i.id === id);
    if (!item) { $('#pName').textContent = 'محصول یافت نشد'; $('#pPrice').textContent = ''; return; }

    document.title = item.name + ' | ' + (cafe.name || 'کافه');
    $('#pImg').innerHTML = item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}"><span class="img-wm">${esc(cafe.name || '')}</span>` : `<span>${item.emoji || '🍽️'}</span>`;
    $('#pName').textContent = item.name;
    $('#pDesc').textContent = item.description || '';
    const onSale = item.oldPrice && item.oldPrice > item.price;
    $('#pPrice').innerHTML = onSale
      ? `<s class="muted" style="font-size:0.95rem">${price(item.oldPrice)}</s> ${price(item.price)}`
      : price(item.price);

    // لوکیشن کافه
    const locParts = [];
    if (cafe.address) locParts.push(`📍 ${esc(cafe.address)}`);
    if (cafe.instagram) locParts.push(`📷 ${esc(cafe.instagram)}`);
    if (locParts.length) { $('#pLoc').hidden = false; $('#pLoc').innerHTML = locParts.join('<br>'); }
    if (cafe.mapUrl) { $('#mapBtn').hidden = false; $('#mapBtn').href = cafe.mapUrl; }
  }

  // اشتراک‌گذاری همین محصول
  $('#shareBtn').onclick = async () => {
    if (!item) return;
    const url = location.href;
    const lines = [`${item.name} — ${price(item.price)}`];
    if (cafe.name) lines.push(`☕ ${cafe.name}`);
    if (cafe.address) lines.push(`📍 ${cafe.address}`);
    if (cafe.mapUrl) lines.push(`🗺️ ${cafe.mapUrl}`);
    if (cafe.instagram) lines.push(`📷 ${cafe.instagram}`);
    const text = lines.join('\n') + '\n' + url; // لینک محصول همیشه باشد
    if (navigator.share) {
      try {
        if (item.image && navigator.canShare) {
          try {
            const blob = await (await fetch(item.image)).blob();
            const file = new File([blob], (item.name || 'product') + '.jpg', { type: blob.type || 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: item.name }); return; }
          } catch (e) { /* ادامه */ }
        }
        await navigator.share({ title: item.name, text, url });
        return;
      } catch (e) { if (e && e.name !== 'AbortError') toast('اشتراک‌گذاری انجام نشد'); return; }
    }
    try { await navigator.clipboard.writeText(text); toast('لینک و مشخصات کپی شد 📋'); }
    catch (e) { toast('کپی نشد'); }
  };

  load();
})();
