'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { isPhoneRegistered, resetPasswordWithPhone, describeAuthError } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { requestVerificationCode } from '@/lib/api';
import { Eye, EyeOff, MessageCircle, CheckCircle2 } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import ModalFrame from './ModalFrame';
import 'react-international-phone/style.css';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const stepVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } },
};

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

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

type ForgotStep = 'phone' | 'ask-whatsapp' | 'otp' | 'new-password' | 'done';

export default function ForgotPasswordModal({ isOpen, onClose, onSwitchToLogin }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ForgotStep>('phone');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phoneError, setPhoneError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [confirmPassError, setConfirmPassError] = useState(false);
  const [error, setError] = useState('');

  const [generatedCode, setGeneratedCode] = useState('');
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const [otpError, setOtpError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((value) => value - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const shake = (setter: (value: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  const goToStep = (next: ForgotStep) => {
    setError('');
    setStep(next);
  };

  const resetForm = () => {
    goToStep('phone');
    setPhone('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhoneError(false);
    setPassError(false);
    setConfirmPassError(false);
    setError('');
    setGeneratedCode('');
    setOtpValues(Array(6).fill(''));
    setOtpError(false);
    setTimer(0);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  // ШАГ 1: есть ли такой номер в базе
  const handleCheckPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10) {
      setError('Введите номер телефона полностью');
      shake(setPhoneError);
      return;
    }

    setLoading(true);

    try {
      // Таблица users закрыта для чтения — проверяем номер через функцию в базе
      const check = await isPhoneRegistered(cleanPhone);

      if (check.error) {
        console.error('Проверка номера:', check.message);
        setError(describeAuthError(check.error));
        return;
      }

      if (!check.registered) {
        setError('Пользователь с таким номером не зарегистрирован');
        shake(setPhoneError);
        return;
      }

      goToStep('ask-whatsapp');
    } catch (err) {
      console.error('Проверка номера:', err);
      setError('Не удалось связаться с сервером. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  // ШАГ 2: отправка кода в WhatsApp
  const sendCode = async () => {
    setLoading(true);
    setError('');
    const code = generateCode();

    const result = await requestVerificationCode(phone, code);

    if (result.ok) {
      setGeneratedCode(code);
      setOtpValues(Array(6).fill(''));
      setOtpError(false);
      setTimer(60);
      goToStep('otp');
      inputRefs.current[0]?.focus();
    } else {
      setError(result.message ?? 'Не удалось отправить код.');
    }

    setLoading(false);
  };

  // Ввод цифр: поддерживаем и посимвольный ввод, и вставку кода целиком
  const applyDigits = (rawValue: string, startIndex: number) => {
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) return;

    const next = [...otpValues];
    digits.split('').forEach((digit, offset) => {
      const position = startIndex + offset;
      if (position < next.length) next[position] = digit;
    });

    setOtpValues(next);
    setOtpError(false);
    setError('');

    const lastFilled = Math.min(startIndex + digits.length, next.length - 1);
    inputRefs.current[lastFilled]?.focus();

    const fullCode = next.join('');
    if (fullCode.length === next.length) {
      if (fullCode === generatedCode) {
        goToStep('new-password');
      } else {
        setOtpError(true);
        setError('Неверный код. Проверьте сообщение в WhatsApp.');
      }
    }
  };

  const handleOtpChange = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    applyDigits(event.target.value, index);
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    applyDigits(event.clipboardData.getData('text'), index);
  };

  const handleOtpKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Backspace') return;

    setOtpError(false);
    setError('');

    const next = [...otpValues];
    if (next[index]) {
      next[index] = '';
      setOtpValues(next);
      return;
    }

    if (index > 0) {
      next[index - 1] = '';
      setOtpValues(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ШАГ 3: проверка кода кнопкой
  const handleVerifyOtp = (event: React.FormEvent) => {
    event.preventDefault();
    const fullCode = otpValues.join('');

    if (fullCode.length !== 6) {
      setOtpError(true);
      setError('Введите все 6 цифр кода');
      return;
    }

    if (fullCode !== generatedCode) {
      setOtpError(true);
      setError('Неверный код. Проверьте сообщение в WhatsApp.');
      return;
    }

    goToStep('new-password');
  };

  // ШАГ 4: сохранение нового пароля
  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    let hasError = false;

    if (newPassword.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      shake(setPassError);
      hasError = true;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      shake(setConfirmPassError);
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);

    try {
      // Новый bcrypt-хеш записывается внутри функции в базе
      const result = await resetPasswordWithPhone(phone, newPassword);

      if (!result.ok) {
        if (result.error === 'server_error' || result.error === 'db_not_ready') {
          console.error('Ошибка сброса пароля:', result.message);
        }
        setError(describeAuthError(result.error));
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setTimer(0);
      // Экран успеха остаётся открытым: раньше сообщение стиралось при переключении на вход
      setStep('done');
    } catch (err) {
      console.error('Ошибка сброса пароля:', err);
      setError('Не удалось связаться с сервером. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalFrame isOpen={isOpen} onClose={handleClose} label="Восстановление пароля" locked={loading}>
      <AnimatePresence mode="wait">
        {/* ШАГ 1: номер телефона */}
        {step === 'phone' && (
          <motion.div
            key="phone"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <div className="text-center">
              <h2 className="text-[26px] font-bold leading-tight text-[#1F1F1F] sm:text-[32px]">Восстановление</h2>
              <p className="mt-1 text-[14px] text-[#8E8E93]">Введите телефон, привязанный к профилю</p>
            </div>

            <form onSubmit={handleCheckPhone} className="flex flex-col gap-3" noValidate>
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

              {error && (
                <p role="alert" className="text-[13px] font-medium leading-snug text-[#EA4335]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`mt-1 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium text-white shadow-md transition-all active:scale-[0.98] ${
                  loading ? 'cursor-not-allowed bg-gray-400' : 'bg-[#4343D9] hover:bg-[#3232B8]'
                }`}
              >
                {loading ? <Spinner /> : 'Продолжить'}
              </button>
            </form>

            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-center text-[13px] font-medium text-[#4343D9] hover:underline"
            >
              Вернуться ко входу
            </button>
          </motion.div>
        )}

        {/* ШАГ 2: подтверждение отправки */}
        {step === 'ask-whatsapp' && (
          <motion.div
            key="ask"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-4"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4343D9]/10">
              <MessageCircle size={30} className="text-[#4343D9]" />
            </div>

            <div className="text-center">
              <h3 className="text-[24px] font-bold text-[#1F1F1F]">Сбросить пароль?</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#8E8E93]">
                Отправим одноразовый код в WhatsApp на номер
                <br />
                <strong className="text-[#1F1F1F]">{phone}</strong>
              </p>
            </div>

            {error && (
              <p role="alert" className="text-center text-[13px] font-medium leading-snug text-[#EA4335]">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={sendCode}
              className={`flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium text-white shadow-md transition-all active:scale-[0.98] ${
                loading ? 'cursor-not-allowed bg-gray-400' : 'bg-[#4343D9] hover:bg-[#3232B8]'
              }`}
            >
              {loading ? <Spinner /> : 'Отправить код в WhatsApp'}
            </button>

            <button
              type="button"
              onClick={() => goToStep('phone')}
              className="text-[13px] text-[#8E8E93] hover:text-[#1F1F1F]"
            >
              Изменить номер
            </button>
          </motion.div>
        )}

        {/* ШАГ 3: ввод кода */}
        {step === 'otp' && (
          <motion.div
            key="otp"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-4"
          >
            <div className="text-center">
              <h2 className="text-[26px] font-bold leading-tight text-[#1F1F1F] sm:text-[32px]">Код сброса</h2>
              <p className="mt-1 text-[14px] text-[#8E8E93]">Введите 6 цифр из сообщения WhatsApp</p>
            </div>

            <form onSubmit={handleVerifyOtp} className="flex w-full flex-col items-center gap-4">
              <motion.div
                variants={shakeVariants}
                animate={otpError ? 'shake' : 'default'}
                className="flex w-full justify-center gap-2"
              >
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={value}
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
                    onChange={(event) => handleOtpChange(event, index)}
                    onPaste={(event) => handleOtpPaste(event, index)}
                    onKeyDown={(event) => handleOtpKeyDown(event, index)}
                    aria-label={`Цифра ${index + 1}`}
                    className={`h-12 w-11 rounded-xl border bg-white text-center text-[18px] font-bold text-[#1F1F1F] outline-none transition-all ${
                      otpError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] focus:border-[#4343D9]'
                    }`}
                  />
                ))}
              </motion.div>

              {error && (
                <p role="alert" className="text-center text-[13px] font-medium leading-snug text-[#EA4335]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-full bg-[#4343D9] text-[15px] font-medium text-white shadow-md transition-all hover:bg-[#3232B8] active:scale-[0.98]"
              >
                Проверить код
              </button>

              <button
                type="button"
                disabled={timer > 0 || loading}
                onClick={sendCode}
                className={`text-[13px] font-medium transition-colors ${
                  timer > 0 ? 'text-[#AEAEB2]' : 'text-[#4343D9] hover:underline'
                }`}
              >
                {timer > 0 ? `Отправить ещё раз через ${timer} с` : 'Отправить код ещё раз'}
              </button>
            </form>
          </motion.div>
        )}

        {/* ШАГ 4: новый пароль */}
        {step === 'new-password' && (
          <motion.div
            key="new-password"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <div className="text-center">
              <h2 className="text-[26px] font-bold leading-tight text-[#1F1F1F] sm:text-[32px]">Новый пароль</h2>
              <p className="mt-1 text-[14px] text-[#8E8E93]">Не менее 6 символов</p>
            </div>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-3" noValidate>
              <motion.div variants={shakeVariants} animate={passError ? 'shake' : 'default'} className="relative w-full">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Новый пароль"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError('');
                  }}
                  autoComplete="new-password"
                  aria-label="Новый пароль"
                  className={`h-11 w-full rounded-full border px-5 pr-12 text-base outline-none transition-all placeholder-[#C7C7CC] focus:border-[#4343D9] sm:text-[15px] ${
                    passError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] text-[#1F1F1F]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1F1F1F]"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </motion.div>

              <motion.div
                variants={shakeVariants}
                animate={confirmPassError ? 'shake' : 'default'}
                className="relative w-full"
              >
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError('');
                  }}
                  autoComplete="new-password"
                  aria-label="Повторите пароль"
                  className={`h-11 w-full rounded-full border px-5 pr-12 text-base outline-none transition-all placeholder-[#C7C7CC] focus:border-[#4343D9] sm:text-[15px] ${
                    confirmPassError
                      ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]'
                      : 'border-[#E5E5EA] text-[#1F1F1F]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1F1F1F]"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </motion.div>

              {error && (
                <p role="alert" className="text-[13px] font-medium leading-snug text-[#EA4335]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`mt-1 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-medium text-white shadow-md transition-all active:scale-[0.98] ${
                  loading ? 'cursor-not-allowed bg-gray-400' : 'bg-[#4343D9] hover:bg-[#3232B8]'
                }`}
              >
                {loading ? <Spinner /> : 'Сохранить пароль'}
              </button>
            </form>
          </motion.div>
        )}

        {/* ШАГ 5: успех — сообщение больше не теряется при переходе ко входу */}
        {step === 'done' && (
          <motion.div
            key="done"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center gap-4 py-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
              <CheckCircle2 size={32} className="text-[#2E7D32]" />
            </div>

            <div className="text-center">
              <h3 className="text-[24px] font-bold text-[#1F1F1F]">Пароль изменён</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#8E8E93]">
                Теперь войдите в аккаунт с новым паролем.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                onSwitchToLogin();
              }}
              className="flex h-11 w-full items-center justify-center rounded-full bg-[#4343D9] text-[15px] font-medium text-white shadow-md transition-all hover:bg-[#3232B8] active:scale-[0.98]"
            >
              Войти
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalFrame>
  );
}
