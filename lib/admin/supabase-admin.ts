import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Серверный клиент с service-role ключом: обходит RLS, поэтому только для
 * админских route-обработчиков. Ключ никогда не попадает в браузер —
 * у него нет префикса NEXT_PUBLIC_, и этот модуль импортируют лишь API-роуты.
 */

export const isServiceRoleConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Сообщение для панели, если серверные ключи не заданы */
export const SERVICE_ROLE_HINT =
  'Не задан SUPABASE_SERVICE_ROLE_KEY. Добавьте его в Environment Variables проекта ' +
  '(Supabase → Project Settings → API → service_role) и перезапустите деплой.';
