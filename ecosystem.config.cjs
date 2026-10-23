// pm2 config: runs the site in the background and restarts it after a crash/reboot.
// Internal port via APP_PORT (default 3000); Nginx proxies requests to it.
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
