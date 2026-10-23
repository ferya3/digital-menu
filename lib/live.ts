import "server-only";
import { EventEmitter } from "node:events";
import { currentTenant } from "@/lib/tenant-context";

/** Live event: only "what changed"; the data is fetched with a separate request */
export interface LiveEvent {
  type: "order" | "receipt" | "request" | "feedback";
  table?: string;
}

// In-process event bus (pm2 runs a single process) — replaces the earlier Socket.IO
const g = globalThis as unknown as { __liveBus?: EventEmitter };
const bus =
  g.__liveBus ??
  (g.__liveBus = (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    return e;
  })());

// Each venue has its own channel (one venue's events never reach another venue's panel)
const channel = () => `ev:${currentTenant().slug}`;

export function publish(ev: LiveEvent) {
  bus.emit(channel(), ev);
}

/** Server-Sent Events response: every change that passes the filter is pushed to the browser immediately */
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
      // Heartbeat so Nginx/mobile networks don't drop the connection
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
      // no-transform: keep Next compression from holding events; X-Accel-Buffering: no Nginx buffering
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
