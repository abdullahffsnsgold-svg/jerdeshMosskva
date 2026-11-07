import posthog from 'posthog-js';

/**
 * Аналитика и Session Replay на PostHog.
 * SDK инициализируется только после явного согласия пользователя: пока согласия нет,
 * никакие данные не отправляются и запись сессии не начинается.
 */

/** Project API Key из настроек проекта PostHog. Публичный ключ, секретом не является. */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** Регион проекта: eu.i.posthog.com или us.i.posthog.com. */
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

/** Ключ в localStorage, где хранится выбор пользователя. */
const CONSENT_STORAGE_KEY = 'analyticsConsent';

/** Событие, которым сообщаем об изменении выбора в текущей вкладке. */
const CONSENT_CHANGE_EVENT = 'analyticsConsentChange';

export type AnalyticsConsent = 'granted' | 'denied';

export type AnalyticsEventProperties = Record<string, string | number | boolean>;

let initialized = false;

/** Ключ проекта задан — значит, аналитику можно предлагать пользователю. */
export const isAnalyticsConfigured = Boolean(POSTHOG_KEY);

/** Текущий выбор пользователя или null, если он ещё не отвечал. */
export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : null;
}

/**
 * Подписка на изменение выбора (эта и другие вкладки).
 * Используется через useSyncExternalStore, чтобы не рассинхронизировать серверный рендер.
 */
export function subscribeAnalyticsConsent(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  };
}

/** Сохраняет выбор пользователя. Отзыв согласия сразу выключает отправку событий. */
export function setAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));

  if (consent === 'denied' && initialized) {
    posthog.opt_out_capturing();
  }
}

/**
 * Инициализирует PostHog один раз за загрузку страницы.
 * Возвращает true, если клиент готов отправлять события.
 */
export function initAnalytics(): boolean {
  if (initialized) return true;
  if (typeof window === 'undefined') return false;

  if (!POSTHOG_KEY) {
    console.warn('[analytics] NEXT_PUBLIC_POSTHOG_KEY не задан, PostHog выключен.');
    return false;
  }

  if (readAnalyticsConsent() !== 'granted') return false;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2025-05-24',
    // Профили создаём только для явно опознанных пользователей.
    person_profiles: 'identified_only',
    // В App Router переходы не перезагружают страницу, поэтому просмотры отправляем сами.
    capture_pageview: false,
    capture_pageleave: true,
    // Session Replay: значения всех полей ввода маскируются,
    // элементы с data-ph-no-capture не записываются вовсе.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
      blockSelector: '[data-ph-no-capture]',
    },
    // Уважаем Do Not Track браузера.
    respect_dnt: true,
    secure_cookie: window.location.protocol === 'https:',
  });

  initialized = true;
  return true;
}

/** Ключевые события воронки: вход, регистрация, публикация объявления. */
export function captureEvent(event: string, properties?: AnalyticsEventProperties) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/** Просмотр страницы — привязывает запись сессии к маршруту приложения. */
export function capturePageview() {
  if (!initialized) return;
  posthog.capture('$pageview');
}
