'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { describeOauthError } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';

/**
 * Supabase возвращает сюда после входа через Google (?code=...).
 * Здесь код меняется на сессию, а приложение запоминает вход так же,
 * как при входе по номеру: localStorage + событие authChange.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const params = new URLSearchParams(window.location.search);

      // Google или Supabase могли вернуть отказ вместо кода
      const oauthError = params.get('error_description') ?? params.get('error');
      if (oauthError) {
        if (!cancelled) setError(describeOauthError(oauthError));
        return;
      }

      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[google] обмен кода не удался', exchangeError.message);
          if (!cancelled) setError(describeOauthError(exchangeError.message));
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        if (!cancelled) setError('Сессия не создалась. Попробуйте войти через Google ещё раз.');
        return;
      }

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
