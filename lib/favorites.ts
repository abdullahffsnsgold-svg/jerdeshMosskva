'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'favorites';
const CHANGE_EVENT = 'favoritesChange';

/** Одна и та же ссылка, пока список не изменился — иначе useSyncExternalStore зациклится. */
const EMPTY: readonly number[] = [];

let cachedRaw: string | null = null;
let cachedIds: readonly number[] = EMPTY;

function parse(raw: string): readonly number[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;

    const ids = value.map(Number).filter((id) => Number.isFinite(id));
    return ids.length === 0 ? EMPTY : ids;
  } catch {
    return EMPTY;
  }
}

/** Избранные объявления хранятся в localStorage: аккаунт в проекте локальный. */
export function getFavoriteIds(): readonly number[] {
  if (typeof window === 'undefined') return EMPTY;

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? '[]';
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parse(raw);
  }

  return cachedIds;
}

export function subscribeFavorites(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Добавляет или убирает объявление и оповещает все подписанные компоненты. */
export function toggleFavorite(id: number) {
  if (typeof window === 'undefined') return;

  const current = getFavoriteIds();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFavoriteIds() {
  return useSyncExternalStore(subscribeFavorites, getFavoriteIds, () => EMPTY);
}
