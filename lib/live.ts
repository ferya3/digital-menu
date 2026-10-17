import "server-only";
import { EventEmitter } from "node:events";
import { currentTenant } from "@/lib/tenant-context";

/** رویدادِ زنده: فقط «چه چیزی عوض شد»؛ داده با یک درخواستِ جدا گرفته می‌شود */
export interface LiveEvent {
  type: "order" | "receipt" | "request" | "feedback";
  table?: string;
}

// باس رویداد داخل همین پروسه (pm2 یک پروسه اجرا می‌کند) — جایگزینِ Socket.IOِ نسخهٔ قبلی
const g = globalThis as unknown as { __liveBus?: EventEmitter };
const bus =
  g.__liveBus ??
  (g.__liveBus = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    return e;
  })());

// هر مجموعه کانالِ جدای خودش را دارد (رویدادِ یک کافه به پنلِ کافهٔ دیگر نمی‌رسد)
const channel = () => `ev:${currentTenant().slug}`;

export function publish(ev: LiveEvent) {
  bus.emit(channel(), ev);
}

/** پاسخ Server-Sent Events: هر تغییری که از فیلتر رد شود فوراً به مرورگر فرستاده می‌شود */
export function sseResponse(req: Request, filter: (ev: LiveEvent) => boolean): Response {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const ch = channel();
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const send = (s: string) => {
        try {
          ctrl.enqueue(enc.encode(s));
        } catch {
          cleanup();
        }
      };
      const onEv = (ev: LiveEvent) => {
        if (filter(ev)) send(`data: ${JSON.stringify(ev)}\n\n`);
      };
      bus.on(ch, onEv);
      // ضربان برای اینکه Nginx/اینترنتِ موبایل اتصال را نبندد
      const hb = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(hb);
        bus.off(ch, onEv);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          ctrl.close();
        } catch {}
      });
      send("retry: 2000\n\n: connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform: فشرده‌سازیِ Next رویدادها را نگه ندارد؛ X-Accel-Buffering: Nginx بافر نکند
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
