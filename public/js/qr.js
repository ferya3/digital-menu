(() => {
  'use strict';

  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

  function generate() {
    const count = Math.min(100, Math.max(1, parseInt(document.getElementById('count').value, 10) || 1));
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    for (let t = 1; t <= count; t++) {
      const card = document.createElement('div');
      card.className = 'qr-card';
      card.innerHTML = `
        <img src="/api/qr?table=${t}" alt="QR میز ${t}" loading="lazy" />
        <h3>میز ${faNum(t)}</h3>
        <p class="muted">برای دیدن منو اسکن کنید</p>`;
      grid.appendChild(card);
    }
  }

  document.getElementById('generate').onclick = generate;
  generate();
})();
