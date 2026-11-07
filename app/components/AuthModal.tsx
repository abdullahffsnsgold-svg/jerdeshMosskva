'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { loginWithPhone } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { captureEvent } from '@/lib/analytics';
import { Eye, EyeOff } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import 'react-international-phone/style.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void; // Проп для переключения на восстановление
}

const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    transition: { duration: 0.4, ease: 'easeInOut' }
  },
  default: { x: 0 }
};

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default function AuthModal({ isOpen, onClose, onSwitchToRegister, onSwitchToForgot }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Стейты ошибок для анимации тряски
  const [phoneError, setPhoneError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const resetForm = () => {
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setPhoneError(false);
    setPassError(false);
    setGeneralError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
      },
    });
    if (error) console.error('Ошибка Google Auth:', error.message);
  };

  const handleDefaultLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Запрещает перезагрузку страницы
    setGeneralError('');
    let hasError = false;

    // Номер приводим к цифрам, чтобы проверка совпадала с тем, что лежит в БД
    const cleanPhone = normalizePhone(phone);

    if (cleanPhone.length < 10) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 500);
      hasError = true;
    }
    if (!password) {
      setPassError(true);
      setTimeout(() => setPassError(false), 500);
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      // Пароль сверяется с bcrypt-хешем внутри базы, таблица users клиенту недоступна
      const result = await loginWithPhone(phone, password);

      if (!result.ok) {
        if (result.error === 'not_found') {
          setGeneralError('Пользователь с таким номером не найден');
          setPhoneError(true);
          setTimeout(() => setPhoneError(false), 500);
        } else if (result.error === 'bad_password') {
          setGeneralError('Неверный пароль');
          setPassError(true);
          setTimeout(() => setPassError(false), 500);
        } else {
          console.error('Ошибка входа:', result.message);
          setGeneralError('Ошибка сервера, попробуйте позже');
        }
        return;
      }

      // Успех
      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('userPhone', result.phone ?? normalizePhone(phone));

      // Сигнал для страниц, которые слушают статус авторизации
      window.dispatchEvent(new Event('authChange'));

      // Ключевое событие воронки — привязываем запись сессии ко входу
      captureEvent('user_signed_in', { method: 'phone' });

      handleClose();
    } catch (err) {
      console.error("Ошибка в try/catch:", err);
      setGeneralError('Произошла непредвиденная ошибка при входе.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative bg-white rounded-[32px] p-6 shadow-2xl flex flex-col items-center justify-between font-sans select-none overflow-y-auto"
            style={{ width: 'calc(100vw - 24px)', maxWidth: '425px', height: '482px', maxHeight: '92dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mt-2">
              <h2 className="text-[32px] font-bold text-[#1F1F1F] leading-tight">Добро пожаловать</h2>
              <p className="text-[14px] text-[#8E8E93] mt-1">Войдите в профиль, чтобы управлять объявлениями</p>
            </div>

            <form onSubmit={handleDefaultLogin} className="flex flex-col gap-3 items-center w-full">

              {/* Номер телефона с библиотекой флагов */}
              <motion.div
                variants={shakeVariants}
                animate={phoneError ? 'shake' : 'default'}
                className={`custom-phone-wrapper rounded-full border transition-all duration-300 ${phoneError ? 'border-[#EA4335] bg-[#FFFBFA]' : 'border-transparent'
                  }`}
              >
                <PhoneInput
                  defaultCountry="kg"
                  value={phone}
                  onChange={(v) => setPhone(v)}
                />
              </motion.div>

              {/* Поле ввода пароля */}
              <motion.div
                variants={shakeVariants}
                animate={passError ? 'shake' : 'default'}
                style={{ width: '100%', maxWidth: '360px', height: '44px' }}
                className="relative"
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full h-full px-5 pr-12 rounded-full border text-[15px] outline-none focus:border-[#4343D9] transition-all placeholder-[#C7C7CC]
                    ${passError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] text-[#1F1F1F]'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1F1F1F] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </motion.div>

              {/* Ошибка валидации или бэкенда */}
              {generalError && (
                <p className="text-[13px] text-[#EA4335] font-medium text-center mt-1">{generalError}</p>
              )}

              {/* Ссылка на восстановление пароля */}
              <div className="w-full max-w-[360px] text-right px-2">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onSwitchToForgot(); }}
                  className="text-[13px] text-[#8E8E93] hover:underline hover:text-[#1F1F1F] bg-transparent border-none outline-none cursor-pointer"
                >
                  Забыли пароль?
                </button>
              </div>

              {/* Кнопка Входа */}
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', maxWidth: '360px', height: '40px' }}
                className={`mt-2 text-white font-medium text-[15px] rounded-full active:scale-[0.98] transition-all flex items-center justify-center shadow-md
                  ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#4343D9] hover:bg-[#3232B8] shadow-[#4343D9]/20'}`}
              >
                {loading ? <Spinner /> : 'Войти'}
              </button>

              <p className="text-[13px] text-[#8E8E93] text-center mt-4">
                Ещё нет аккаунта?{' '}
                <button type="button" onClick={onSwitchToRegister} className="text-[#4343D9] font-medium hover:underline focus:outline-none">Создать аккаунт</button>
              </p>
            </form>

            <div className="flex items-center justify-center gap-3 w-full max-w-[360px]">
              <div className="h-[1px] bg-[#E5E5EA] flex-1"></div>
              <span className="text-[13px] text-[#AEAEB2]">или</span>
              <div className="h-[1px] bg-[#E5E5EA] flex-1"></div>
            </div>

            {/* Google Вход */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{ width: '100%', maxWidth: '360px', height: '44px' }}
              className="mb-4 flex items-center justify-center gap-3 bg-white border border-[#E5E5EA] rounded-full text-[15px] font-medium text-[#1F1F1F] hover:bg-[#F2F2F7] active:scale-[0.98] transition-all shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.33 2.69 1.409 6.614l3.857 3.151z" />
                <path fill="#4285F4" d="M23.49 12.275c0-.796-.073-1.564-.205-2.302H12v4.353h6.441a5.514 5.514 0 01-2.39 3.614l3.714 2.879C21.937 18.847 23.49 15.86 23.49 12.275z" />
                <path fill="#FBBC05" d="M5.266 14.235A7.164 7.164 0 014.909 12c0-.783.132-1.533.357-2.235L1.41 6.614A11.933 11.933 0 000 12c0 1.92.453 3.737 1.258 5.36l4.008-3.125z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.955-1.075 7.941-2.917l-3.714-2.879c-1.03.69-2.345 1.102-4.227 1.102-3.255 0-6.014-2.195-7-5.149l-4.008 3.125C3.33 21.31 7.33 24 12 24z" />
              </svg>
              Войти через Google
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
