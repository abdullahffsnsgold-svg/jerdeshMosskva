import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Не роняем сборку: на Vercel переменные приходят из настроек проекта,
  // а локальный .env.local в репозиторий не попадает.
  console.error(
    '[supabase] Не заданы NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Добавьте их в Environment Variables проекта на Vercel.',
  );
}

// Заглушка нужна только чтобы создать клиент при сборке без переменных;
// запросы к данным всё равно требуют реальных ключей.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      flowType: 'pkce',
      // Код из ссылки возврата обмениваем сами на /auth/callback —
      // так обмен происходит ровно один раз и без гонки с авторазбором URL.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);