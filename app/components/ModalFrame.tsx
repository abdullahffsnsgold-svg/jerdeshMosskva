'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalFrameProps {
  isOpen: boolean;
  onClose: () => void;
  /** Название окна для экранных читалок */
  label: string;
  /** Пока идёт запрос — не закрываем случайным кликом или Escape */
  locked?: boolean;
  children: ReactNode;
}

/**
 * Общая рамка для окон входа, регистрации и восстановления пароля.
 * Высота по содержимому (раньше фиксированные 482px обрезали ошибки и лишние шаги),
 * на телефоне — «шторка» снизу, фон не прокручивается.
 */
export default function ModalFrame({ isOpen, onClose, label, locked = false, children }: ModalFrameProps) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, locked]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => {
            if (!locked) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.45 }}
            className="relative flex max-h-[92dvh] w-full max-w-[425px] flex-col overflow-y-auto rounded-t-[28px] bg-white px-6 pb-6 pt-5 font-sans shadow-2xl select-none sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#8E8E93] transition-colors hover:bg-[#F2F2F7] hover:text-[#1F1F1F]"
            >
              <X size={20} />
            </button>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
