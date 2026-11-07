'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageNavProps {
  items: Crumb[];
  backLabel?: string;
  className?: string;
  /** На главной возвращаться некуда — кнопку там скрываем */
  showBack?: boolean;
}

export default function PageNav({
  items,
  backLabel = 'Назад',
  className = '',
  showBack = true,
}: PageNavProps) {
  const router = useRouter();

  const handleBack = () => {
    // Если истории нет (открыли страницу по прямой ссылке) — уводим на главную
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-6 sm:gap-x-4 ${className}`}>
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          aria-label={backLabel}
          className="flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:px-4 sm:text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
      )}

      <nav aria-label="Хлебные крошки" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500 sm:text-sm">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className="truncate transition-colors hover:text-[#2B41B7]">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={`max-w-[16rem] truncate sm:max-w-[24rem] ${isLast ? 'font-medium text-gray-900' : ''}`}
                  >
                    {item.label}
                  </span>
                )}

                {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
