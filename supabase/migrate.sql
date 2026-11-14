-- =========================================================
--  Jerdesh - Moscow: догоняющая миграция для УЖЕ созданной базы
--
--  КОГДА НУЖЕН ЭТОТ ФАЙЛ:
--  если в приложении появляется ошибка вида
--    «column products.views does not exist»
--    «Could not find the 'image_url' column ... in the schema cache»
--  Это значит, что таблицы были созданы по старой версии схемы, а
--  schema.sql использует `create table if not exists` — существующую
--  таблицу он не меняет. Здесь колонки просто добавляются.
--
--  КАК ЗАПУСКАТЬ:
--  Supabase → SQL Editor → New query → вставить целиком → Run.
--  Скрипт идемпотентный: повторный запуск ничего не ломает.
--
--  Порядок для новой базы: сначала schema.sql, потом secure-users.sql.
--  Этот файл нужен только для базы, созданной раньше.
-- =========================================================

-- ---------- products ----------
alter table public.products add column if not exists title           text;
alter table public.products add column if not exists description     text;
alter table public.products add column if not exists price           numeric(12, 2) default 0;
alter table public.products add column if not exists category_id     bigint;
alter table public.products add column if not exists location        text;
alter table public.products add column if not exists customer_name   text;
alter table public.products add column if not exists customer_number text;
alter table public.products add column if not exists image_url       text;
alter table public.products add column if not exists views           integer not null default 0;
alter table public.products add column if not exists created_at      timestamptz not null default now();

-- Старые строки могли получить null в цене/просмотрах — приводим к безопасным значениям
update public.products set price = 0 where price is null;
update public.products set views = 0 where views is null;

-- ---------- users ----------
alter table public.users add column if not exists phone      text;
alter table public.users add column if not exists password   text;
alter table public.users add column if not exists created_at timestamptz not null default now();

-- ---------- categories ----------
alter table public.categories add column if not exists name text;

-- ---------- comments ----------
alter table public.comments add column if not exists product_id bigint;
alter table public.comments add column if not exists text       text;
alter table public.comments add column if not exists username   text default 'Гость';
alter table public.comments add column if not exists created_at timestamptz not null default now();

-- ---------- user_stories ----------
alter table public.user_stories add column if not exists title           text;
alter table public.user_stories add column if not exists text            text;
alter table public.user_stories add column if not exists media_url       text;
alter table public.user_stories add column if not exists media_type      text default 'image';
alter table public.user_stories add column if not exists customer_number text;
alter table public.user_stories add column if not exists user_id         bigint;
alter table public.user_stories add column if not exists created_at      timestamptz not null default now();

-- ---------- Индексы (могли не создаться в старой базе) ----------
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists comments_product_id_created_at_idx
  on public.comments (product_id, created_at desc);
create index if not exists user_stories_created_at_idx
  on public.user_stories (created_at desc);

-- ---------- RLS и политики ----------
-- Повторяем политики из schema.sql: если старой базе их не хватало,
-- чтение и запись начнут работать снова.
alter table public.categories   enable row level security;
alter table public.products     enable row level security;
alter table public.comments     enable row level security;
alter table public.user_stories enable row level security;

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "products_insert_public" on public.products;
create policy "products_insert_public" on public.products
  for insert to anon, authenticated with check (true);

drop policy if exists "products_update_public" on public.products;
create policy "products_update_public" on public.products
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public" on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "comments_insert_public" on public.comments;
create policy "comments_insert_public" on public.comments
  for insert to anon, authenticated with check (true);

drop policy if exists "stories_select_public" on public.user_stories;
create policy "stories_select_public" on public.user_stories
  for select to anon, authenticated using (true);

drop policy if exists "stories_insert_public" on public.user_stories;
create policy "stories_insert_public" on public.user_stories
  for insert to anon, authenticated with check (true);

-- ---------- Обновляем кеш PostgREST ----------
-- Без этого Supabase ещё несколько секунд отвечает «column ... does not exist»,
-- потому что держит у себя старую схему.
notify pgrst, 'reload schema';

-- ---------- Самопроверка ----------
-- Все значения должны быть true. Если products_views = false — колонка не добавилась.
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'products' and column_name = 'views')          as products_views,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'products' and column_name = 'image_url')      as products_image_url,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'products' and column_name = 'created_at')     as products_created_at,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'comments' and column_name = 'created_at')     as comments_created_at,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'user_stories' and column_name = 'media_url')  as stories_media_url;
