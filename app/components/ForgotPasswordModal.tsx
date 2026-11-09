'use client';

import { useState, useRef, useEffect } from 'react';
import { isPhoneRegistered, resetPasswordWithPhone } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { SEND_CODE_URL } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import 'react-international-phone/style.css';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const stepVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } }
};

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

type ForgotStep = 'phone' | 'ask-whatsapp' | 'otp' | 'new-password';

export default function ForgotPasswordModal({ isOpen, onClose, onSwitchToLogin }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ForgotStep>('phone');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Стейты видимости паролей
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Ошибки и тряска
  const [phoneError, setPhoneError] = useState(false);
  const [passError, setPassError] = useState(false);
  const [confirmPassError, setConfirmPassError] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Стейты для OTP кода
  const [generatedCode, setGeneratedCode] = useState('');
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const [isOtpError, setIsOtpError] = useState(false);
  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Таймер повторной отправки
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const resetForm = () => {
    setStep('phone');
    setPhone('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhoneError(false);
    setPassError(false);
    setConfirmPassError(false);
    setGeneralError('');
    setGeneratedCode('');
    setOtpValues(Array(6).fill(''));
    setIsOtpError(false);
    setTimer(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ШАГ 1: Проверяем, есть ли такой телефон в базе данных
  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (normalizePhone(phone).length < 10) {
      setPhoneError(true);
      setTimeout(() => setPhoneError(false), 500);
      return;
    }

    setLoading(true);

    try {
      // Проверяем номер через RPC: таблица users закрыта для чтения
      const { registered, error } = await isPhoneRegistered(phone);

      if (error) {
        console.error(error);
        setGeneralError('Ошибка проверки номера');
        return;
      }

      if (!registered) {
        setGeneralError('Пользователь с таким номером не зарегистрирован');
        setPhoneError(true);
        setTimeout(() => setPhoneError(false), 500);
        return;
      }

      setStep('ask-whatsapp');
    } catch (err) {
      console.error(err);
      setGeneralError('Ошибка проверки номера');
    } finally {
      setLoading(false);
    }
  };

  // ШАГ 2: Отправка OTP в WhatsApp
  const handleSendCode = async () => {
    setLoading(true);
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(randomCode);

    try {
      const response = await fetch(SEND_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), code: randomCode }),
      });

      if (response.ok) {
        setOtpValues(Array(6).fill(''));
        setIsOtpError(false);
        setStep('otp');
        setTimer(60);
      } else {
        alert('Не удалось отправить код восстановления.');
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка соединения с сервером отправки.');
    } finally {
      setLoading(false);
    }
  };

  // Поведение ячеек OTP кода
  const handleOtpChange = (value: string, index: number) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return;

    const newOtpValues = [...otpValues];
    newOtpValues[index] = cleanValue.substring(cleanValue.length - 1);
    setOtpValues(newOtpValues);
    setIsOtpError(false);

    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      setIsOtpError(false);
      if (!otpValues[index] && index > 0) {
        const newOtpValues = [...otpValues];
        newOtpValues[index - 1] = '';
        setOtpValues(newOtpValues);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtpValues = [...otpValues];
        newOtpValues[index] = '';
        setOtpValues(newOtpValues);
      }
    }
  };

  // ШАГ 3: Проверка OTP кода
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpValues.join('');

    if (fullCode.length !== 6 || fullCode !== generatedCode) {
      setIsOtpError(true);
      setTimeout(() => setIsOtpError(false), 500);
      return;
    }

    setStep('new-password');
  };

  // ШАГ 4: ОБНОВЛЕНИЕ ПАРОЛЯ В ТАБЛИЦЕ USERS
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!newPassword || newPassword.length < 6) {
      setPassError(true);
      setTimeout(() => setPassError(false), 500);
      hasError = true;
    }
    if (!confirmPassword || newPassword !== confirmPassword) {
      setConfirmPassError(true);
      setTimeout(() => setConfirmPassError(false), 500);
      hasError = true;
    }

    if (hasError) return;
    setLoading(true);

    try {
      // Новый bcrypt-хеш записывается внутри функции в базе
      const result = await resetPasswordWithPhone(phone, newPassword);

      if (!result.ok) {
        if (result.error === 'not_found') {
          alert('Пользователь с таким номером не зарегистрирован');
        } else {
          console.error('Ошибка сброса пароля:', result.message);
          alert('Не удалось обновить пароль. Попробуйте позже.');
        }
        return;
      }

      alert('Пароль успешно изменен! Войдите с новым паролем.');
      resetForm();
      onSwitchToLogin(); // Переключаем на окно входа
    } catch (err) {
      console.error(err);
      alert('Произошла непредвиденная ошибка.');
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
            <AnimatePresence mode="wait">

              {/* ШАГ 1: ВВОД НОМЕРА */}
              {step === 'phone' && (
                <motion.div key="phone" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                  <div className="text-center mt-2">
                    <h2 className="text-[28px] font-bold text-[#1F1F1F] leading-tight">Восстановление</h2>
                    <p className="text-[14px] text-[#8E8E93] mt-1">Введите телефон, привязанный к вашему профилю</p>
                  </div>

                  <form onSubmit={handleCheckPhone} className="flex flex-col gap-3 items-center w-full">
                    <motion.div
                      variants={shakeVariants}
                      animate={phoneError ? 'shake' : 'default'}
                      className={`custom-phone-wrapper rounded-full border transition-all duration-300 ${
                        phoneError ? 'border-[#EA4335] bg-[#FFFBFA]' : 'border-transparent'
                      }`}
                    >
                      <PhoneInput defaultCountry="kg" value={phone} onChange={(v) => setPhone(v)} />
                    </motion.div>

                    {generalError && (
                      <p className="text-[13px] text-[#EA4335] text-center px-4 font-medium">{generalError}</p>
                    )}

                    <button type="submit" disabled={loading} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="mt-4 text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                      {loading ? <Spinner /> : 'Продолжить'}
                    </button>

                    <button type="button" onClick={onSwitchToLogin} className="text-[13px] text-[#4343D9] font-medium hover:underline mt-2">
                      Вернуться назад
                    </button>
                  </form>
                  <div className="h-4"></div>
                </motion.div>
              )}

              {/* ШАГ 2: ПОДТВЕРЖДЕНИЕ ОТПРАВКИ */}
              {step === 'ask-whatsapp' && (
                <motion.div key="ask" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4343D9]/10 text-[32px] text-[#4343D9]">✉️</div>
                  <div className="text-center px-4">
                    <h3 className="text-[24px] font-bold text-[#1F1F1F]">Сбросить пароль?</h3>
                    <p className="text-[14px] text-[#8E8E93] mt-2 leading-relaxed">Мы отправим одноразовый код по SMS на номер: <br/><strong className="text-[#1F1F1F]">{phone}</strong></p>
                  </div>
                  <div className="flex flex-col gap-2 w-full items-center">
                    <button type="button" disabled={loading} onClick={handleSendCode} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                      {loading ? <Spinner /> : 'Отправить код по SMS'}
                    </button>
                    <button type="button" onClick={() => setStep('phone')} className="text-[13px] text-[#8E8E93] hover:text-[#1F1F1F] py-1">Изменить номер</button>
                  </div>
                </motion.div>
              )}

              {/* ШАГ 3: ВВОД КОДА */}
              {step === 'otp' && (
                <motion.div key="otp" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                  <div className="text-center mt-2">
                    <h2 className="text-[32px] font-bold text-[#1F1F1F] leading-tight">Код сброса</h2>
                    <p className="text-[14px] text-[#8E8E93] mt-1">Введите 6 цифр из SMS для подтверждения</p>
                  </div>

                  <form onSubmit={handleVerifyOtp} className="flex flex-col items-center gap-6 w-full">
                    <motion.div variants={shakeVariants} animate={isOtpError ? 'shake' : 'default'} className="flex gap-2 justify-center">
                      {otpValues.map((val, i) => (
                        <input
                          key={i}
                          type="text"
                          maxLength={1}
                          value={val}
                          ref={(el) => { inputRefs.current[i] = el!; }}
                          onChange={(e) => handleOtpChange(e.target.value, i)}
                          onKeyDown={(e) => handleOtpKeyDown(e, i)}
                          style={{ width: '44px', height: '44px' }}
                          className={`border rounded-xl text-center text-[18px] font-bold outline-none transition-all text-[#1F1F1F] bg-white
                            ${isOtpError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] focus:border-[#4343D9]'}`}
                        />
                      ))}
                    </motion.div>

                    <button type="submit" style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all">
                      Проверить код
                    </button>

                    <button type="button" disabled={timer > 0} onClick={handleSendCode} className={`text-[13px] font-medium ${timer > 0 ? 'text-[#AEAEB2]' : 'text-[#4343D9] hover:underline'}`}>
                      {timer > 0 ? `Повторный запрос кода (${timer}с)` : 'Отправить код ещё раз'}
                    </button>
                  </form>
                  <div className="h-2"></div>
                </motion.div>
              )}

              {/* ШАГ 4: ВВОД НОВОГО ПАРОЛЯ */}
              {step === 'new-password' && (
                <motion.div key="new-password" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                  <div className="text-center mt-2">
                    <h2 className="text-[28px] font-bold text-[#1F1F1F] leading-tight">Новый пароль</h2>
                    <p className="text-[14px] text-[#8E8E93] mt-1">Придумайте новый сложный пароль</p>
                  </div>

                  <form onSubmit={handleResetPassword} className="flex flex-col gap-3 items-center w-full text-[#1F1F1F]">
                    <motion.div variants={shakeVariants} animate={passError ? 'shake' : 'default'} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Новый пароль"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`w-full h-full px-5 pr-12 rounded-full border text-base outline-none focus:border-[#4343D9] transition-all placeholder-[#C7C7CC] sm:text-[15px]
                          ${passError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] text-[#1F1F1F]'}`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1F1F1F]">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </motion.div>

                    <motion.div variants={shakeVariants} animate={confirmPassError ? 'shake' : 'default'} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Повторите пароль"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full h-full px-5 pr-12 rounded-full border text-base outline-none focus:border-[#4343D9] transition-all placeholder-[#C7C7CC] sm:text-[15px]
                          ${confirmPassError ? 'border-[#EA4335] bg-[#FFFBFA] text-[#EA4335]' : 'border-[#E5E5EA] text-[#1F1F1F]'}`}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1F1F1F]">
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </motion.div>

                    <button type="submit" disabled={loading} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="mt-4 text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                      {loading ? <Spinner /> : 'Сохранить пароль'}
                    </button>
                  </form>
                  <div className="h-4"></div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
