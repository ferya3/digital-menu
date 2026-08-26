(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const table = params.get('table');
  const orderId = params.get('order');

  const $ = (s) => document.querySelector(s);
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 2500);
  }

  // لینک بازگشت به منوی همان میز
  if (table) $('#backToMenu').href = '/?table=' + encodeURIComponent(table);

  $('#submitFb').onclick = async () => {
    const checked = document.querySelector('input[name="rate"]:checked');
    if (!checked) return toast('لطفاً امتیاز خود را انتخاب کنید');

    const btn = $('#submitFb');
    btn.disabled = true; btn.textContent = 'در حال ثبت…';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          orderId,
          rating: Number(checked.value),
          comment: $('#comment').value,
        }),
      });
      if (!res.ok) throw new Error('خطا در ثبت نظر');
      $('#formCard').hidden = true;
      $('#thanksCard').hidden = false;
    } catch (err) {
      toast(err.message);
      btn.disabled = false; btn.textContent = 'ثبت نظر';
    }
  };
})();
