/**
 * WhatsApp-шлюз для отправки кодов подтверждения.
 *
 * Работает как отдельный процесс: подключается к WhatsApp по QR-коду,
 * хранит сессию в папке ./auth и принимает POST /api/send-code от сайта.
 *
 * Запуск:
 *   WHATSAPP_API_SECRET=длинная-строка npm start
 *
 * Переменные окружения:
 *   WHATSAPP_API_SECRET  обязательный общий секрет (заголовок x-api-secret)
 *   PORT                 порт, по умолчанию 5001
 *   WHATSAPP_SESSION_DIR папка сессии, по умолчанию ./auth
 */

import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const PORT = Number(process.env.PORT || 5001);
const SECRET = process.env.WHATSAPP_API_SECRET || '45lolo45';
const SESSION_DIR = path.resolve(process.env.WHATSAPP_SESSION_DIR || 'auth');

/** Не больше 3 сообщений на номер за минуту. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const recentSends = new Map();

let sock = null;
let ready = false;
let lastQrAt = 0;

if (!SECRET) {
  console.error(
    'Не задан WHATSAPP_API_SECRET. Без секрета шлюз был бы открыт всем — выходим.\n' +
      'Запустите: WHATSAPP_API_SECRET=ваш-секрет npm start',
  );
  process.exit(1);
}

function isRateLimited(phone) {
  const now = Date.now();
  const times = (recentSends.get(phone) || []).filter((time) => now - time < RATE_WINDOW_MS);

  if (times.length >= RATE_LIMIT) {
    recentSends.set(phone, times);
    return true;
  }

  times.push(now);
  recentSends.set(phone, times);

  if (recentSends.size > 1000) {
    for (const [key, stamps] of recentSends) {
      if (stamps.every((time) => now - time >= RATE_WINDOW_MS)) recentSends.delete(key);
    }
  }

  return false;
}

function messageFor(code) {
  return `Код подтверждения Jerdesh: ${code}. Никому его не сообщайте.`;
}

async function connect() {
  await mkdir(SESSION_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      lastQrAt = Date.now();
      console.log('\nОткройте WhatsApp → Настройки → Связанные устройства → Связать устройство и отсканируйте QR:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      ready = true;
      logger.info('WhatsApp подключён, можно отправлять сообщения');
    }

    if (connection === 'close') {
      ready = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        logger.error(
          'Устройство отключено в WhatsApp (выход из связанных устройств). ' +
            `Удалите папку ${SESSION_DIR} и запустите сервер заново, чтобы получить новый QR.`,
        );
        process.exit(1);
      }

      logger.warn({ statusCode }, 'Соединение закрыто, переподключаюсь через 3 секунды');
      setTimeout(() => {
        connect().catch((error) => logger.error({ err: error }, 'Не удалось переподключиться'));
      }, 3000);
    }
  });
}

async function sendCode(phone, code) {
  const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: messageFor(code) });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error('too_large'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('bad_json'));
      }
    });

    request.on('error', reject);
  });
}

function json(response, status, payload) {
  const data = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  response.end(data);
}

const server = createServer(async (request, response) => {
  const { method, url } = request;

  if (method === 'GET' && url === '/health') {
    json(response, 200, { ok: true, ready, hasSocket: Boolean(sock), lastQrAt });
    return;
  }

  if (method !== 'POST' || url !== '/api/send-code') {
    json(response, 404, { ok: false, error: 'not_found' });
    return;
  }

  if (request.headers['x-api-secret'] !== SECRET) {
    json(response, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    json(response, 400, { ok: false, error: error.message });
    return;
  }

  const digits = String(payload.phone ?? '').replace(/\D/g, '');
  const code = String(payload.code ?? '').trim();

  if (digits.length < 10 || digits.length > 15) {
    json(response, 400, { ok: false, error: 'bad_phone', message: 'Некорректный номер телефона.' });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    json(response, 400, { ok: false, error: 'bad_code', message: 'Код должен состоять из 6 цифр.' });
    return;
  }

  if (isRateLimited(digits)) {
    json(response, 429, { ok: false, error: 'rate_limited', message: 'Слишком много запросов.' });
    return;
  }

  if (!ready || !sock) {
    json(response, 503, {
      ok: false,
      error: 'whatsapp_not_ready',
      message: 'WhatsApp не подключён: отсканируйте QR-код в консоли сервера.',
    });
    return;
  }

  try {
    await sendCode(digits, code);
    logger.info({ to: `***${digits.slice(-4)}` }, 'Код отправлен в WhatsApp');
    json(response, 200, { ok: true });
  } catch (error) {
    logger.error({ err: error, to: `***${digits.slice(-4)}` }, 'Не удалось отправить сообщение');
    json(response, 502, {
      ok: false,
      error: 'send_failed',
      message: error?.message || 'Не удалось отправить сообщение в WhatsApp.',
    });
  }
});

connect().catch((error) => {
  logger.error({ err: error }, 'Не удалось запустить WhatsApp-клиент');
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`WhatsApp-шлюз слушает http://localhost:${PORT}`);
});

function shutdown(signal) {
  logger.info(`Получен ${signal}, закрываю сервер`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
