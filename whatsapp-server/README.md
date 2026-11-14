# WhatsApp-шлюз Jerdesh

Отдельный процесс: подключается к WhatsApp по QR-коду и отправляет коды
подтверждения по запросу сайта.

- `GET /health` → `{ ok, ready, hasSocket, lastQrAt }`
- `POST /api/send-code` → нужен заголовок `x-api-secret`,
  тело `{ "phone": "996555000111", "code": "123456" }`

`ready: true` в `/health` означает, что телефон привязан и сообщения отправляются.

---

## Render (постоянный диск, проще всего)

В корне репозитория лежит `render.yaml` — Render сам создаст сервис, переменные
и диск.

1. В Render: **New → Blueprint**, выберите репозиторий GitHub.
2. Render прочитает `render.yaml` и попросит значение для `WHATSAPP_API_SECRET`.
   Введите длинную случайную строку, например `jerdesh-wa-2026-7f3c9a`.
3. Нажмите **Apply**. Дождитесь статуса **Live**.
4. Откройте вкладку **Logs**. Там будет QR-код:

   ```
   Откройте WhatsApp → Настройки → Связанные устройства → Связать устройство
   ██▀▀▀▀▀██ ...
   ```

   QR обновляется сам примерно каждые 20 секунд — сканируйте текущий.
5. После привязки в логах появится `WhatsApp подключён`, а
   `https://<имя-сервиса>.onrender.com/health` вернёт `"ready":true`.

Важно: постоянный диск (`disk` в blueprint) доступен на платных планах Render —
бесплатный инстанс после сна и передеплоя потребует новый QR.

## Railway

1. **New Project → Deploy from GitHub repo**, выберите репозиторий.
2. В настройках сервиса: **Root Directory** = `whatsapp-server`
   (Railway найдёт `Dockerfile` и соберёт контейнер).
3. **Variables**: `WHATSAPP_API_SECRET=длинная-строка`,
   `WHATSAPP_SESSION_DIR=/data/auth`.
4. **Volumes**: создайте том и смонтируйте в `/data`.
5. **Settings → Networking → Generate Domain** — получите адрес вида
   `https://jerdesh-whatsapp.up.railway.app`.
6. Откройте **Deploy Logs**, отсканируйте QR.

## VPS (Ubuntu)

```bash
sudo apt install -y nodejs npm
git clone <репозиторий> jerdesh && cd jerdesh/whatsapp-server
npm ci --omit=dev

sudo mkdir -p /var/data/auth
sudo chown -R $USER /var/data

WHATSAPP_API_SECRET=длинная-строка \
WHATSAPP_SESSION_DIR=/var/data/auth \
PORT=5001 node index.js
```

Чтобы процесс жил постоянно — systemd (`/etc/systemd/system/jerdesh-wa.service`):

```ini
[Unit]
Description=Jerdesh WhatsApp gateway
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/jerdesh/whatsapp-server
Environment=WHATSAPP_API_SECRET=длинная-строка
Environment=WHATSAPP_SESSION_DIR=/var/data/auth
Environment=PORT=5001
ExecStart=/usr/bin/node index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now jerdesh-wa
journalctl -u jerdesh-wa -f   # здесь появится QR
```

Публичный HTTPS — через Nginx/Caddy с доменом или туннель
`cloudflared tunnel --url http://localhost:5001` (быстро, но адрес временный).

---

## Подключение к сайту

После того как шлюз отвечает по HTTPS и `ready:true`, в Vercel:
**Settings → Environment Variables**

```env
WHATSAPP_GATEWAY_URL=https://<адрес-шлюза>
WHATSAPP_GATEWAY_SECRET=<тот же WHATSAPP_API_SECRET>
```

Затем **Redeploy**. Сайт сам начнёт отправлять коды через WhatsApp
(в `/api/send-code` этот канал имеет приоритет над SMS).

Локальная проверка вместо Vercel — в `project/.env.local`:

```env
WHATSAPP_GATEWAY_URL=http://localhost:5001
WHATSAPP_GATEWAY_SECRET=<тот же секрет>
```

## Быстрая диагностика, если «не работает»

Шлюз — отдельный процесс. На Vercel он жить не может: там нет постоянного
процесса и диска, поэтому хостинг обязателен (Render/Railway/VPS).

Проверка по шагам:

```bash
# 1. шлюз жив и WhatsApp привязан
curl -s https://<адрес-шлюза>/health
#    ожидаем: {"ok":true,"ready":true,...}

# 2. секрет совпадает с WHATSAPP_GATEWAY_SECRET на сайте
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<адрес-шлюза>/api/send-code \
  -H 'content-type: application/json' -H 'x-api-secret: неверный' -d '{}'
#    ожидаем: 401
```

Если сайт отвечает `503 provider_not_configured` — на Vercel не заданы
`WHATSAPP_GATEWAY_URL` и `WHATSAPP_GATEWAY_SECRET` (или не сделан Redeploy).
Если `502` — адрес шлюза не отвечает или секрет не совпал.

Секрет обязателен: без `WHATSAPP_API_SECRET` процесс теперь завершается с ошибкой,
а не запускается с общим паролем по умолчанию.

## Если что-то не так

| Симптом | Причина |
|---|---|
| `/health` → `ready:false`, в логах нет QR | шлюз не может достучаться до WhatsApp — проверьте сеть и перезапустите |
| В логах `Устройство отключено` | номер вышел из связанных устройств: удалите папку сессии и отсканируйте QR заново |
| Сайт отвечает `502` с текстом про QR | шлюз жив, но WhatsApp не привязан |
| `401 unauthorized` | `WHATSAPP_GATEWAY_SECRET` на сайте не совпадает с `WHATSAPP_API_SECRET` на шлюзе |

Шлюз использует неофициальный протокол WhatsApp Web (Baileys). Он бесплатный,
но за массовые рассылки незнакомым номерам WhatsApp может заблокировать номер.
