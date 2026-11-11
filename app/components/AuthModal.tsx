'use client';

import { useState } from 'react';
import { loginWithPhone, describeAuthError } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { captureEvent } from '@/lib/analytics';
import { Eye, EyeOff } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { motion, Variants } from 'framer-motion';
import ModalFrame from './ModalFrame';
import 'react-international-phone/style.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
}

const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, -5, 5, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
  default: { x: 0 },
};

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default function AuthModal({ isOpen, onClose, onSwitchToRegister, onSwitchToForgot }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Тряска полей и один общий текст ошибки под формой
  const [phoneError, setPhoneError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [error, setError] = useState('');

  const shake = (setter: (value: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  const resetForm = () => {
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setPhoneError(false);
    setPassError(false);
    setError('');
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanPhone = normalizePhone(phone);
    let hasError = false;

    if (cleanPhone.length < 10) {
      setError('Введите номер телефона полностью');
      shake(setPhoneError);
      hasError = true;
    }
    if (!password) {
      setError('Введите пароль');
      shake(setPassError);
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);

    try {
      // Пароль сверяется с bcrypt-хешем внутри базы, таблица users клиенту недоступна
      const result = await loginWithPhone(cleanPhone, password);

      if (!result.ok) {
        const message = describeAuthError(result.error);
        if (result.error === 'server_error' || result.error === 'db_not_ready') {
          console.error('Ошибка входа:', result.message);
        }

        setError(message);
        if (result.error === 'not_found') shake(setPhoneError);
        if (result.error === 'bad_password') shake(setPassError);
        return;
      }

      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('userPhone', result.phone ?? cleanPhone);
      window.dispatchEvent(new Event('authChange'));

      captureEvent('user_signed_in', { method: 'phone' });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Ошибка входа:', err);
      setError('Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalFrame isOpen={isOpen} onClose={handleClose} label="Вход в аккаунт" locked={loading}>
      <div className="mb-5 text-center">
        <h2 className="text-[28px] font-bold leading-tight text-[#1F1F1F] sm:text-[32px]">С возвращением</h2>
        <p className="mt-1 text-[14px] text-[#8E8E93]">Войдите, чтобы публиковать объявления и писать комментарии</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <motion.div
          variants={shakeVariants}
          animate={phoneError ? 'shake' : 'default'}
          className={`custom-phone-wrapper transition-colors ${phoneError ? 'custom-phone-wrapper--error' : ''}`}
        >
          <PhoneInput
            defaultCountry="kg"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              setError('');
            }}
            inputProps={{ name: 'phone', autoComplete: 'tel', 'aria-label': 'Номер телефона' }}
          />
        </motion.div>

        <motion.div variants={shakeVariants} animate={passError ? 'shake' : 'default'} className="relative w-full">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Пароль"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
            name="password"
            autoComplete="current-password"
            aria-label="Пароль"
            className={`h-11 w-full rounded-full border px-5 pr-12 text-base outline-none transition-all placeholder-[#C7C7CC] focus:border-[#4343D9] sm:text-[15px] ${
              passError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] text-[#1F1F1F]'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] transition-colors hover:text-[#1F1F1F]"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </motion.div>

        {error && (
          <p role="alert" className="text-[13px] font-medium leading-snug text-[#EA4335]">
            {error}
          </p>
        )}

        <div className="text-right">
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-[13px] text-[#8E8E93] hover:text-[#1F1F1F] hover:underline"
          >
            Забыли пароль?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`mt-1 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium text-white shadow-md transition-all active:scale-[0.98] ${
            loading ? 'cursor-not-allowed bg-gray-400' : 'bg-[#4343D9] shadow-[#4343D9]/20 hover:bg-[#3232B8]'
          }`}
        >
          {loading ? <Spinner /> : 'Войти'}
        </button>
      </form>

      <p className="mt-5 text-center text-[13px] text-[#8E8E93]">
        Ещё нет аккаунта?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-medium text-[#4343D9] hover:underline focus:outline-none"
        >
          Создать аккаунт
        </button>
      </p>
    </ModalFrame>
  );
}
