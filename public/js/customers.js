(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const dateTime = (iso) => {
    const d = new Date(iso);
    try { return d.toLocaleDateString('fa-IR') + ' ' + faNum(d.toLocaleTimeString('en-GB').slice(0, 5)); }
    catch (e) { return iso; }
  };
  if (location.protocol === 'file:') $('#netBanner').hidden = false;

  async function load() {
    let rows = [];
    try {
      rows = await fetch('/api/customers').then((r) => r.json());
    } catch (e) { $('#netBanner').hidden = false; }
    $('#count').textContent = faNum(rows.length);
    const box = $('#list');
    if (!rows.length) { box.innerHTML = '<p class="empty">هنوز شماره‌ای ثبت نشده است</p>'; return; }
    box.innerHTML = `
      <table class="db">
        <thead><tr><th>#</th><th>شماره موبایل</th><th>میزها</th><th>دفعات</th><th>آخرین بازدید</th></tr></thead>
        <tbody>
          ${rows.map((c, i) => `
            <tr>
              <td>${faNum(i + 1)}</td>
              <td class="phone">${faNum(c.phone)}</td>
              <td>${(c.tables || []).map(faNum).join('، ') || '—'}</td>
              <td>${faNum(c.visits || 1)}</td>
              <td class="muted">${dateTime(c.lastSeen)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  load();
})();
