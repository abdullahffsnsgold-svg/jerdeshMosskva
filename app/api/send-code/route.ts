import { NextResponse } from 'next/server';

/**
 * Отправка кодов подтверждения в WhatsApp через собственный шлюз.
 *
 * Почему только WhatsApp: код уходит с личного номера владельца сайта
 * (whatsapp-server/, привязка по QR), поэтому SMS-провайдеры не нужны.
 *
 * Откуда берётся адрес шлюза:
 *   1) таблица public.gateway_config — шлюз записывает туда свой адрес при старте,
 *      поэтому после перезагрузки компьютера туннель получает новый адрес,
 *      а сайт подхватывает его сам, без правки переменных и пересборки;
 *   2) переменная WHATSAPP_GATEWAY_URL — если в базе записи ещё нет.
 *
 * WHATSAPP_GATEWAY_SECRET — тот же WHATSAPP_API_SECRET, что у шлюза.
 *
 * В dev без шлюза код печатается в консоль сервера, в production
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

/** Адрес шлюза из базы кэшируем: код не должен ходить в Supabase на каждый запрос. */
const GATEWAY_CACHE_MS = 60_000;
let gatewayCache: { url: string; at: number } | null = null;

async function gatewayUrlFromDb(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/gateway_config?select=gateway_url&limit=1`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      },
    );

    if (!response.ok) return null;

    const rows = (await response.json()) as { gateway_url?: unknown }[];
    const value = rows?.[0]?.gateway_url;

    return typeof value === 'string' && /^https?:\/\//.test(value) ? value : null;
  } catch {
    // База недоступна — не ломаем отправку, ниже есть запасной вариант
    return null;
  }
}

async function resolveGatewayUrl(): Promise<string | null> {
  const now = Date.now();

  if (gatewayCache && now - gatewayCache.at < GATEWAY_CACHE_MS) return gatewayCache.url;

  const fromDb = await gatewayUrlFromDb();
  const fromEnv = process.env.WHATSAPP_GATEWAY_URL?.trim() || null;
  const url = (fromDb ?? fromEnv)?.replace(/\/+$/, '') ?? null;

  if (url) gatewayCache = { url, at: now };

  return url;
}

async function sendViaWhatsApp(
  baseUrl: string,
  to: string,
  code: string,
): Promise<SendResult> {
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
    // Адрес мог устареть (компьютер перезагрузили) — сбрасываем кэш,
    // чтобы следующий запрос взял свежий адрес из базы
    gatewayCache = null;

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

  const gatewayUrl = await resolveGatewayUrl();
  const gatewayReady = Boolean(gatewayUrl && process.env.WHATSAPP_GATEWAY_SECRET);

  if (!gatewayReady) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          error: 'provider_not_configured',
          message:
            'Отправка кодов не настроена: не найден адрес WhatsApp-шлюза. Проверьте таблицу gateway_config в Supabase и переменную WHATSAPP_GATEWAY_SECRET на Vercel.',
        },
        { status: 503 },
      );
    }

    // В dev без шлюза код печатается в консоль сервера, чтобы можно было проверить вход
    console.info(`[send-code] dev-режим: код ${code} для ${phone}`);
    return NextResponse.json({ ok: true, provider: 'console' });
  }

  try {
    const result = await sendViaWhatsApp(gatewayUrl as string, phone, code);

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
