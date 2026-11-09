'use client';

import { useState, useRef, useEffect } from 'react';
import { isPhoneRegistered, registerWithPhone } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { SEND_CODE_URL } from '@/lib/api';
import { captureEvent } from '@/lib/analytics';
import { Eye, EyeOff } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import 'react-international-phone/style.css';

interface RegisterModalProps {
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

type RegisterStep = 'phone' | 'ask-whatsapp' | 'otp' | 'password';

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) {
    const [regStep, setRegStep] = useState<RegisterStep>('phone');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [agree, setAgree] = useState(false);

    // Видимость паролей
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Ошибки анимации тряски и кастомный текст ошибки
    const [phoneError, setPhoneError] = useState(false);
    const [agreeError, setAgreeError] = useState(false);
    const [passError, setPassError] = useState(false);
    const [confirmPassError, setConfirmPassError] = useState(false);
    const [generalError, setGeneralError] = useState('');

    // Стейты для OTP кода
    const [generatedCode, setGeneratedCode] = useState('');
    const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
    const [isOtpError, setIsOtpError] = useState(false);
    const inputRefs = useRef<HTMLInputElement[]>([]);

    // Таймеры защиты от спама
    const [timer, setTimer] = useState(0);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (timer <= 0) return;
        const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
        return () => clearInterval(interval);
    }, [timer]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const resetForm = () => {
        setRegStep('phone');
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setAgree(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
        setPhoneError(false);
        setAgreeError(false);
        setPassError(false);
        setConfirmPassError(false);
        setGeneralError('');
        setGeneratedCode('');
        setOtpValues(Array(6).fill(''));
        setIsOtpError(false);
        setTimer(0);
        setAttempt(0);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    // ШАГ 1: Валидация телефона + жесткая проверка на дубликат в Supabase
    const handleCheckPhone = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneralError('');
        let hasError = false;

        if (normalizePhone(phone).length < 10) {
            setPhoneError(true);
            setTimeout(() => setPhoneError(false), 500);
            hasError = true;
        }
        if (!agree) {
            setAgreeError(true);
            setTimeout(() => setAgreeError(false), 500);
            hasError = true;
        }

        if (hasError) return;
        setLoading(true);

        try {
            // Проверяем номер через RPC: таблица users закрыта для чтения
            const { registered, error } = await isPhoneRegistered(phone);

            if (error) {
                console.error(error);
                setGeneralError('Ошибка базы данных при проверке номера.');
                return;
            }

            // Если номер уже есть в базе — стопим регистрацию и трясем инпут
            if (registered) {
                setGeneralError('Этот номер телефона уже зарегистрирован!');
                setPhoneError(true);
                setTimeout(() => setPhoneError(false), 500);
                return;
            }

            // Если всё ок — пускаем дальше к отправке WhatsApp
            setRegStep('ask-whatsapp');
        } catch (err) {
            console.error(err);
            setGeneralError('Не удалось связаться с сервером.');
        } finally {
            setLoading(false);
        }
    };

    // ШАГ 2: Отправка кода в WhatsApp через твой сервер
    const handleSendWhatsAppCode = async () => {
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
                setRegStep('otp');
                setTimer(60);
                setAttempt(1);
            } else {
                setGeneralError('Ошибка сервера при отправке WhatsApp кода.');
            }
        } catch (error) {
            console.error(error);
            setGeneralError('Не удалось связаться с сервером отправки.');
        } finally {
            setLoading(false);
        }
    };

    // Повторная отправка кода (1м -> 5м -> 15м)
    const handleResendCode = async () => {
        if (timer > 0) return;
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
                setIsOtpError(false);
                setOtpValues(Array(6).fill(''));
                if (attempt === 1) {
                    setTimer(300);
                    setAttempt(2);
                } else if (attempt >= 2) {
                    setTimer(900);
                    setAttempt(3);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Логика ввода цифр в ячейки
    const handleOtpChange = (value: string, index: number) => {
        const cleanValue = value.replace(/\D/g, '');
        if (!cleanValue) return;

        const newOtpValues = [...otpValues];
        newOtpValues[index] = cleanValue.substring(cleanValue.length - 1);
        setOtpValues(newOtpValues);
        setIsOtpError(false);

        if (index < 5 && cleanValue) {
            inputRefs.current[index + 1]?.focus();
        }
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

    // ШАГ 3: Проверка правильности OTP
    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = otpValues.join('');

        if (fullCode.length !== 6 || fullCode !== generatedCode) {
            setIsOtpError(true);
            setTimeout(() => setIsOtpError(false), 500);
            return;
        }

        setRegStep('password');
    };

    // ШАГ 4: НАПРАВЛЕНИЕ ДАННЫХ В ТАБЛИЦУ USERS В SUPABASE
    const handleFinalRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        let hasError = false;

        if (!password || password.length < 6) {
            setPassError(true);
            setTimeout(() => setPassError(false), 500);
            hasError = true;
        }
        if (!confirmPassword || password !== confirmPassword) {
            setConfirmPassError(true);
            setTimeout(() => setConfirmPassError(false), 500);
            hasError = true;
        }

        if (hasError) return;
        setLoading(true);

        try {
            // Номер и bcrypt-хеш пароля создаются внутри функции в базе
            const result = await registerWithPhone(phone, password);

            if (!result.ok) {
                if (result.error === 'phone_taken') {
                    setGeneralError('Этот номер телефона уже зарегистрирован!');
                } else if (result.error === 'password_short') {
                    setGeneralError('Пароль должен содержать не менее 6 символов');
                } else if (result.error === 'phone_invalid') {
                    setGeneralError('Введите корректный номер телефона');
                } else {
                    console.error('Ошибка регистрации:', result.message);
                    setGeneralError('Ошибка базы данных. Попробуйте позже.');
                }
                return;
            }

            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userPhone', result.phone ?? normalizePhone(phone));
            window.dispatchEvent(new Event('authChange'));

            // Ключевое событие воронки — привязываем запись сессии к регистрации
            captureEvent('user_signed_up');

            handleClose();
        } catch (err) {
            console.error(err);
            setGeneralError('Ошибка при отправке данных в Supabase.');
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

                            {/* ШАГ 1: ВВОД ТЕЛЕФОНА (С ПРОВЕРКОЙ НА ДУБЛИКАТ) */}
                            {regStep === 'phone' && (
                                <motion.div key="phone" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                                    <div className="text-center mt-2">
                                        <h2 className="text-[32px] font-bold text-[#1F1F1F] leading-tight">Регистрация</h2>
                                        <p className="text-[14px] text-[#8E8E93] mt-1">Создайте профиль, чтобы публиковать объявления</p>
                                    </div>

                                    <form onSubmit={handleCheckPhone} className="flex flex-col gap-2 items-center w-full">

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

                                        {/* Вывод ошибки о занятом номере */}
                                        {generalError && (
                                            <p className="text-[13px] text-[#EA4335] font-medium text-center px-4 mt-1">{generalError}</p>
                                        )}

                                        <motion.label variants={shakeVariants} animate={agreeError ? 'shake' : 'default'} className="w-full max-w-[360px] flex items-center gap-3 px-2 cursor-pointer mt-1">
                                            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4 rounded border-gray-300 cursor-pointer text-[#4343D9]" />
                                            <span className={`text-[13px] leading-tight ${agreeError ? 'text-[#EA4335]' : 'text-[#8E8E93]'}`}>Я согласен с условиями использования</span>
                                        </motion.label>

                                        <button type="submit" disabled={loading} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="mt-4 text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                                            {loading ? <Spinner /> : 'Продолжить'}
                                        </button>

                                        <p className="text-[13px] text-[#8E8E93] text-center mt-2">
                                            Уже есть аккаунт?{' '}
                                            <button type="button" onClick={onSwitchToLogin} className="text-[#4343D9] font-medium hover:underline focus:outline-none">Войти</button>
                                        </p>
                                    </form>
                                    <div className="h-4"></div>
                                </motion.div>
                            )}

                            {/* ШАГ 2: ПОДТВЕРЖДЕНИЕ В WHATSAPP */}
                            {regStep === 'ask-whatsapp' && (
                                <motion.div key="ask" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between py-4">
                                    <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center text-[32px] mt-4">💬</div>
                                    <div className="text-center px-4">
                                        <h3 className="text-[24px] font-bold text-[#1F1F1F]">Получить код?</h3>
                                        <p className="text-[14px] text-[#8E8E93] mt-2 leading-relaxed">Мы отправим проверочный код на WhatsApp номер: <br /><strong className="text-[#1F1F1F]">{phone}</strong></p>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full items-center">
                                        <button type="button" disabled={loading} onClick={handleSendWhatsAppCode} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="text-white font-medium text-[15px] rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                                            {loading ? <Spinner /> : 'Да, отправить код'}
                                        </button>
                                        <button type="button" onClick={() => setRegStep('phone')} className="text-[13px] text-[#8E8E93] hover:text-[#1F1F1F] py-1">Изменить номер</button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ШАГ 3: ВВОД OTP КОДА */}
                            {regStep === 'otp' && (
                                <motion.div key="otp" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                                    <div className="text-center mt-2">
                                        <h2 className="text-[32px] font-bold text-[#1F1F1F] leading-tight">Код из WhatsApp</h2>
                                        <p className="text-[14px] text-[#8E8E93] mt-1">Введите 6 цифр, отправленных на {phone}</p>
                                    </div>

                                    <form onSubmit={handleVerifyOtp} className="flex flex-col items-center gap-6 w-full">
                                        <motion.div variants={shakeVariants} animate={isOtpError ? 'shake' : 'default'} className="flex gap-2 justify-center text-[#1F1F1F]">
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

                                        <button type="button" disabled={timer > 0} onClick={handleResendCode} className={`text-[13px] font-medium transition-colors ${timer > 0 ? 'text-[#AEAEB2]' : 'text-[#4343D9] hover:underline'}`}>
                                            {timer > 0 ? `Повторный запрос через ${formatTime(timer)}` : 'Отправить код еще раз'}
                                        </button>
                                    </form>
                                    <div className="h-2"></div>
                                </motion.div>
                            )}

                            {/* ШАГ 4: СОЗДАНИЕ ПАРОЛЯ */}
                            {regStep === 'password' && (
                                <motion.div key="password" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="w-full h-full flex flex-col items-center justify-between">
                                    <div className="text-center mt-2">
                                        <h2 className="text-[32px] font-bold text-[#1F1F1F] leading-tight">Придумайте пароль</h2>
                                        <p className="text-[14px] text-[#8E8E93] mt-1">Пароль должен содержать не менее 6 символов</p>
                                    </div>

                                    <form onSubmit={handleFinalRegister} className="flex flex-col gap-3 items-center w-full text-[#1F1F1F]">
                                        <motion.div variants={shakeVariants} animate={passError ? 'shake' : 'default'} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Пароль"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
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

                                        {generalError && (
                                            <p className="text-[13px] text-[#EA4335] font-medium text-center">{generalError}</p>
                                        )}

                                        <button type="submit" disabled={loading} style={{ width: '100%', maxWidth: '360px', height: '44px' }} className="mt-4 text-white font-medium text-[15px] rounded-full bg-[#4343D9] hover:bg-[#3232B8] active:scale-[0.98] transition-all flex items-center justify-center shadow-md">
                                            {loading ? <Spinner /> : 'Завершить регистрацию'}
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
