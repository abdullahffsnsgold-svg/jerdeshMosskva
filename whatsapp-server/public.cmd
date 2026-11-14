@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Публичный адрес WhatsApp-шлюза для сайта на Vercel.
rem Пока это окно открыто — сайт может отправлять коды.
rem При каждом запуске туннель получает новый адрес https://...trycloudflare.com,
rem поэтому после перезапуска скопируйте новый адрес в Vercel
rem (WHATSAPP_GATEWAY_URL) и нажмите Redeploy.

netstat -ano | findstr ":5001 " | findstr LISTENING >nul
if errorlevel 1 (
  echo Запускаю WhatsApp-шлюз на порту 5001...
  start "WhatsApp-шлюз" /min cmd /c "node index.js"
  timeout /t 15 /nobreak >nul
) else (
  echo Шлюз уже запущен на порту 5001.
)

if not exist ".bin" mkdir ".bin"
if not exist ".bin\cloudflared.exe" (
  echo Скачиваю cloudflared 53 МБ, один раз...
  curl -sL -o ".bin\cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

echo.
echo Открываю туннель. Скопируйте адрес вида https://xxxx.trycloudflare.com
echo и вставьте его в Vercel как WHATSAPP_GATEWAY_URL, затем сделайте Redeploy.
echo Закрывать это окно нельзя.
echo.

".bin\cloudflared.exe" tunnel --url http://localhost:5001 --no-autoupdate
