import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase возвращает после Google-входа на Site URL, если адрес
 * /auth/callback не добавлен в Redirect URLs. Тогда код оказывается на главной
 * (`/?code=...`) и вход не завершается. Здесь такой запрос переадресуется на
 * страницу, которая умеет менять код на сессию.
 *
 * Работает только для главной — остальные страницы не затрагиваются.
 */
export function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const hasOAuthResult =
    searchParams.has('code') ||
    searchParams.has('error') ||
    searchParams.has('error_description');

  if (!hasOAuthResult) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/auth/callback';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/',
};
