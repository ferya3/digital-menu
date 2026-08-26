#!/bin/bash
# برای مک: روی این فایل دوبار کلیک کنید (در صورت نیاز ابتدا اجرا: chmod +x start.command)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js نصب نیست. لطفاً از https://nodejs.org نسخه LTS را نصب کنید."
  read -r -p "برای بستن Enter بزنید..." _
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d node_modules/jimp ]; then
  echo "در حال نصب وابستگی‌ها برای بار اول... چند دقیقه صبر کنید."
  npm install
fi

echo "در حال اجرا... مرورگر خودکار باز می‌شود. برای توقف Ctrl+C."
npm start
