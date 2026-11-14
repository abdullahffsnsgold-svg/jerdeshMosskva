/**
 * Читает локальный .env рядом с этим файлом (если он есть).
 *
 * Так секреты живут в файле, который не попадает в git, а не в коде.
 * На Render/Railway .env нет — переменные приходят из панели сервиса.
 */

import { readFileSync } from 'node:fs';

export function loadDotEnv() {
  let content;

  try {
    content = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  } catch {
    return;
  }

  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    // Уже заданная переменная окружения важнее файла
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}
