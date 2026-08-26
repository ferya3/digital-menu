import App from "./App";
import StaffApp from "./StaffApp";

/**
 * مسیریابیِ سبک بدون کتابخانه: اگر آدرس به /staff (یا /manager /cashier) ختم شود
 * یا هش شامل staff باشد، پنل کارکنان باز می‌شود؛ وگرنه اپِ مشتری.
 */
function wantsStaff(): boolean {
  try {
    const p = window.location.pathname.replace(/\/+$/, "");
    if (/\/(staff|manager|cashier|kitchen)$/.test(p)) return true;
    const h = window.location.hash.replace(/^#\/?/, "");
    return h.startsWith("staff") || h.startsWith("manager") || h.startsWith("cashier");
  } catch {
    return false;
  }
}

export default function Root() {
  return wantsStaff() ? <StaffApp /> : <App />;
}
