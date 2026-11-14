This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Вход, регистрация и пароли

Вход проверяет пароль в базе Supabase, поэтому без серверных функций он не заработает.

1. Supabase → **SQL Editor** → New query.
2. Вставить [supabase/secure-users.sql](supabase/secure-users.sql) целиком и нажать **Run**.
3. В конце скрипт выведет таблицу проверки — все значения должны быть `true`.
4. Если вход всё равно отвечает `Could not find the function ... in the schema cache`,
   выполните ещё одну строку `notify pgrst, 'reload schema';` и подождите минуту.

`supabase/schema.sql` создаёт таблицы, `supabase/secure-users.sql` — функции
`login_user`, `register_user`, `reset_user_password`, `check_phone_registered`
и хранение паролей в bcrypt. Прямой доступ к `public.users` при этом закрыт.

Пока скрипт не выполнен, приложение показывает
«Сервер не настроен: выполните supabase/secure-users.sql в Supabase → SQL Editor».

## Отправка кодов на номер

Коды регистрации и сброса пароля отправляет серверный маршрут `POST /api/send-code`.
Порядок выбора канала:

1. `WHATSAPP_GATEWAY_URL` + `WHATSAPP_GATEWAY_SECRET` — свой WhatsApp-шлюз;
2. Twilio или Vonage — SMS;
3. без настроек — в режиме разработки код печатается в консоль, в production ответ `503`.

### WhatsApp-шлюз (`whatsapp-server/`)

Отдельный процесс, который держит сессию WhatsApp и отправляет сообщения.
На Vercel его запустить нельзя (нужны постоянный процесс и диск) — подойдёт VPS,
Render или Railway с постоянным диском.

```bash
cd whatsapp-server
npm install
WHATSAPP_API_SECRET=длинная-строка npm start
```

В консоли появится QR-код: откройте WhatsApp → Связанные устройства → Связать
устройство. Сессия сохраняется в `whatsapp-server/auth/` и переживает перезапуск.

Готовые варианты развёртывания (Render с постоянным диском, Railway, VPS с systemd)
описаны в [whatsapp-server/README.md](whatsapp-server/README.md); для Render в
корне лежит blueprint [render.yaml](render.yaml).

Затем укажите в окружении сайта (и в Vercel) адрес шлюза и тот же секрет:

```env
WHATSAPP_GATEWAY_URL=https://шлюз.example.com
WHATSAPP_GATEWAY_SECRET=длинная-строка
```

Проверка: `GET /health` отдаёт `{ ok, ready }`, а отправка требует заголовок
`x-api-secret` и тело `{ "phone": "996555000111", "code": "123456" }`.

Шлюз использует неофициальный протокол WhatsApp Web (Baileys): это бесплатно, но
номер может быть заблокирован, если писать незнакомым людям массово. Для
официальной схемы нужен WhatsApp Cloud API с шаблоном сообщения.

### SMS-провайдеры

Провайдер выбирается по переменным окружения:

**Twilio**

```env
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1............
```

**Vonage**

```env
VONAGE_API_KEY=...
VONAGE_API_SECRET=...
SMS_SENDER_ID=Jerdesh
```

Если ключей нет, в режиме разработки код печатается в консоль сервера, а в production
маршрут отвечает `503` — значит, провайдер не настроен.

Маршрут принимает номер с плюсом или без (`"+79991234567"` и `"996555000111"`),
проверяет формат и ограничивает отправку тремя запросами на номер в минуту.

## Админка

Панель доступна по адресу `/admin`. Прямой ссылки с сайта нет — адрес знают только
администраторы.

### Переменные окружения

Добавьте в Vercel → Project → Settings → Environment Variables (или в `.env.local`
локально) и перезапустите деплой:

```env
# Пароль для входа в /admin. Придумайте длинный (20+ символов).
ADMIN_PASSWORD=длинный-пароль
# Необязательно: отдельный ключ подписи cookie.
# Если не задан, используется ADMIN_PASSWORD — тогда смена пароля разлогинивает всех.
ADMIN_SESSION_SECRET=случайная-строка
# Обязательно: серверные операции обходят RLS
# (Supabase → Project Settings → API → service_role).
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

`SUPABASE_SERVICE_ROLE_KEY` — секрет: не добавляйте ему префикс `NEXT_PUBLIC_`,
не коммитьте и не выводите в браузер. Он используется только в `/api/admin/*`.

### Что внутри

- Вход по паролю: сессия хранится в подписанной httpOnly-cookie на 8 часов,
  подпись — HMAC-SHA256. Клиентский `localStorage` входа сюда не относится.
- Лимит попыток: 5 неудачных вводов пароля за 10 минут на IP.
- Счётчики объявлений, пользователей, сторис, комментариев и категорий;
  списки последних 100 записей.
- Удаление объявлений (комментарии уходят каскадом по внешнему ключу), сторис,
  комментариев и пользователей; добавление и удаление категорий
  (объявления при удалении категории остаются без неё).
- Пароли пользователей панель не запрашивает — только номер, id и дату регистрации.

Если `/admin` пишет, что не задан `SUPABASE_SERVICE_ROLE_KEY` — добавьте ключ
и сделайте redeploy: без него RLS не даст удалять записи.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
