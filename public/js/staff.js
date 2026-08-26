(() => {
  'use strict';

  let currency = 'toman';
  let codeMode = 'number';
  const $ = (s) => document.querySelector(s);
  const fmtCode = (o) => (codeMode === 'id' ? faNum(o.id) : '#' + faNum(o.number || 0));
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const price = (toman) => {
    const n = currency === 'rial' ? toman * 10 : toman;
    return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان');
  };
  const time = (iso) => faNum(new Date(iso).toLocaleTimeString('en-GB').slice(0, 5));
  // تاریخ شمسی + ساعت (مثلاً ۱۴۰۵/۰۳/۲۶، ۱۹:۳۰)
  const dateTime = (iso) => {
    const d = new Date(iso);
    try {
      return d.toLocaleDateString('fa-IR') + ' · ' + faNum(d.toLocaleTimeString('en-GB').slice(0, 5));
    } catch (e) {
      return time(iso);
    }
  };

  let orders = [];
  let feedback = [];

  // ---- صدای اعلان ----
  function beep() {
    if (!$('#soundToggle').checked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* ignore */ }
  }

  // ---- اتصال (با مدیریت خطا) ----
  const showBanner = () => { const b = $('#netBanner'); if (b) b.hidden = false; };
  if (location.protocol === 'file:') {
    $('#connState').textContent = 'بدون اتصال (فایل مستقیم)';
    showBanner();
  }
  let socket;
  try {
    socket = io({ reconnection: true });
    socket.on('connect', () => {
      socket.emit('join:staff');
      $('#connState').textContent = 'متصل ●';
      $('#netBanner').hidden = true;
    });
    socket.on('disconnect', () => ($('#connState').textContent = 'قطع شد ○ (تلاش مجدد…)'));
    socket.on('connect_error', () => { $('#connState').textContent = 'خطا در اتصال'; showBanner(); });
  } catch (e) {
    $('#connState').textContent = 'سوکت در دسترس نیست';
    showBanner();
  }
  if (!socket) socket = { on() {}, emit() {} };

  socket.on('order:new', (o) => { orders.unshift(o); renderOrders(); beep(); flashTitle('سفارش جدید'); });
  socket.on('order:updated', (o) => { upsert(orders, o); renderOrders(); });
  socket.on('feedback:new', (f) => { feedback.unshift(f); renderFeedback(); });

  function upsert(list, item) {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item; else list.unshift(item);
  }

  let titleTimer;
  function flashTitle(msg) {
    document.title = '🔴 ' + msg;
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => (document.title = 'داشبورد کارکنان | کافه نمونه'), 4000);
  }

  // ---- بارگذاری اولیه ----
  async function loadAll() {
    const [o, f, s] = await Promise.all([
      fetch('/api/orders').then((x) => x.json()),
      fetch('/api/feedback').then((x) => x.json()),
      fetch('/api/settings').then((x) => x.json()).catch(() => ({})),
    ]);
    orders = o; feedback = f;
    if (s && s.currency) currency = s.currency === 'rial' ? 'rial' : 'toman';
    if (s && s.orderCode) codeMode = s.orderCode === 'id' ? 'id' : 'number';
    renderOrders(); renderFeedback();
  }

  // ---- رندر سفارش‌ها ----
  const STATUS_FA = { new: 'جدید', preparing: 'در حال آماده‌سازی', ready: 'آماده', served: 'سرو شد', cancelled: 'لغو شد' };
  const NEXT = { new: 'preparing', preparing: 'ready', ready: 'served' };
  const NEXT_FA = { new: 'شروع آماده‌سازی', preparing: 'آماده شد', ready: 'سرو شد' };

  function renderOrders() {
    const box = $('#orders');
    const active = orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
    $('#ordersCount').textContent = faNum(active.length);
    if (orders.length === 0) { box.innerHTML = '<p class="empty">سفارشی ثبت نشده است</p>'; return; }

    box.innerHTML = '';
    orders.forEach((o) => {
      const card = document.createElement('div');
      card.className = `order-card s-${o.status} flash`;
      const lines = o.items.map((it) => `<li><span>${it.name} × ${faNum(it.qty)}</span><span>${price(it.price * it.qty)}</span></li>`).join('');
      card.innerHTML = `
        <div class="order-head">
          <span class="table-badge">میز ${faNum(o.table)} · ${fmtCode(o)}</span>
          <span class="muted">${time(o.createdAt)} · ${STATUS_FA[o.status]}${o.paid ? ' · پرداخت‌شده' : (o.payStatus === 'pending' ? ' · فیش در انتظار تأیید' : '')}</span>
        </div>
        <ul class="order-items">${lines}</ul>
        ${o.note ? `<div class="muted">یادداشت: ${o.note}</div>` : ''}
        ${o.phone ? `<div class="muted">📱 ${faNum(o.phone)}</div>` : ''}
        ${o.receipt ? `<a href="${o.receipt}" target="_blank" rel="noopener" class="receipt-link">🧾 مشاهده فیش پرداخت</a>` : ''}
        <div class="cart-foot"><span>جمع</span><strong>${price(o.total)}</strong></div>
        <div class="order-actions"></div>`;
      const actions = card.querySelector('.order-actions');
      if (NEXT[o.status]) {
        actions.appendChild(btn(NEXT_FA[o.status], 'btn small primary', () => setStatus(o.id, NEXT[o.status])));
      }
      if (!o.paid && o.status !== 'cancelled') {
        actions.appendChild(btn('💳 پرداخت شد', 'btn small', () => setStatus(o.id, null, true)));
      }
      if (o.status !== 'served' && o.status !== 'cancelled') {
        actions.appendChild(btn('لغو', 'btn small danger', () => setStatus(o.id, 'cancelled')));
      }
      actions.appendChild(btn('🖨️ چاپ فاکتور', 'btn small', () => window.open('/print?order=' + o.id, '_blank')));
      box.appendChild(card);
    });
  }

  function btn(text, cls, onclick) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; b.onclick = onclick;
    return b;
  }

  async function setStatus(id, status, paid) {
    const body = {};
    if (status) body.status = status;
    if (typeof paid === 'boolean') body.paid = paid;
    await fetch('/api/orders/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // ---- رندر نظرها ----
  function renderFeedback() {
    const box = $('#feedback');
    $('#fbCount').textContent = faNum(feedback.length);
    if (feedback.length === 0) { box.innerHTML = '<p class="empty">نظری ثبت نشده است</p>'; return; }
    box.innerHTML = '';
    feedback.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'fb-card';
      const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
      card.innerHTML = `
        <div class="order-head">
          <span style="color:var(--accent);font-size:1.1rem">${stars}</span>
          <span class="muted">${f.table ? 'میز ' + faNum(f.table) + ' · ' : ''}${time(f.createdAt)}</span>
        </div>
        ${f.comment ? `<div style="margin-top:6px">${f.comment}</div>` : '<div class="muted">بدون توضیح</div>'}`;
      box.appendChild(card);
    });
  }

  loadAll().catch(() => { $('#connState').textContent = 'خطا در بارگذاری'; showBanner(); });
})();
