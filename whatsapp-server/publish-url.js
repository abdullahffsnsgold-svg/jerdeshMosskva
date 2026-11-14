/**
 * Публикует текущий адрес туннеля из gateway-url.txt в Supabase.
 *
 * Нужен, когда ключ SUPABASE_SERVICE_ROLE_KEY добавили позже запуска шлюза:
 * перезапускать туннель ради этого не требуется, адрес не меняется.
 *
 * Запуск:
 *   node publish-url.js                     (возьмёт адрес из gateway-url.txt)
 *   node publish-url.js https://адрес       (или укажет адрес явно)
 */

import { readFileSync } from 'node:fs';

import { loadDotEnv } from './env.js';
import { publishGatewayUrl } from './publish.js';

loadDotEnv();

const fromArg = process.argv[2]?.trim();

function urlFromFile() {
  try {
    return readFileSync(new URL('./gateway-url.txt', import.meta.url), 'utf8').trim();
  } catch {
    return '';
  }
}

const url = fromArg || urlFromFile();

if (!/^https?:\/\//.test(url)) {
  console.error(
    'Не нашёл адрес туннеля. Запустите шлюз (public.cmd) или передайте адрес аргументом.',
  );
  process.exit(1);
}

const ok = await publishGatewayUrl(url);
process.exitCode = ok ? 0 : 1;
