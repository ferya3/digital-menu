(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const frame = $('#mFrame');
  const title = $('#mTitle');
  const items = [...document.querySelectorAll('.m-item')];
  const body = document.body;
  const baseTitle = document.title;
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  // ---- نشان (badge) روی هر گزینه‌ی منو ----
  items.forEach((it) => {
    const b = document.createElement('span');
    b.className = 'm-badge'; b.hidden = true; b.dataset.count = '0';
    it.appendChild(b);
  });
  const badgeOf = (src) => { const it = items.find((x) => x.dataset.src === src); return it ? it.querySelector('.m-badge') : null; };
  function bump(src) {
    const b = badgeOf(src); if (!b) return;
    const n = (+b.dataset.count || 0) + 1;
    b.dataset.count = String(n); b.textContent = faNum(n); b.hidden = false;
  }
  function clearBadge(it) { const b = it.querySelector('.m-badge'); if (b) { b.dataset.count = '0'; b.hidden = true; } }
  const activeSrc = () => { const a = document.querySelector('.m-item.active'); return a ? a.dataset.src : ''; };

  // ---- جابه‌جایی بین بخش‌ها ----
  items.forEach((it) => {
    it.onclick = () => {
      items.forEach((x) => x.classList.remove('active'));
      it.classList.add('active');
      frame.src = it.dataset.src;
      title.textContent = it.dataset.title || it.textContent.trim();
      clearBadge(it);
      body.classList.remove('side-open');
    };
  });
  const logout = $('#mLogout');
  if (logout) logout.onclick = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.href = '/login';
  };
  const burger = $('#mBurger'); if (burger) burger.onclick = () => body.classList.toggle('side-open');
  const backdrop = $('#mBackdrop'); if (backdrop) backdrop.onclick = () => body.classList.remove('side-open');

  fetch('/api/settings').then((r) => r.json()).then((s) => { if (s.cafe && s.cafe.name) $('#mCafe').textContent = s.cafe.name; }).catch(() => {});

  // ---- توست ----
  function toast(msg) { const t = $('#mToast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 4500); }

  // ---- صدا ----
  let audioCtx = null;
  function unlockAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { /* ignore */ } }
  document.addEventListener('click', unlockAudio);
  function beep() {
    if (!$('#mSound').checked) return;
    try {
      unlockAudio(); if (!audioCtx) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      o.start(); o.stop(audioCtx.currentTime + 0.5);
    } catch (e) { /* ignore */ }
  }
  let titleTimer;
  function flashTitle(msg) { document.title = '🔴 ' + msg; clearTimeout(titleTimer); titleTimer = setTimeout(() => (document.title = baseTitle), 6000); }

  // اعلان فقط وقتی همان بخش باز نیست (وگرنه خودِ آن صفحه نشان می‌دهد)
  function notify(src, msg, flashMsg) {
    if (activeSrc() === src) return;
    bump(src); beep(); flashTitle(flashMsg || msg); toast(msg);
  }

  // ---- سوکت: اعلان از هر جای پنل ----
  const notifiedPending = new Set();
  try {
    const socket = io({ reconnection: true });
    socket.on('connect', () => socket.emit('join:staff'));
    socket.on('order:new', (o) => notify('/staff', '🧾 سفارش جدید — میز ' + faNum(o.table), 'سفارش جدید'));
    socket.on('request:new', (r) => notify('/requests', (r.type === 'invoice' ? '💵 درخواست صورتحساب' : '🙋 درخواست گارسون') + ' — میز ' + faNum(r.table), 'درخواست جدید'));
    socket.on('feedback:new', () => notify('/staff', '⭐ نظر جدید ثبت شد', 'نظر جدید'));
    socket.on('order:updated', (o) => {
      if (o.payStatus === 'pending' && !notifiedPending.has(o.id)) {
        notifiedPending.add(o.id);
        notify('/cashier', '💳 فیش پرداخت جدید — میز ' + faNum(o.table), 'فیش پرداخت');
      }
      if (o.payStatus === 'confirmed') notifiedPending.delete(o.id);
    });
  } catch (e) { /* socket در دسترس نیست */ }
})();
