// پیکربندی pm2: سایت را در پس‌زمینه اجرا و در صورت کرش/ری‌بوت دوباره بالا می‌آورد.
// پورت داخلی با APP_PORT (پیش‌فرض 3000)؛ Nginx درخواست‌ها را به آن می‌فرستد.
const port = process.env.APP_PORT || "3000";

module.exports = {
  apps: [
    {
      name: "cafe",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port} -H 127.0.0.1`,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
