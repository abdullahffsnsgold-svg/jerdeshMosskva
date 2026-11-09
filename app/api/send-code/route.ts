import { NextResponse } from 'next/server';

/**
 * Отправка кодов подтверждения на номер.
 *
 * Провайдер выбирается по переменным окружения:
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM  → Twilio
 *   VONAGE_API_KEY + VONAGE_API_SECRET (+ SMS_SENDER_ID)   → Vonage
 *   ничего не задано                                      → консоль (только в dev)
 *
 * В production без ключей маршрут отвечает 503: код некуда отправлять.
 */

export const runtime = 'nodejs';

const CODE_RE = /^\d{6}$/;

/** Не больше 3 отправок на номер за минуту. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

type Provider = 'twilio' | 'vonage' | 'console';

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

function activeProvider(): Provider | null {
  const twilioReady =
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM;

  if (twilioReady) return 'twilio';

  const vonageReady = process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET;
  if (vonageReady) return 'vonage';

  return process.env.NODE_ENV === 'production' ? null : 'console';
}

function messageFor(code: string) {
  return `Код подтверждения Jerdesh: ${code}. Никому его не сообщайте.`;
}

async function sendViaTwilio(to: string, code: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM as string;

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: messageFor(code) }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, detail: text.slice(0, 300) };
  }

  return { ok: true };
}

async function sendViaVonage(to: string, code: string): Promise<SendResult> {
  const key = process.env.VONAGE_API_KEY as string;
  const secret = process.env.VONAGE_API_SECRET as string;
  const from = process.env.SMS_SENDER_ID || 'Jerdesh';

  const response = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: key,
      api_secret: secret,
      // Vonage принимает номер без плюса
      to: to.replace(/^\+/, ''),
      from,
      text: messageFor(code),
      type: 'unicode',
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | { messages?: { status?: string; 'error-text'?: string }[] }
    | null;

  const first = data?.messages?.[0];
  if (!response.ok || first?.status !== '0') {
    return { ok: false, detail: first?.['error-text'] ?? `HTTP ${response.status}` };
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

  const provider = activeProvider();

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error: 'provider_not_configured',
        message: 'SMS-провайдер не настроен: добавьте переменные Twilio или Vonage.',
      },
      { status: 503 },
    );
  }

  try {
    const result =
      provider === 'twilio'
        ? await sendViaTwilio(phone, code)
        : provider === 'vonage'
          ? await sendViaVonage(phone, code)
          : { ok: true };

    if (!result.ok) {
      console.error('[send-code] провайдер отказал', provider, phone.slice(-4), result.detail);
      return NextResponse.json(
        { ok: false, error: 'send_failed', message: 'Не удалось отправить SMS.' },
        { status: 502 },
      );
    }

    // В dev без провайдера код печатается в консоль сервера, чтобы можно было проверить вход
    if (provider === 'console') {
      console.info(`[send-code] dev-режим: код ${code} для ${phone}`);
    }

    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    console.error('[send-code] ошибка отправки', error);
    return NextResponse.json(
      { ok: false, error: 'send_failed', message: 'Не удалось отправить SMS.' },
      { status: 502 },
    );
  }
}
