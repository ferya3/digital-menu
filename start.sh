#!/bin/bash
# برای لینوکس: اجرا با  bash start.sh  یا پس از chmod +x دوبار کلیک
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js نصب نیست. ابتدا Node.js (نسخه ۱۸ به بالا) را نصب کنید."
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d node_modules/jimp ]; then
  echo "در حال نصب وابستگی‌ها برای بار اول..."
  npm install
fi

echo "در حال اجرا... برای توقف Ctrl+C."
npm start
