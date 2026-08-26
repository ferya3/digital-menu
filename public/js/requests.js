(() => {
  'use strict';

  let currency = 'toman';
  let codeMode = 'number';
  const $ = (s) => document.querySelector(s);
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const price = (toman) => {
    const n = currency === 'rial' ? toman * 10 : toman;
    return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان');
  };
  const time = (iso) => faNum(new Date(iso).toLocaleTimeString('en-GB').slice(0, 5));
  const dateTime = (iso) => {
    const d = new Date(iso);
    try { return d.toLocaleDateString('fa-IR') + ' · ' + faNum(d.toLocaleTimeString('en-GB').slice(0, 5)); }
    catch (e) { return time(iso); }
  };

  let requests = [];

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

  // ---- اتصال ----
  const showBanner = () => { const b = $('#netBanner'); if (b) b.hidden = false; };
  if (location.protocol === 'file:') { $('#connState').textContent = 'بدون اتصال (باز شده به‌صورت فایل)'; showBanner(); }
  let socket;
  try {
    socket = io({ reconnection: true });
    socket.on('connect', () => { socket.emit('join:staff'); $('#connState').textContent = 'متصل ●'; $('#netBanner').hidden = true; });
    socket.on('disconnect', () => ($('#connState').textContent = 'قطع شد ○ (تلاش مجدد…)'));
    socket.on('connect_error', () => { $('#connState').textContent = 'خطای اتصال'; showBanner(); });
  } catch (e) { $('#connState').textContent = 'سوکت در دسترس نیست'; showBanner(); }
  if (!socket) socket = { on() {}, emit() {} };

  let titleTimer;
  function flashTitle(msg) { document.title = '🔴 ' + msg; clearTimeout(titleTimer); titleTimer = setTimeout(() => (document.title = 'درخواست‌ها | کافه نمونه'), 4000); }
  function upsert(list, item) { const i = list.findIndex((x) => x.id === item.id); if (i >= 0) list[i] = item; else list.unshift(item); }

  socket.on('request:new', (r) => { requests.unshift(r); renderRequests(); beep(); flashTitle('درخواست جدید'); });
  socket.on('request:updated', (r) => { upsert(requests, r); renderRequests(); });

  function btn(text, cls, onclick) {
    const b = document.createElement('button');
    b.className = cls; b.textContent = text; b.onclick = onclick;
    return b;
  }

  function renderRequests() {
    const box = $('#requests');
    const pending = requests.filter((r) => r.status === 'pending');
    $('#reqCount').textContent = faNum(pending.length);
    if (requests.length === 0) { box.innerHTML = '<p class="empty">درخواستی وجود ندارد</p>'; return; }

    box.innerHTML = '';
    requests.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'req-card flash' + (r.status === 'done' ? ' done' : '');
      const billInfo = r.type === 'invoice' && r.amount != null
        ? ` · ${price(r.amount)}${r.orderCount > 1 ? ' (' + faNum(r.orderCount) + ' سفارش)' : ''}`
        : '';
      const label = r.type === 'waiter'
        ? '<span class="tag waiter">گارسون</span> درخواست گارسون'
        : `<span class="tag invoice">فاکتور</span> درخواست صورتحساب${billInfo}`;
      card.innerHTML = `
        <div class="order-head">
          <span class="table-badge">میز ${faNum(r.table)}</span>
          <span class="muted">${dateTime(r.createdAt)}</span>
        </div>
        <div style="margin:6px 0">${label}</div>
        ${r.note ? `<div class="req-note">📝 ${r.note}</div>` : ''}
        <div class="order-actions"></div>`;
      const acts = card.querySelector('.order-actions');
      if (r.type === 'invoice') {
        acts.appendChild(btn('🖨️ چاپ صورتحساب', 'btn small', () => window.open('/print?table=' + encodeURIComponent(r.table), '_blank')));
      }
      if (r.status === 'pending') {
        acts.appendChild(btn('✔ انجام شد', 'btn small primary', () => fetch('/api/requests/' + r.id, { method: 'PATCH' })));
      }
      box.appendChild(card);
    });
  }

  async function load() {
    const [r, s] = await Promise.all([
      fetch('/api/requests').then((x) => x.json()),
      fetch('/api/settings').then((x) => x.json()).catch(() => ({})),
    ]);
    requests = r;
    if (s && s.currency) currency = s.currency === 'rial' ? 'rial' : 'toman';
    if (s && s.orderCode) codeMode = s.orderCode === 'id' ? 'id' : 'number';
    renderRequests();
  }

  load().catch(() => { $('#connState').textContent = 'خطای بارگذاری'; showBanner(); });
})();
