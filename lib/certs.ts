import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * HTTPS certificate for a new subdomain/custom domain (Let's Encrypt via tenant-cert.sh).
 * Only active when set-saas.sh has been run on the server (AUTO_SSL=1); otherwise a no-op.
 */
const inflight = new Map<string, Promise<boolean>>();

export function certExists(host: string) {
  return fs.existsSync(path.join("/etc/nginx/tenant-certs", host, "fullchain.pem"));
}

export function ensureCert(host: string, timeoutMs = 90_000): Promise<boolean> {
  if (process.env.AUTO_SSL !== "1" || !/^[a-z0-9.-]+$/.test(host)) return Promise.resolve(false);
  if (certExists(host)) return Promise.resolve(true);
  const cur = inflight.get(host);
  if (cur) return cur;
  const script = path.join(process.cwd(), "tenant-cert.sh");
  const p = new Promise<boolean>((resolve) => {
    if (!fs.existsSync(script)) return resolve(false);
    const child = spawn("bash", [script, host], { stdio: "ignore" });
    const timer = setTimeout(() => resolve(certExists(host)), timeoutMs);
    child.on("error", () => { clearTimeout(timer); resolve(false); });
    child.on("exit", (code) => { clearTimeout(timer); resolve(code === 0 && certExists(host)); });
  }).finally(() => inflight.delete(host));
  inflight.set(host, p);
  return p;
}
