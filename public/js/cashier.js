(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const time = (iso) => { const d = new Date(iso); try { return d.toLocaleDateString('fa-IR') + ' ' + faNum(d.toLocaleTimeString('en-GB').slice(0, 5)); } catch (e) { return ''; } };
  let currency = 'toman', codeMode = 'number';
  const price = (t) => { const n = currency === 'rial' ? t * 10 : t; return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان'); };
  const fmtCode = (o) => (codeMode === 'id' ? faNum(o.id) : '#' + faNum(o.number || 0));
  const showBanner = () => ($('#netBanner').hidden = false);

  let orders = [];
  let socket;
  try {
    socket = io({ reconnection: true });
    socket.on('connect', () => { socket.emit('join:staff'); $('#connState').textContent = 'متصل ●'; $('#netBanner').hidden = true; });
    socket.on('disconnect', () => ($('#connState').textContent = 'قطع شد ○'));
    socket.on('connect_error', () => { $('#connState').textContent = 'خطا'; showBanner(); });
    socket.on('order:new', (o) => { upsert(o); render(); });
    socket.on('order:updated', (o) => { upsert(o); render(); });
  } catch (e) { showBanner(); }
  if (location.protocol === 'file:') showBanner();

  function upsert(o) { const i = orders.findIndex((x) => x.id === o.id); if (i >= 0) orders[i] = o; else orders.unshift(o); }

  async function load() {
    try {
      const [os, s] = await Promise.all([
        fetch('/api/orders').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
      ]);
      orders = os;
      if (s.currency) currency = s.currency === 'rial' ? 'rial' : 'toman';
      if (s.orderCode) codeMode = s.orderCode === 'id' ? 'id' : 'number';
    } catch (e) { showBanner(); }
    render();
  }

  // گروه‌بندی سفارش‌ها بر اساس میز → [{ table, orders, total, receipt, phone }]
  function groupByTable(list) {
    const map = new Map();
    list.forEach((o) => {
      const t = String(o.table);
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(o);
    });
    return [...map.entries()].map(([table, os]) => ({
      table,
      orders: os.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
      total: os.reduce((s, o) => s + (o.total || 0), 0),
      receipt: (os.find((o) => o.receipt) || {}).receipt || '',
      phone: (os.find((o) => o.phone) || {}).phone || '',
      reused: os.some((o) => o.receiptReused), // فیش (تصویر) تکراری/استفاده‌مجدد
      lastAt: os.reduce((m, o) => Math.max(m, +new Date(o.receiptAt || o.createdAt)), 0),
    }));
  }

  // هر کارت = یک میز = کل صورتحساب (همه‌ی سفارش‌ها) که با هم تأیید می‌شوند
  function billCard(group, pending) {
    const el = document.createElement('div');
    el.className = 'order-card ' + (pending ? 's-new' : 's-served');
    const rows = group.orders.map((o) =>
      `<li><span>${fmtCode(o)} · ${time(o.receiptAt || o.createdAt)}</span><span>${price(o.total)}</span></li>`
    ).join('');
    el.innerHTML = `
      <div class="order-head">
        <span class="table-badge">میز ${faNum(group.table)}</span>
        <span class="muted">${faNum(group.orders.length)} سفارش</span>
      </div>
      <ul class="order-items">${rows}</ul>
      <div class="cart-foot"><span>جمع بدهی</span><strong>${price(group.total)}</strong></div>
      ${group.phone ? `<div class="muted">📱 ${faNum(group.phone)}</div>` : ''}
      ${group.reused ? '<div class="reused-warn">⚠️ این تصویر قبلاً استفاده شده — احتمالاً اسکرین‌شات تکراری است. با دقت بررسی کنید.</div>' : ''}
      ${group.receipt ? `<a href="${group.receipt}" target="_blank" rel="noopener"><img src="${group.receipt}" class="receipt-thumb" alt="فیش پرداخت" /></a>` : '<div class="muted">بدون فیش</div>'}
      <div class="order-actions"></div>`;
    const actions = el.querySelector('.order-actions');
    if (pending) {
      const b = document.createElement('button');
      b.className = 'btn small primary'; b.textContent = '✅ تأیید پرداخت';
      b.onclick = () => confirmBill(group, b);
      actions.appendChild(b);
      const rj = document.createElement('button');
      rj.className = 'btn small danger'; rj.textContent = '✖ عدم تأیید';
      rj.onclick = () => rejectBill(group, rj);
      actions.appendChild(rj);
    } else {
      actions.innerHTML = '<span class="muted">پرداخت تأیید شد ✅</span>';
    }
    const p = document.createElement('button');
    p.className = 'btn small'; p.textContent = '🖨️ چاپ صورتحساب';
    p.onclick = () => window.open('/print?table=' + encodeURIComponent(group.table), '_blank');
    actions.appendChild(p);
    return el;
  }

  function render() {
    const pend = groupByTable(orders.filter((o) => o.payStatus === 'pending'))
      .sort((a, b) => b.lastAt - a.lastAt);
    const conf = groupByTable(orders.filter((o) => o.payStatus === 'confirmed'))
      .sort((a, b) => b.lastAt - a.lastAt);
    $('#pendCount').textContent = faNum(pend.length);
    const pb = $('#pending'); pb.innerHTML = '';
    if (!pend.length) pb.innerHTML = '<p class="empty">پرداختی در انتظار نیست</p>';
    pend.forEach((g) => pb.appendChild(billCard(g, true)));
    const cb = $('#confirmed'); cb.innerHTML = '';
    if (!conf.length) cb.innerHTML = '<p class="empty">—</p>';
    conf.forEach((g) => cb.appendChild(billCard(g, false)));
  }

  // تأیید پرداخت کل صورتحساب یک میز: همه‌ی سفارش‌های آن به‌صورت پرداخت‌شده علامت می‌خورند
  async function confirmBill(group, btn) {
    btn.disabled = true; btn.textContent = 'در حال تأیید…';
    try {
      await Promise.all(group.orders.map((o) => fetch('/api/orders/' + o.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payStatus: 'confirmed' }),
      })));
    } catch (e) { btn.disabled = false; btn.textContent = '✅ تأیید پرداخت'; }
  }

  // عدم تأیید فیشِ کل صورتحساب میز: به مشتری اطلاع داده می‌شود تا دوباره پرداخت کند
  async function rejectBill(group, btn) {
    const reason = prompt('دلیل عدم تأیید (اختیاری، به مشتری نشان داده می‌شود):', '');
    if (reason === null) return; // لغو شد
    btn.disabled = true; btn.textContent = 'در حال رد…';
    try {
      await Promise.all(group.orders.map((o) => fetch('/api/orders/' + o.id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payStatus: 'rejected', reason }),
      })));
    } catch (e) { btn.disabled = false; btn.textContent = '✖ عدم تأیید'; }
  }

  load();
})();
