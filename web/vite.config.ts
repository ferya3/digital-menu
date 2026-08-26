import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// آدرس سرور Node در حالت توسعه (قابل تغییر با متغیر BACKEND)
const BACKEND = process.env.BACKEND || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: true,
    proxy: {
      // درخواست‌های API و سوکت به بک‌اند Node می‌روند
      "/api": { target: BACKEND, changeOrigin: true },
      "/images": { target: BACKEND, changeOrigin: true },
      "/socket.io": { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
});
