/** Базовый адрес серверного API (отправка OTP в WhatsApp). */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const SEND_CODE_URL = `${API_BASE_URL}/api/send-code`;
