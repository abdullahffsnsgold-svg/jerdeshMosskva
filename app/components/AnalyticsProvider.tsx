'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  capturePageview,
  initAnalytics,
  isAnalyticsConfigured,
  readAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics';

/**
 * Подключает PostHog Session Replay ко всему приложению.
 * Пока пользователь не согласился, SDK не загружается и ничего не записывается.
 * Без NEXT_PUBLIC_POSTHOG_KEY компонент ничего не показывает и не делает.
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  // Выбор хранится в localStorage: на сервере его нет, поэтому начальное значение — null.
  const consent = useSyncExternalStore<AnalyticsConsent | null>(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    () => null,
  );

  // Инициализация и просмотры страниц при переходах между маршрутами.
  useEffect(() => {
    if (consent !== 'granted') return;

    initAnalytics();
    capturePageview();
  }, [consent, pathname]);

  if (!isAnalyticsConfigured || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Согласие на аналитику"
      className="fixed bottom-4 left-4 z-[110] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
    >
      <p className="text-sm text-gray-700">
        Помогите улучшить Jerdesh: мы записываем анонимные сессии и просмотры страниц. Поля ввода скрыты.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setAnalyticsConsent('granted')}
          className="rounded-full bg-[#3B51D5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B41B7]"
        >
          Принять
        </button>
        <button
          onClick={() => setAnalyticsConsent('denied')}
          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Отклонить
        </button>
      </div>
    </div>
  );
}
