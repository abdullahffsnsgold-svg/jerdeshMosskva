import { supabase } from './supabase';

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
  | 'server_error';

export interface AuthResult {
  ok: boolean;
  error?: AuthError;
  /** Техническое сообщение для логов, не показывается пользователю как есть */
  message?: string;
  id?: number;
  phone?: string;
}

interface PostgrestLikeError {
  message: string;
}

const toResult = (data: unknown, error: PostgrestLikeError | null): AuthResult => {
  if (error) return { ok: false, error: 'server_error', message: error.message };

  const result = (data ?? null) as AuthResult | null;
  if (!result) return { ok: false, error: 'server_error' };

  return result;
};

/** Проверяет, занят ли номер. Пароли при этом не читаются. */
export async function isPhoneRegistered(phone: string) {
  const { data, error } = await supabase.rpc('check_phone_registered', { p_phone: phone });

  if (error) return { registered: false, error: error.message };

  return { registered: Boolean(data), error: null };
}

/** Вход: сравнение пароля с bcrypt-хешем происходит в базе. */
export async function loginWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('login_user', {
    p_phone: phone,
    p_password: password,
  });

  return toResult(data, error);
}

/** Регистрация: номер и bcrypt-хеш пароля создаются внутри функции. */
export async function registerWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('register_user', {
    p_phone: phone,
    p_password: password,
  });

  return toResult(data, error);
}

/** Сброс пароля: новый хеш записывается внутри функции. */
export async function resetPasswordWithPhone(phone: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.rpc('reset_user_password', {
    p_phone: phone,
    p_password: password,
  });

  return toResult(data, error);
}
