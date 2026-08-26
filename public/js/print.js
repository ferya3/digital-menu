(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  const tableId = params.get('table'); // صورتحساب ترکیبی کل یک میز

  let currency = 'toman';
  let codeMode = 'number';
  const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const fmtCode = (o) => (codeMode === 'id' ? faNum(o.id) : '#' + faNum(o.number || 0));
  const price = (toman) => {
    const n = currency === 'rial' ? toman * 10 : toman;
    return faNum(Number(n).toLocaleString('en-US')) + ' ' + (currency === 'rial' ? 'ریال' : 'تومان');
  };
  const dateTime = (iso) => {
    const d = new Date(iso);
    try { return d.toLocaleDateString('fa-IR') + ' - ' + faNum(d.toLocaleTimeString('en-GB').slice(0, 5)); }
    catch (e) { return faNum(d.toLocaleTimeString('en-GB').slice(0, 5)); }
  };

  async function render() {
    if (!orderId && !tableId) { document.getElementById('receipt').textContent = 'سفارش مشخص نشده است.'; return; }

    let cafe = { name: 'کافه نمونه', logo: '☕' };
    let orderList = [];   // یک یا چند سفارش که این فاکتور را می‌سازند
    let table = '', paid = false;

    try {
      let settings = {};
      if (tableId) {
        // صورتحساب ترکیبی: همه‌ی سفارش‌های پرداخت‌نشده‌ی میز
        let bill;
        [bill, settings] = await Promise.all([
          fetch('/api/orders/table/' + encodeURIComponent(tableId) + '/bill').then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
          fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
        ]);
        orderList = bill.orders || [];
        table = bill.table;
      } else {
        let order;
        [order, settings] = await Promise.all([
          fetch('/api/orders/' + orderId).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
          fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
        ]);
        orderList = [order];
        table = order.table; paid = !!order.paid;
      }
      if (settings.cafe) cafe = settings.cafe;
      if (settings.currency) currency = settings.currency === 'rial' ? 'rial' : 'toman';
      if (settings.orderCode) codeMode = settings.orderCode === 'id' ? 'id' : 'number';
    } catch (e) {
      document.getElementById('receipt').textContent = 'یافت نشد.';
      return;
    }

    if (orderList.length === 0) { document.getElementById('receipt').textContent = 'صورتحساب بازی برای این میز وجود ندارد.'; return; }

    const logo = cafe.logo && !/^(https?:|\/)/.test(cafe.logo) ? cafe.logo : '☕';
    const grandTotal = orderList.reduce((s, o) => s + (o.total || 0), 0);
    const phone = (orderList.find((o) => o.phone) || {}).phone || '';
    const multi = orderList.length > 1;

    const body = orderList.map((o) => {
      const head = multi ? `<tr class="rc-suborder"><td colspan="3">${fmtCode(o)} · ${dateTime(o.createdAt)}</td></tr>` : '';
      const rows = o.items.map((it) => `
        <tr>
          <td>${it.name}</td>
          <td>${faNum(it.qty)}</td>
          <td>${price(it.price * it.qty)}</td>
        </tr>`).join('');
      return head + rows;
    }).join('');

    const meta = multi
      ? `<div class="rc-row"><span>تعداد سفارش</span><span>${faNum(orderList.length)}</span></div>`
      : `<div class="rc-row"><span>کد سفارش</span><span>${fmtCode(orderList[0])}</span></div>
         <div class="rc-row"><span>تاریخ</span><span>${dateTime(orderList[0].createdAt)}</span></div>`;

    document.getElementById('receipt').innerHTML = `
      <div class="rc-center">
        <div class="rc-logo">${logo}</div>
        <div class="rc-title">${cafe.name || 'کافه'}</div>
        <div class="rc-sub">فاکتور فروش</div>
      </div>
      <hr class="rc-hr" />
      <div class="rc-row"><span>میز</span><span>${faNum(table)}</span></div>
      ${meta}
      ${phone ? `<div class="rc-row"><span>موبایل</span><span>${faNum(phone)}</span></div>` : ''}
      <hr class="rc-hr" />
      <table class="rc-items">
        <thead><tr><th>کالا</th><th>تعداد</th><th>مبلغ</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <hr class="rc-hr" />
      <div class="rc-row rc-total"><span>جمع کل</span><span>${price(grandTotal)}</span></div>
      ${tableId ? '' : `<div class="rc-row"><span>وضعیت پرداخت</span><span>${paid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}</span></div>`}
      <div class="rc-foot">از خرید شما سپاسگزاریم 🙏<br/>${cafe.name || ''}</div>`;

    // چاپ خودکار هنگام باز شدن
    setTimeout(() => window.print(), 400);
  }

  render();
})();
