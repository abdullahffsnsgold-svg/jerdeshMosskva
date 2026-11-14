'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loginWithGoogle } from '@/lib/auth';

interface GoogleButtonProps {
  /** Показать ошибку рядом с кнопкой (в форме уже есть своя строка ошибки) */
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
}

/** Кнопка входа через Google. Браузер уводится на OAuth-страницу Supabase. */
export default function GoogleButton({
  onError,
  disabled = false,
  label = 'Продолжить с Google',
}: GoogleButtonProps) {
  const [redirecting, setRedirecting] = useState(false);

  const handleClick = async () => {
    if (redirecting || disabled) return;

    setRedirecting(true);
    const result = await loginWithGoogle();

    if (!result.ok) {
      setRedirecting(false);
      onError(result.message ?? 'Не удалось войти через Google.');
    }
    // При успехе страница уже уходит на accounts.google.com — ничего не сбрасываем
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || redirecting}
      aria-label={label}
      className={`flex h-11 w-full items-center justify-center gap-3 rounded-full border text-[15px] font-medium transition-all active:scale-[0.98] ${
        disabled || redirecting
          ? 'cursor-not-allowed border-[#E5E5EA] bg-gray-50 text-[#8E8E93]'
          : 'border-[#E5E5EA] bg-white text-[#1F1F1F] hover:bg-[#F7F7F8]'
      }`}
    >
      {redirecting ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#8E8E93]" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
      )}
      {redirecting ? 'Открываем Google…' : label}
    </button>
  );
}
