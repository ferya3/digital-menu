@echo off
chcp 65001 >nul
title Cafe Digital Menu
cd /d "%~dp0"

echo ============================================
echo    Cafe Digital Menu  -  منوی دیجیتال کافه
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is NOT installed.
  echo     Node.js نصب نیست. لطفا از سایت زیر نسخه LTS را نصب کنید:
  echo     https://nodejs.org
  echo.
  pause
  exit /b
)

if not exist "node_modules\jimp" (
  echo Installing dependencies for the first time, please wait...
  echo در حال نصب وابستگی ها برای بار اول... چند دقیقه صبر کنید.
  echo.
  call npm install
  echo.
)

echo Starting... a browser window will open automatically.
echo در حال اجرا... مرورگر خودکار باز می شود.
echo.
echo  Customer menu : http://localhost:3000/?table=1
echo  Manager panel : http://localhost:3000/manager  ^(all-in-one^)
echo.
echo  * Keep this window open. To stop, close it or press Ctrl+C.
echo  * این پنجره را باز نگه دارید. برای توقف، ببندیدش.
echo.

call npm start

echo.
echo Server stopped.
pause
