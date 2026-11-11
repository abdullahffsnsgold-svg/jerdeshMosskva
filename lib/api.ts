import { normalizePhone } from './phone';

/**
 * Внутренний маршрут Next.js: он отправляет код через WhatsApp-шлюз или SMS-провайдера.
 * Адрес относительный, чтобы запрос уходил на тот же домен, что и сайт
 * (localhost:3000 локально и домен Vercel в продакшене) — без переменных окружения.
 */
export const SEND_CODE_URL = '/api/send-code';

export interface SendCodeResult {
  ok: boolean;
  /** Готовый для показа пользователю текст ошибки */
  message?: string;
}

/** Отправляет 6-значный код на номер и объясняет отказ человеческим текстом. */
export async function requestVerificationCode(phone: string, code: string): Promise<SendCodeResult> {
  try {
    const response = await fetch(SEND_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizePhone(phone), code }),
    });

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; message?: string }
      | null;

    if (response.ok && data?.ok) return { ok: true };

    return {
      ok: false,
      message: data?.message ?? `Не удалось отправить код (ошибка ${response.status}).`,
    };
  } catch (error) {
    console.error('[send-code] сеть недоступна', error);
    return {
      ok: false,
      message: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
    };
  }
}
