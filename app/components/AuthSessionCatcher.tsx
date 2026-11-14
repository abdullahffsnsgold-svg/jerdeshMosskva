'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Если Supabase вернул токены на другую страницу (например, на главную,
 * когда /auth/callback не внесён в Redirect URLs), уводим их на страницу,
 * которая умеет завершать вход. Фрагмент ссылки сервер не видит,
 * поэтому это делает браузер.
 */
export default function AuthSessionCatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/auth/callback') return;

    const redirectOauthResult = () => {
      const hash = window.location.hash;
      const looksLikeOauth =
        hash.includes('access_token=') ||
        hash.includes('error_description=') ||
        hash.includes('error=');

      if (!looksLikeOauth) return;

      window.location.replace(`/auth/callback${hash}`);
    };

    redirectOauthResult();
    // Смена только хэша не перезагружает страницу — ловим её отдельно
    window.addEventListener('hashchange', redirectOauthResult);

    return () => window.removeEventListener('hashchange', redirectOauthResult);
  }, [pathname]);

  return null;
}
