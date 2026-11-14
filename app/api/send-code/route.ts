import { NextResponse } from 'next/server';

/**
 * Отправка кодов подтверждения в WhatsApp через собственный шлюз.
 *
 * Почему только WhatsApp: код уходит с личного номера владельца сайта
 * (whatsapp-server/, привязка по QR), поэтому SMS-провайдеры не нужны.
 *
 * Переменные окружения:
 *   WHATSAPP_GATEWAY_URL     адрес шлюза, например https://xxx.onrender.com
 *   WHATSAPP_GATEWAY_SECRET  тот же WHATSAPP_API_SECRET, что у шлюза
 *
 * В dev без этих переменных код печатается в консоль сервера, в production
 * маршрут отвечает 503: отправлять некуда.
 */

export const runtime = 'nodejs';

const CODE_RE = /^\d{6}$/;

/** Обрезает ответ шлюза, чтобы он влез в сообщение об ошибке. */
function trimDetail(detail: string): string {
  const single = detail.replace(/\s+/g, ' ').trim();
  return single.length > 200 ? `${single.slice(0, 200)}…` : single;
}

/** Не больше 3 отправок на номер за минуту. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

interface SendResult {
  ok: boolean;
  detail?: string;
}

const recentRequests = new Map<string, number[]>();

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const timestamps = (recentRequests.get(phone) ?? []).filter((time) => now - time < RATE_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT) {
    recentRequests.set(phone, timestamps);
    return true;
  }

  timestamps.push(now);
  recentRequests.set(phone, timestamps);

  // Не даём словарю расти бесконечно на долгоживущем инстансе
  if (recentRequests.size > 1000) {
    for (const [key, times] of recentRequests) {
      if (times.every((time) => now - time >= RATE_WINDOW_MS)) recentRequests.delete(key);
    }
  }

  return false;
}

async function sendViaWhatsApp(to: string, code: string): Promise<SendResult> {
  const baseUrl = (process.env.WHATSAPP_GATEWAY_URL as string).replace(/\/+$/, '');

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_GATEWAY_SECRET as string,
      },
      body: JSON.stringify({ phone: to, code }),
      // Шлюз может быть на медленном канале — не держим запрос бесконечно
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // Самая частая причина: шлюз не запущен или адрес устарел после перезапуска
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      detail: `Шлюз недоступен по адресу ${baseUrl}. ${reason}`,
    };
  }

  const data = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    return { ok: false, detail: data?.message ?? `HTTP ${response.status}` };
  }

  return { ok: true };
}

export async function POST(request: Request) {
  let payload: { phone?: unknown; code?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // Клиент присылает номер без плюса ("996555123456"), поэтому приводим к E.164 сами
  const digits = typeof payload.phone === 'string' ? payload.phone.replace(/\D/g, '') : '';
  const incomingCode = typeof payload.code === 'string' ? payload.code.trim() : '';

  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json(
      { ok: false, error: 'bad_phone', message: 'Некорректный номер телефона.' },
      { status: 400 },
    );
  }

  const phone = `+${digits}`;

  if (incomingCode && !CODE_RE.test(incomingCode)) {
    return NextResponse.json({ ok: false, error: 'bad_code' }, { status: 400 });
  }

  if (isRateLimited(phone)) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', message: 'Слишком много запросов. Подождите минуту.' },
      { status: 429 },
    );
  }

  // Код приходит с клиента, чтобы не менять текущую схему проверки;
  // если его нет — генерируем сами (удобно проверять маршрут через curl).
  const code = CODE_RE.test(incomingCode)
    ? incomingCode
    : Math.floor(100000 + Math.random() * 900000).toString();

  const gatewayReady = Boolean(
    process.env.WHATSAPP_GATEWAY_URL && process.env.WHATSAPP_GATEWAY_SECRET,
  );

  if (!gatewayReady) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          error: 'provider_not_configured',
          message:
            'Отправка кодов не настроена: добавьте WHATSAPP_GATEWAY_URL и WHATSAPP_GATEWAY_SECRET на Vercel.',
        },
        { status: 503 },
      );
    }

    // В dev без шлюза код печатается в консоль сервера, чтобы можно было проверить вход
    console.info(`[send-code] dev-режим: код ${code} для ${phone}`);
    return NextResponse.json({ ok: true, provider: 'console' });
  }

  try {
    const result = await sendViaWhatsApp(phone, code);

    if (!result.ok) {
      console.error('[send-code] шлюз отказал', phone.slice(-4), result.detail);
      return NextResponse.json(
        {
          ok: false,
          error: 'send_failed',
          provider: 'whatsapp',
          message: `Не удалось отправить код в WhatsApp. ${trimDetail(
            result.detail ?? 'Шлюз вернул ошибку.',
          )}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, provider: 'whatsapp' });
  } catch (error) {
    console.error('[send-code] ошибка отправки', error);
    return NextResponse.json(
      { ok: false, error: 'send_failed', message: 'Не удалось отправить код.' },
      { status: 502 },
    );
  }
}
