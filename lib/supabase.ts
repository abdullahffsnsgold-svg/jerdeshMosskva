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
      // Implicit-поток: Supabase возвращает токены во фрагменте ссылки.
      // PKCE требует хранить code verifier в localStorage, и если его нет
      // (очистка хранилища, другой браузер, повторное открытие ссылки),
      // вход падает с «code verifier not found».
      flowType: 'implicit',
      // Авторазбор URL отключён: иначе supabase-js сам съест токены из адреса
      // раньше, чем страница /auth/callback успеет сохранить вход.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);