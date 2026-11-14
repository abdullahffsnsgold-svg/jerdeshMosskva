import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  clearFailedLogins,
  createSessionToken,
  hasAdminSession,
  isAdminConfigured,
  isLoginBlocked,
  passwordMatches,
  registerFailedLogin,
} from '@/lib/admin/session';
import { SERVICE_ROLE_HINT, isServiceRoleConfigured } from '@/lib/admin/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clientIp = (request: Request) =>
  (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

/** Состояние панели: залогинен ли админ и всё ли настроено на деплое */
export async function GET() {
  return NextResponse.json({
    ok: true,
    authenticated: await hasAdminSession(),
    passwordConfigured: isAdminConfigured(),
    databaseConfigured: isServiceRoleConfigured(),
    setupHint: isServiceRoleConfigured() ? null : SERVICE_ROLE_HINT,
  });
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_configured',
        message:
          'Админка не настроена: добавьте переменную ADMIN_PASSWORD в настройках проекта и перезапустите деплой.',
      },
      { status: 503 },
    );
  }

  const ip = clientIp(request);

  if (isLoginBlocked(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_many_attempts',
        message: 'Слишком много неудачных попыток. Попробуйте через 10 минут.',
      },
      { status: 429 },
    );
  }

  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return NextResponse.json({ ok: false, message: 'Некорректный запрос.' }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    registerFailedLogin(ip);

    return NextResponse.json(
      { ok: false, error: 'bad_password', message: 'Неверный пароль.' },
      { status: 401 },
    );
  }

  clearFailedLogins(ip);

  const response = NextResponse.json({ ok: true });

  response.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
