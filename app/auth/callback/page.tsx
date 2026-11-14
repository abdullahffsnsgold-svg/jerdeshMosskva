'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { describeOauthError } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';

type SessionUser = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

/**
 * Supabase возвращает сюда после входа через Google.
 * Токены приходят во фрагменте ссылки (#access_token=...), поэтому читаем их
 * сами и кладём в сессию, а вход запоминаем так же, как при входе по номеру.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);

      const oauthError =
        hash.get('error_description') ??
        hash.get('error') ??
        query.get('error_description') ??
        query.get('error');

      if (oauthError) {
        if (!cancelled) setError(describeOauthError(oauthError));
        return;
      }

      let session: SessionUser = null;

      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('[google] не удалось сохранить сессию', sessionError.message);
          if (!cancelled) setError(describeOauthError(sessionError.message));
          return;
        }

        session = data.session;
        // Токены больше не нужны в адресной строке
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Запасной путь: если проект вернул код (PKCE), пробуем обменять его
      const code = query.get('code');
      if (!session && code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[google] обмен кода не удался', exchangeError.message);
          if (!cancelled) setError(describeOauthError(exchangeError.message));
          return;
        }

        session = data.session;
      }

      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session?.user) {
        if (!cancelled) setError('Сессия не создалась. Попробуйте войти через Google ещё раз.');
        return;
      }

      const user = session.user;
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        'Пользователь';

      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('userName', name);
      // Коды и объявления используют userPhone как подпись автора
      localStorage.setItem('userPhone', user.email ?? name);
      window.dispatchEvent(new Event('authChange'));

      captureEvent('user_signed_in', { method: 'google' });

      if (!cancelled) router.replace('/');
    };

    finish().catch((err) => {
      console.error('[google] ошибка завершения входа', err);
      if (!cancelled) setError('Не удалось завершить вход. Проверьте интернет и попробуйте снова.');
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      {error ? (
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#EA4335]">
            <AlertTriangle size={22} />
          </span>
          <h1 className="text-lg font-bold text-[#1F1F1F]">Вход не завершён</h1>
          <p className="mt-2 text-[14px] leading-snug text-[#8E8E93]">{error}</p>
          <Link
            href="/"
            className="mt-5 flex h-11 items-center justify-center rounded-full bg-[#4343D9] text-[15px] font-medium text-white transition-colors hover:bg-[#3232B8]"
          >
            Вернуться на сайт
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-[#8E8E93]">
          <Loader2 className="h-6 w-6 animate-spin text-[#4343D9]" />
          <p className="text-[14px]">Завершаем вход через Google…</p>
        </div>
      )}
    </main>
  );
}
