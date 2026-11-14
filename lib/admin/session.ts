import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Сессия админки.
 *
 * Пароль админа живёт только в переменной окружения ADMIN_PASSWORD (не в коде
 * и не в браузере). После успешного ввода ставится httpOnly-cookie с
 * подписанным сроком жизни — клиентский JavaScript её не читает и подделать
 * не может, потому что подпись считается HMAC от пароля (или отдельного
 * ADMIN_SESSION_SECRET).
 */

export const ADMIN_COOKIE = 'admin_session';

/** 8 часов — рабочая смена, после перезахода пароль нужно вводить снова. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const adminPassword = () => process.env.ADMIN_PASSWORD ?? '';

/** Отдельный секрет нужен, если пароль решено менять без разлогина всех */
const signingKey = () => process.env.ADMIN_SESSION_SECRET || adminPassword();

/** Пароль вообще задан на этом деплое? */
export const isAdminConfigured = () => adminPassword().length > 0;

/** Сравнение без утечки длины/содержимого по времени ответа */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Всё равно считаем хеш, чтобы время ответа не зависело от длины
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

export function passwordMatches(input: unknown): boolean {
  if (!isAdminConfigured() || typeof input !== 'string' || input.length === 0) return false;
  return safeEqual(input, adminPassword());
}

const sign = (payload: string) =>
  createHmac('sha256', signingKey()).update(payload).digest('base64url');

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, nonce: randomBytes(8).toString('hex') }),
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

/** Вызывается из route-обработчиков и серверных компонентов */
export async function hasAdminSession(): Promise<boolean> {
  if (!isAdminConfigured()) return false;

  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/** Простой лимит попыток входа: 5 промахов за 10 минут на IP */
const FAILED_LIMIT = 5;
const FAILED_WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, number[]>();

export function isLoginBlocked(ip: string): boolean {
  const now = Date.now();
  const recent = (failedAttempts.get(ip) ?? []).filter((time) => now - time < FAILED_WINDOW_MS);

  if (recent.length === 0) {
    failedAttempts.delete(ip);
    return false;
  }

  failedAttempts.set(ip, recent);
  return recent.length >= FAILED_LIMIT;
}

export function registerFailedLogin(ip: string): void {
  const now = Date.now();
  const recent = (failedAttempts.get(ip) ?? []).filter((time) => now - time < FAILED_WINDOW_MS);
  recent.push(now);

  if (failedAttempts.size > 500) {
    for (const [key, times] of failedAttempts) {
      if (times.every((time) => now - time >= FAILED_WINDOW_MS)) failedAttempts.delete(key);
    }
  }

  failedAttempts.set(ip, recent);
}

export function clearFailedLogins(ip: string): void {
  failedAttempts.delete(ip);
}
