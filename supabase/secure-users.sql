-- =========================================================
--  Безопасная авторизация:bcrypt + закрытая таблица users
--  Выполнить в Supabase → SQL Editor → Run.
--  Скрипт идемпотентный, его можно запускать на существующей базе
--  (после supabase/schema.sql).
--
--  После запуска:
--   * anon-ключ больше не может читать/писать public.users напрямую;
--   * пароли хранятся только как bcrypt-хеши;
--   * вход / регистрация / сброс пароля идут через функции
--     login_user, register_user, reset_user_password, check_phone_registered.
-- =========================================================

-- ---------- 0. pgcrypto для crypt()/gen_salt() ----------
create extension if not exists pgcrypto with schema extensions;

-- ---------- 1. Одноразово хешируем старые пароли из открытого вида ----------
update public.users
set password = extensions.crypt(password, extensions.gen_salt('bf'))
where password is not null
  and password not like '$2a$%'
  and password not like '$2b$%'
  and password not like '$2y$%';

-- ---------- 2. Закрываем прямой доступ к таблице ----------
alter table public.users enable row level security;

-- Убираем публичные политики, которые открывали таблицу раньше
drop policy if exists "users_select_public" on public.users;
drop policy if exists "users_insert_public" on public.users;
drop policy if exists "users_update_public" on public.users;

-- Даже при ошибке в политиках anon не имеет прав на таблицу
revoke all on table public.users from anon, authenticated;

-- ---------- 3. Проверка: занят ли номер ----------
create or replace function public.check_phone_registered(p_phone text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.users u
    where regexp_replace(u.phone, '\D', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  );
$$;

-- ---------- 4. Вход ----------
-- Возвращает { ok: true, id, phone } либо { ok: false, error }
create or replace function public.login_user(p_phone text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_user  public.users%rowtype;
begin
  select *
  into v_user
  from public.users u
  where regexp_replace(u.phone, '\D', '', 'g') = v_phone
  limit 1;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  -- crypt(введённый пароль, сохранённый хеш) должен совпасть с хешем
  if v_user.password is distinct from extensions.crypt(coalesce(p_password, ''), v_user.password) then
    return json_build_object('ok', false, 'error', 'bad_password');
  end if;

  return json_build_object(
    'ok', true,
    'id', v_user.id,
    'phone', regexp_replace(v_user.phone, '\D', '', 'g')
  );
end;
$$;

-- ---------- 5. Регистрация ----------
create or replace function public.register_user(p_phone text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id    bigint;
begin
  if length(v_phone) < 10 then
    return json_build_object('ok', false, 'error', 'phone_invalid');
  end if;

  if length(coalesce(p_password, '')) < 6 then
    return json_build_object('ok', false, 'error', 'password_short');
  end if;

  if exists (
    select 1 from public.users u
    where regexp_replace(u.phone, '\D', '', 'g') = v_phone
  ) then
    return json_build_object('ok', false, 'error', 'phone_taken');
  end if;

  insert into public.users (phone, password)
  values (v_phone, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'phone', v_phone);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'phone_taken');
end;
$$;

-- ---------- 6. Сброс пароля ----------
create or replace function public.reset_user_password(p_phone text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(coalesce(p_password, '')) < 6 then
    return json_build_object('ok', false, 'error', 'password_short');
  end if;

  update public.users
  set password = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where regexp_replace(phone, '\D', '', 'g') = v_phone;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  return json_build_object('ok', true);
end;
$$;

-- ---------- 7. Права на вызов функций ----------
grant execute on function public.check_phone_registered(text) to anon, authenticated;
grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.register_user(text, text) to anon, authenticated;
grant execute on function public.reset_user_password(text, text) to anon, authenticated;

-- Обновляем кеш схемы PostgREST, чтобы RPC появились сразу
notify pgrst, 'reload schema';
