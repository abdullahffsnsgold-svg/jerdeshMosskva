-- =========================================================
--  Адрес WhatsApp-шлюза в Supabase
--
--  Зачем: шлюз работает на обычном компьютере и открывается наружу туннелем.
--  При каждом включении компьютера адрес туннеля новый, поэтому шлюз сам
--  записывает его в эту таблицу, а сайт читает адрес оттуда при отправке кода.
--  Без этого адрес пришлось бы вписывать в Vercel и пересобирать проект.
--
--  КАК ЗАПУСКАТЬ:
--  Supabase → SQL Editor → New query → вставить файл целиком → Run.
--  Скрипт идемпотентный, можно запускать повторно.
--
--  Чтение открыто (адрес шлюза — публичная информация),
--  запись — только service_role ключом, то есть с компьютера владельца.
--  Иначе любой посетитель мог бы подменить адрес и получать чужие коды.
-- =========================================================

create table if not exists public.gateway_config (
  id          smallint    primary key default 1,
  gateway_url text        not null,
  updated_at  timestamptz not null default now(),
  -- Строка всегда одна: шлюз обновляет её через upsert
  constraint gateway_config_single_row check (id = 1)
);

alter table public.gateway_config enable row level security;

-- Никакой записи для клиентов сайта
revoke all on table public.gateway_config from anon, authenticated;
grant select on table public.gateway_config to anon, authenticated;

drop policy if exists gateway_config_read on public.gateway_config;
create policy gateway_config_read on public.gateway_config
  for select
  to anon, authenticated
  using (true);

-- Чтобы PostgREST сразу видел новую таблицу
notify pgrst, 'reload schema';

-- Проверка: должно быть true, строк при первом запуске — 0
select
  to_regclass('public.gateway_config') is not null as table_exists,
  (select count(*) from public.gateway_config) as rows_now;
