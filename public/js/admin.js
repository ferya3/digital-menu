(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3000);
  }
  const showBanner = () => ($('#netBanner').hidden = false);

  // لیست پیش‌فرض درگاه‌ها — تضمین می‌کند که همیشه نمایش داده شوند،
  // حتی اگر سرور در دسترس نباشد یا فهرست خالی برگرداند.
  const DEFAULT_GATEWAYS = [
    { id: 'zarinpal', name: 'زرین‌پال', enabled: false, config: { merchantId: '' } },
    { id: 'mellat', name: 'بانک ملت (به‌پرداخت ملت)', enabled: false, config: { terminalId: '', username: '', password: '' } },
    { id: 'melli', name: 'بانک ملی (سداد)', enabled: false, config: { merchantId: '', terminalId: '', key: '' } },
  ];

  const FIELD_LABELS = {
    merchantId: 'مرچنت‌کد / Merchant ID',
    terminalId: 'شماره ترمینال',
    username: 'نام کاربری',
    password: 'رمز عبور',
    key: 'کلید (Key)',
  };

  let settings = { cafe: { name: '', logo: '☕' }, payment: { link: '', card: '', holder: '', note: '' }, payments: [], sms: { provider: 'none', apiKey: '', template: 'verify' } };

  // ادغام درگاه‌های سرور با پیش‌فرض‌ها (هیچ درگاهی حذف یا گم نمی‌شود)
  function mergeGateways(serverList) {
    return DEFAULT_GATEWAYS.map((def) => {
      const found = (serverList || []).find((g) => g.id === def.id);
      if (!found) return JSON.parse(JSON.stringify(def));
      return {
        id: def.id,
        name: found.name || def.name,
        enabled: !!found.enabled,
        config: Object.assign({}, def.config, found.config || {}),
      };
    });
  }

  if (location.protocol === 'file:') showBanner();

  async function load() {
    try {
      const data = await fetch('/api/settings/admin').then((r) => {
        if (!r.ok) throw new Error('پاسخ نامعتبر سرور');
        return r.json();
      });
      settings.cafe = Object.assign({ name: '', logo: '☕', tagline: '', cover: '', address: '', mapUrl: '', instagram: '' }, data.cafe || {});
      settings.payments = mergeGateways(data.payments);
      settings.payment = Object.assign({ link: '', card: '', holder: '', note: '' }, data.payment || {});
      settings.orderCode = data.orderCode === 'id' ? 'id' : 'number';
      settings.auth = data.auth || {};
      settings.sms = Object.assign({ provider: 'none', apiKey: '', template: 'verify' }, data.sms || {});
    } catch (err) {
      // حتی بدون سرور، فرم را با مقادیر پیش‌فرض نشان می‌دهیم
      settings.payments = mergeGateways([]);
      showBanner();
    }
    $('#cafeName').value = settings.cafe.name || '';
    $('#cafeLogo').value = settings.cafe.logo || '';
    $('#cafeTagline').value = settings.cafe.tagline || '';
    $('#cafeAddress').value = settings.cafe.address || '';
    $('#cafeMapUrl').value = settings.cafe.mapUrl || '';
    $('#cafeInstagram').value = settings.cafe.instagram || '';
    $('#orderCode').value = settings.orderCode || 'number';
    const hasPass = settings.auth && settings.auth.hasPassword;
    $('#passState').textContent = hasPass ? '✅ رمز عبور سفارشی تنظیم شده است' : '⚠️ رمز عبور روی پیش‌فرض (cafe1234) است — حتماً تغییر دهید';
    $('#payLinkUrl').value = settings.payment.link || '';
    $('#payCard').value = settings.payment.card || '';
    $('#payHolder').value = settings.payment.holder || '';
    $('#payNote').value = settings.payment.note || '';
    $('#smsProvider').value = settings.sms.provider || 'none';
    $('#smsApiKey').value = settings.sms.apiKey || '';
    $('#smsTemplate').value = settings.sms.template || 'verify';
    renderCover();
    renderGateways();
  }

  // ---- مدیریت تصویر کاور هدر ----
  let pendingCover = null; // null = بدون تغییر، '' = حذف، dataURL = تصویر جدید
  function renderCover() {
    const cover = pendingCover !== null ? pendingCover : (settings.cafe.cover || '');
    $('#coverPreview').innerHTML = cover ? `<img src="${cover}" alt="کاور" />` : '';
    $('#removeCover').hidden = !cover;
  }
  $('#coverImage').onchange = async () => {
    const file = $('#coverImage').files[0];
    if (!file) return;
    try { pendingCover = await resizeImage(file, 1280); renderCover(); }
    catch (e) { toast('خطا در خواندن عکس'); }
  };
  $('#removeCover').onclick = () => { pendingCover = ''; $('#coverImage').value = ''; renderCover(); };

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
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  function renderGateways() {
    const box = $('#gateways');
    box.innerHTML = '';
    settings.payments.forEach((gw, idx) => {
      const card = document.createElement('div');
      card.className = 'gateway' + (gw.enabled ? ' on' : '');
      const fields = Object.keys(gw.config || {}).map((key) => `
        <div class="field">
          <label>${FIELD_LABELS[key] || key}</label>
          <input type="${key === 'password' ? 'password' : 'text'}"
                 data-gw="${idx}" data-key="${key}" value="${(gw.config[key] || '').replace(/"/g, '&quot;')}"
                 placeholder="${FIELD_LABELS[key] || key}" />
        </div>`).join('');
      card.innerHTML = `
        <div class="gateway-head">
          <strong>${gw.name}</strong>
          <label class="switch">
            <input type="checkbox" data-enable="${idx}" ${gw.enabled ? 'checked' : ''} /> فعال
          </label>
        </div>
        ${fields}`;
      // فعال/غیرفعال شدن ظاهری کارت
      card.querySelector('[data-enable]').addEventListener('change', (e) => {
        card.classList.toggle('on', e.target.checked);
      });
      box.appendChild(card);
    });
  }

  function collect() {
    settings.cafe.name = $('#cafeName').value.trim() || 'کافه';
    settings.cafe.logo = $('#cafeLogo').value.trim() || '☕';
    settings.cafe.tagline = $('#cafeTagline').value.trim();
    if (pendingCover !== null) settings.cafe.cover = pendingCover; // تصویر جدید یا حذف
    settings.cafe.address = $('#cafeAddress').value.trim();
    settings.cafe.mapUrl = $('#cafeMapUrl').value.trim();
    settings.cafe.instagram = $('#cafeInstagram').value.trim();
    settings.orderCode = $('#orderCode').value;
    settings.payment = {
      link: $('#payLinkUrl').value.trim(),
      card: $('#payCard').value.trim(),
      holder: $('#payHolder').value.trim(),
      note: $('#payNote').value.trim(),
    };
    settings.sms = {
      provider: $('#smsProvider').value,
      apiKey: $('#smsApiKey').value.trim(),
      template: $('#smsTemplate').value.trim() || 'verify',
    };
    document.querySelectorAll('[data-enable]').forEach((el) => {
      settings.payments[+el.dataset.enable].enabled = el.checked;
    });
    document.querySelectorAll('[data-key]').forEach((el) => {
      settings.payments[+el.dataset.gw].config[el.dataset.key] = el.value.trim();
    });
    // رمز عبور فقط اگر مقدار جدید وارد شده باشد
    const np = $('#adminPass').value;
    if (np) settings.auth = { password: np }; else delete settings.auth;
    return settings;
  }

  $('#saveBtn').onclick = async () => {
    const btn = $('#saveBtn');
    btn.disabled = true; btn.textContent = 'در حال ذخیره…';
    try {
      const res = await fetch('/api/settings/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect()),
      });
      if (!res.ok) throw new Error('سرور خطا داد (کد ' + res.status + ')');
      const saved = await res.json().catch(() => null);
      if (saved && saved.cafe) settings.cafe = saved.cafe; // مسیر نهایی کاور از سرور
      pendingCover = null; $('#coverImage').value = ''; renderCover();
      if ($('#adminPass').value) {
        $('#adminPass').value = '';
        if (saved && saved.auth) $('#passState').textContent = saved.auth.hasPassword ? '✅ رمز عبور سفارشی تنظیم شده است' : '';
      }
      toast('✅ تنظیمات با موفقیت ذخیره شد');
    } catch (err) {
      showBanner();
      toast('❌ ذخیره نشد: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'ذخیره تنظیمات';
    }
  };

  load();
})();
