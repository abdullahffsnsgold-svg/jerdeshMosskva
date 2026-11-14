/**
 * Запускает WhatsApp-шлюз и публичный туннель Cloudflare вместе.
 *
 * Зачем отдельный лаунчер: сайт на Vercel не может достучаться до localhost,
 * поэтому шлюз открывается наружу туннелем. При каждом запуске туннель
 * получает новый адрес — лаунчер ловит его из вывода cloudflared и пишет
 * в gateway-url.txt, чтобы адрес не приходилось искать в логах.
 *
 * Запуск:
 *   node start-public.js      (обычный режим, всё видно в консоли)
 *   autostart.vbs             (то же самое без окон, при входе в Windows)
 */

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDotEnv } from './env.js';
import { publishGatewayUrl } from './publish.js';

loadDotEnv();

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5001;
const CLOUDFLARED = path.join(DIR, '.bin', 'cloudflared.exe');
const LOG_FILE = path.join(DIR, 'start-public.log');
const URL_FILE = path.join(DIR, 'gateway-url.txt');

const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  console.log(text);

  try {
    appendFileSync(LOG_FILE, `${text}\n`);
  } catch {
    // лог — удобство, а не условие работы
  }
}

/** Порт занят? Значит шлюз уже запущен и второй экземпляр устроил бы конфликт 440. */
function isPortBusy() {
  return new Promise((resolve) => {
    const socket = net.connect(PORT, '127.0.0.1');

    const done = (busy) => {
      socket.destroy();
      resolve(busy);
    };

    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

async function waitForGateway() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();

      if (data?.ok) return data;
    } catch {
      // шлюз ещё поднимается
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

async function main() {
  let gateway = null;

  if (await isPortBusy()) {
    log(`Порт ${PORT} уже занят — использую работающий шлюз.`);
  } else {
    if (process.env.WHATSAPP_API_SECRET === undefined && !existsSync(path.join(DIR, '.env'))) {
      log('ВНИМАНИЕ: нет .env с WHATSAPP_API_SECRET — шлюз не запустится.');
    }

    log('Запускаю WhatsApp-шлюз...');
    gateway = spawn(process.execPath, ['index.js'], {
      cwd: DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    gateway.stdout.on('data', (chunk) => log(`шлюз: ${chunk.toString().trim()}`));
    gateway.stderr.on('data', (chunk) => log(`шлюз: ${chunk.toString().trim()}`));
    gateway.on('exit', (code) => log(`Шлюз остановился, код ${code}.`));
  }

  const health = await waitForGateway();

  if (!health) {
    log('Шлюз не ответил на /health за минуту. Туннель не поднимаю.');
    process.exitCode = 1;
    return;
  }

  log(
    health.ready
      ? 'Шлюз готов, WhatsApp подключён.'
      : 'Шлюз отвечает, WhatsApp ещё подключается. Если так и останется — запустите public.cmd и отсканируйте QR.',
  );

  if (!existsSync(CLOUDFLARED)) {
    log(`Нет ${CLOUDFLARED}. Скачайте cloudflared или запустите public.cmd.`);
    process.exitCode = 1;
    return;
  }

  log('Открываю туннель Cloudflare...');
  const tunnel = spawn(
    CLOUDFLARED,
    ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'],
    { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );

  let urlFound = false;

  const handleTunnelOutput = (chunk) => {
    const text = chunk.toString();

    if (!urlFound) {
      const match = text.match(TUNNEL_URL_RE);

      if (match) {
        urlFound = true;
        writeFileSync(URL_FILE, `${match[0]}\n`);
        log(`Публичный адрес: ${match[0]}`);
        void publishGatewayUrl(match[0], log);
      }
    }
  };

  tunnel.stdout.on('data', handleTunnelOutput);
  tunnel.stderr.on('data', handleTunnelOutput);
  tunnel.on('exit', (code) => log(`Туннель остановился, код ${code}.`));

  const shutdown = () => {
    log('Останавливаюсь...');
    tunnel.kill();
    gateway?.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  log(`Ошибка запуска: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
