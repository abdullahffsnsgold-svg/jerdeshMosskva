import { supabase } from './supabase';
import { normalizePhone } from './phone';

export const checkIsAuth = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isAuth') === 'true';
};

export type AuthError =
  | 'not_found'
  | 'bad_password'
  | 'phone_taken'
  | 'phone_invalid'
  | 'password_short'
  | 'db_not_ready'
  | 'server_error';

export interface AuthResult {
  ok: boolean;
  error?: AuthError;
  /** Техническое сообщение для логов, не показывается пользователю как есть */
  message?: string;
  id?: number;
  phone?: string;
}

export interface PhoneCheckResult {
  registered: boolean;
  error?: AuthError;
  message?: string;
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Функций входа нет в базе → supabase/secure-users.sql ещё не выполнен.
 * PostgREST отвечает PGRST202, а отсутствующий pgcrypto — «function crypt ... does not exist».
 */
const isDatabaseNotReady = (error: PostgrestLikeError) =>
  error.code === 'PGRST202' ||
  /could not find the function|schema cache|function .* does not exist/i.test(error.message ?? '');

/** Текст ошибки, который можно показать пользователю как есть. */
export const describeAuthError = (error?: AuthError): string => {
  switch (error) {
    case 'not_found':
      return 'Пользователь с таким номером не найден';
    case 'bad_password':
      return 'Неверный пароль';
    case 'phone_taken':
      return 'Этот номер телефона уже зарегистрирован';
    case 'phone_invalid':
      return 'Введите корректный номер телефона';
    case 'password_short':
      return 'Пароль должен содержать не менее 6 символов';
    case 'db_not_ready':
      return 'Сервер не настроен: выполните supabase/secure-users.sql в Supabase → SQL Editor';
    default:
      return 'Ошибка сервера, попробуйте позже';
  }
};

const toAuthError = (error: PostgrestLikeError): AuthError =>
  isDatabaseNotReady(error) ? 'db_not_ready' : 'server_error';

const toResult = (data: unknown, error: PostgrestLikeError | null): AuthResult => {
  if (error) return { ok: false, error: toAuthError(error), message: error.message };

  const result = (data ?? null) as AuthResult | null;
  // Пустая строка/пустой ответ вместо JSON — база не выполнила функцию
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'db_not_ready', message: 'Функция вернула пустой ответ' };
  }

  return result;
};

/** Проверяет, занят ли номер. Пароли при этом не читаются. */
export async function isPhoneRegistered(phone: string): Promise<PhoneCheckResult> {
  const { data, error } = await supabase.rpc('check_phone_registered', {
    p_phone: normalizePhone(phone),
  });

  if (error) return { registered: false, error: toAuthError(error), message: error.message };

  return { registered: Boolean(data) };
}

/** Вход: сравнение пароля с bcrypt-хешем происходит в базе. */
export async function loginWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('login_user', {
    p_phone: normalizePhone(phone),
    p_password: password,
  });

  return toResult(data, error);
}

/** Регистрация: номер и bcrypt-хеш пароля создаются внутри функции. */
export async function registerWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('register_user', {
    p_phone: normalizePhone(phone),
    p_password: password,
  });

  return toResult(data, error);
}

/** Сброс пароля: новый хеш записывается внутри функции. */
export async function resetPasswordWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('reset_user_password', {
    p_phone: normalizePhone(phone),
    p_password: password,
  });

  return toResult(data, error);
}
