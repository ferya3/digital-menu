(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3000);
  }
  const showBanner = () => ($('#netBanner').hidden = false);
  if (location.protocol === 'file:') showBanner();

  let menu = { categories: [], items: [] };
  let currency = 'toman';
  let editingId = null;       // null = افزودن، وگرنه ویرایش محصول
  let editingCat = null;      // null = افزودن، وگرنه ویرایش دسته
  let catIconData = null;     // عکس آیکون دسته (data URL) که جای ایموجی می‌نشیند
  const isImg = (s) => /^(https?:|\/|data:image)/.test(String(s || '')); // عکس در برابر ایموجی
  let pendingImage = null;    // data URL عکس انتخاب‌شده

  const curLabel = () => (currency === 'rial' ? 'ریال' : 'تومان');
  const toDisplay = (toman) => (currency === 'rial' ? toman * 10 : toman);     // نمایش
  const fromInput = (val) => (currency === 'rial' ? Math.round(val / 10) : Math.round(val)); // ذخیره (تومان)
  const priceText = (toman) => faNum(Number(toDisplay(toman)).toLocaleString('en-US')) + ' ' + curLabel();

  // ---- بارگذاری ----
  async function load() {
    try {
      const [m, s] = await Promise.all([
        fetch('/api/menu').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);
      menu = m;
      currency = s.currency === 'rial' ? 'rial' : 'toman';
    } catch (e) { showBanner(); }
    renderCurrency();
    renderEmojiPicks();
    renderCatList();
    renderCatSelect();
    renderList();
  }

  // ---- واحد پول ----
  function renderCurrency() {
    document.querySelectorAll('#currencySeg .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.cur === currency);
    });
    $('#priceLabel').textContent = 'قیمت (' + curLabel() + ')';
    $('#oldPriceLabel').textContent = 'قیمت قبل از تخفیف (' + curLabel() + ' — اختیاری)';
  }
  document.querySelectorAll('#currencySeg .seg-btn').forEach((b) => {
    b.onclick = async () => {
      const prevPrice = $('#pPrice').value ? fromInput(+$('#pPrice').value) : null;
      const prevOld = $('#pOldPrice').value ? fromInput(+$('#pOldPrice').value) : null;
      currency = b.dataset.cur;
      renderCurrency();
      if (prevPrice != null) $('#pPrice').value = toDisplay(prevPrice);
      if (prevOld != null) $('#pOldPrice').value = toDisplay(prevOld);
      renderList();
      try {
        await fetch('/api/settings/admin', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency }),
        });
        toast('واحد پول روی «' + curLabel() + '» تنظیم شد');
      } catch (e) { showBanner(); toast('ذخیره واحد پول ناموفق بود'); }
    };
  });

  // ---- دسته‌بندی ----
  function renderCatSelect() {
    const sel = $('#pCat');
    sel.innerHTML = '';
    menu.categories.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = (c.icon && !isImg(c.icon) ? c.icon + ' ' : '') + c.name;
      sel.appendChild(o);
    });
    const o = document.createElement('option');
    o.value = '__new__'; o.textContent = '➕ دسته‌ی جدید…';
    sel.appendChild(o);
    sel.onchange = () => { $('#newCatField').hidden = sel.value !== '__new__'; };
  }

  // ---- مدیریت دسته‌بندی‌ها (افزودن/ویرایش/حذف + ایکون) ----
  const EMOJIS = ['☕','🍵','🥤','🧊','🧋','🍰','🧁','🍩','🍪','🍦','🍔','🍟','🍕','🌭','🥪','🥗','🍝','🍜','🌮','🥙','🍳','🥞','🥐','🍫','🫖','🧃'];
  function renderEmojiPicks() {
    const box = $('#emojiPicks');
    box.innerHTML = '';
    EMOJIS.forEach((e) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'emoji-chip'; b.textContent = e;
      b.onclick = () => { $('#catIcon').value = e; clearCatIconImage(); };
      box.appendChild(b);
    });
  }
  function renderCatList() {
    const box = $('#catList');
    box.innerHTML = '';
    if (!menu.categories.length) { box.innerHTML = '<p class="empty">دسته‌ای وجود ندارد</p>'; return; }
    menu.categories.forEach((c) => {
      const count = menu.items.filter((it) => it.categoryId === c.id).length;
      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML = `
        <span class="cat-row-icon">${isImg(c.icon) ? `<img src="${esc(c.icon)}" alt="" />` : (c.icon || '🍽️')}</span>
        <span class="cat-row-name">${esc(c.name)} <span class="muted">(${faNum(count)} محصول)</span></span>
        <span class="cat-row-actions">
          <button class="btn small" data-edit>ویرایش</button>
          <button class="btn small danger" data-del>حذف</button>
        </span>`;
      row.querySelector('[data-edit]').onclick = () => startEditCat(c);
      row.querySelector('[data-del]').onclick = () => deleteCat(c);
      box.appendChild(row);
    });
  }
  function showCatIconImage(src) {
    catIconData = src;
    $('#catIconPreview').innerHTML = src ? `<img src="${esc(src)}" alt="icon" />` : '';
    if (src) $('#catIcon').value = '';
  }
  function clearCatIconImage() { catIconData = null; $('#catIconPreview').innerHTML = ''; $('#catIconFile').value = ''; }

  $('#catIconFile').onchange = async () => {
    const file = $('#catIconFile').files[0];
    if (!file) return;
    try { showCatIconImage(await resizeImage(file, 240)); }
    catch (e) { toast('عکس خوانده نشد'); }
  };

  function startEditCat(c) {
    editingCat = c.id;
    $('#catFormTitle').textContent = '✏️ ویرایش دسته: ' + c.name;
    $('#catName').value = c.name;
    if (isImg(c.icon)) { $('#catIcon').value = ''; showCatIconImage(c.icon); }
    else { $('#catIcon').value = c.icon || ''; clearCatIconImage(); }
    $('#catSave').textContent = 'ذخیره تغییرات';
    $('#catCancel').hidden = false;
    $('#catName').focus();
  }
  function resetCatForm() {
    editingCat = null;
    $('#catIcon').value = ''; $('#catName').value = '';
    clearCatIconImage();
    $('#catFormTitle').textContent = 'افزودن دسته‌ی جدید';
    $('#catSave').textContent = 'افزودن دسته';
    $('#catCancel').hidden = true;
  }
  $('#catCancel').onclick = resetCatForm;
  $('#catSave').onclick = async () => {
    const name = $('#catName').value.trim();
    const icon = catIconData || $('#catIcon').value.trim() || '🍽️';
    if (!name) return toast('نام دسته را وارد کنید');
    const btn = $('#catSave'); btn.disabled = true;
    try {
      const url = editingCat ? '/api/menu/categories/' + editingCat : '/api/menu/categories';
      const res = await fetch(url, {
        method: editingCat ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطا در ذخیره دسته');
      toast(editingCat ? '✅ دسته ویرایش شد' : '✅ دسته اضافه شد');
      menu = await fetch('/api/menu').then((r) => r.json());
      resetCatForm(); renderCatList(); renderCatSelect(); renderList();
    } catch (e) { toast('❌ ' + e.message); }
    finally { btn.disabled = false; }
  };
  async function deleteCat(c) {
    if (!confirm('حذف دسته «' + c.name + '»؟')) return;
    try {
      const res = await fetch('/api/menu/categories/' + c.id, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'خطا در حذف');
      toast('🗑️ دسته حذف شد');
      menu = await fetch('/api/menu').then((r) => r.json());
      if (editingCat === c.id) resetCatForm();
      renderCatList(); renderCatSelect(); renderList();
    } catch (e) { toast('❌ ' + e.message); }
  }

  // ---- لیست محصولات ----
  function renderList() {
    const box = $('#productList');
    $('#prodCount').textContent = faNum(menu.items.length);
    if (!menu.items.length) { box.innerHTML = '<p class="empty">هنوز محصولی اضافه نشده است</p>'; return; }
    box.innerHTML = '';
    menu.categories.forEach((cat) => {
      const items = menu.items.filter((it) => it.categoryId === cat.id);
      if (!items.length) return;
      const title = document.createElement('div');
      title.className = 'prod-cat-title';
      title.textContent = (cat.icon ? cat.icon + ' ' : '') + cat.name;
      box.appendChild(title);
      items.forEach((it) => box.appendChild(renderRow(it)));
    });
  }

  function renderRow(item) {
    const row = document.createElement('div');
    row.className = 'prod-row' + (item.available === false ? ' unavailable' : '');
    const onSale = item.oldPrice && item.oldPrice > item.price;
    const pricePart = onSale
      ? `<s class="muted">${priceText(item.oldPrice)}</s> <b style="color:var(--accent)">${priceText(item.price)}</b>`
      : priceText(item.price);
    row.innerHTML = `
      <div class="prod-thumb">${item.image ? `<img src="${esc(item.image)}" alt="" />` : (item.emoji || '🍽️')}</div>
      <div class="prod-info">
        <h4>${esc(item.name)}${item.available === false ? ' <span class="muted">(ناموجود)</span>' : ''}</h4>
        <div class="muted">${pricePart}${item.description ? ' · ' + esc(item.description) : ''}</div>
      </div>
      <div class="prod-actions">
        <input type="number" class="inline-price" value="${toDisplay(item.price)}" min="0" step="1000" aria-label="قیمت" title="ویرایش سریع قیمت (${curLabel()})" />
        <button class="btn small primary" data-save title="ذخیره قیمت">💾</button>
        <button class="btn small" data-edit>ویرایش</button>
        <button class="btn small danger" data-del>حذف</button>
      </div>`;
    const input = row.querySelector('.inline-price');
    const savePrice = async () => {
      const newPrice = fromInput(+input.value || 0);
      if (newPrice === item.price) return;
      const btn = row.querySelector('[data-save]'); btn.disabled = true;
      try {
        const res = await fetch('/api/menu/items/' + item.id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: newPrice }),
        });
        if (!res.ok) throw new Error();
        item.price = newPrice;
        toast('✅ قیمت «' + item.name + '» ذخیره شد');
      } catch (e) { toast('ذخیره نشد'); }
      finally { btn.disabled = false; }
    };
    row.querySelector('[data-save]').onclick = savePrice;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savePrice(); } });
    row.querySelector('[data-edit]').onclick = () => startEdit(item);
    row.querySelector('[data-del]').onclick = () => removeItem(item);
    return row;
  }

  // ---- فرم ----
  function resetForm() {
    editingId = null; pendingImage = null;
    $('#formTitle').textContent = '➕ افزودن محصول';
    $('#pName').value = ''; $('#pDesc').value = ''; $('#pPrice').value = '';
    $('#pOldPrice').value = '';
    $('#pNewCat').value = ''; $('#pNewCatIcon').value = ''; $('#newCatField').hidden = true;
    $('#pAvail').checked = true; $('#pImage').value = ''; $('#imgPreview').innerHTML = '';
    $('#pCat').selectedIndex = 0; $('#cancelEdit').hidden = true;
    $('#saveProduct').textContent = 'ذخیره محصول';
  }

  function startEdit(item) {
    editingId = item.id; pendingImage = null;
    $('#formTitle').textContent = '✏️ ویرایش: ' + item.name;
    $('#pName').value = item.name;
    $('#pDesc').value = item.description || '';
    $('#pPrice').value = toDisplay(item.price);
    $('#pOldPrice').value = item.oldPrice ? toDisplay(item.oldPrice) : '';
    $('#pAvail').checked = item.available !== false;
    $('#pCat').value = item.categoryId; $('#newCatField').hidden = true;
    $('#imgPreview').innerHTML = item.image ? `<img src="${esc(item.image)}" alt="" />` : '';
    $('#pImage').value = '';
    $('#cancelEdit').hidden = false;
    $('#saveProduct').textContent = 'ذخیره تغییرات';
    $('#productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#cancelEdit').onclick = resetForm;

  // انتخاب و کوچک‌سازی عکس قبل از ارسال
  $('#pImage').onchange = async () => {
    const file = $('#pImage').files[0];
    if (!file) return;
    try {
      pendingImage = await resizeImage(file, 800);
      $('#imgPreview').innerHTML = `<img src="${pendingImage}" alt="" />`;
    } catch (e) { toast('خطا در خواندن عکس'); }
  };

  function resizeImage(file, maxW) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  $('#saveProduct').onclick = async () => {
    const name = $('#pName').value.trim();
    if (!name) return toast('نام محصول را وارد کنید');
    const body = {
      name,
      description: $('#pDesc').value.trim(),
      price: fromInput(+$('#pPrice').value || 0),
      oldPrice: $('#pOldPrice').value ? fromInput(+$('#pOldPrice').value) : 0,
      available: $('#pAvail').checked,
    };
    if ($('#pCat').value === '__new__') {
      const nc = $('#pNewCat').value.trim();
      if (!nc) return toast('نام دسته‌ی جدید را وارد کنید');
      body.newCategory = nc;
      body.newCategoryIcon = $('#pNewCatIcon').value.trim() || '🍽️';
    } else {
      body.categoryId = $('#pCat').value;
    }
    if (pendingImage) body.image = pendingImage;

    const btn = $('#saveProduct');
    btn.disabled = true; btn.textContent = 'در حال ذخیره…';
    try {
      const url = editingId ? '/api/menu/items/' + editingId : '/api/menu/items';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ذخیره');
      toast(editingId ? '✅ محصول ویرایش شد' : '✅ محصول اضافه شد');
      menu = await fetch('/api/menu').then((r) => r.json());
      resetForm(); renderCatSelect(); renderList();
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = editingId ? 'ذخیره تغییرات' : 'ذخیره محصول';
    }
  };

  async function removeItem(item) {
    if (!confirm('حذف «' + item.name + '»؟')) return;
    try {
      const res = await fetch('/api/menu/items/' + item.id, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('🗑️ حذف شد');
      menu = await fetch('/api/menu').then((r) => r.json());
      if (editingId === item.id) resetForm();
      renderList();
    } catch (e) { toast('حذف ناموفق بود'); }
  }

  // به‌روزرسانی لحظه‌ای در صورت تغییر منو از جای دیگر
  try {
    const socket = io();
    socket.on('menu:updated', async () => {
      menu = await fetch('/api/menu').then((r) => r.json());
      renderCatList(); renderCatSelect(); renderList();
    });
  } catch (e) { /* اختیاری */ }

  load();
})();
