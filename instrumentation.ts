/** کارهای زمان‌بندی‌شدهٔ سرور: یادآوریِ پیامکیِ تمدیدِ اشتراک (هر ساعت، فقط در حالتِ پلتفرم) */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.ROOT_DOMAIN) return;
  const g = globalThis as unknown as { __reminderTimer?: NodeJS.Timeout };
  if (g.__reminderTimer) return;
  const run = async () => {
    try {
      const { runReminders } = await import("@/lib/platform-admin");
      await runReminders();
    } catch (e) {
      console.error("[reminders]", e);
    }
  };
  setTimeout(run, 60_000);
  g.__reminderTimer = setInterval(run, 3600_000);
}
