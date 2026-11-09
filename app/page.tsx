'use client';

import AuthModal from './components/AuthModal';
import RegisterModal from './components/RegisterModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import CategoryList, { type Category } from './components/CategoryList';
import StoriesSection from './components/StoriesSection';
import AnnouncementSection from './components/AnnouncementSection';
import PageNav from './components/PageNav';
import { checkIsAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Heart, ChevronDown } from 'lucide-react';

// Объявлен вне компонента, чтобы React не пересоздавал его на каждом рендере
const Skeleton = ({ className }: { className: string }) => (
  <div className={`skeleton ${className} rounded-2xl`} />
);

interface CategoryRow {
  id: number;
  name: string;
  products: { count: number }[] | null;
}

export default function Home() {
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  const [selectedLocation, setSelectedLocation] = useState('По всей Москве');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true); // Состояние загрузки

  const locations = ['По всей Москве', 'Центр (ЦАО)', 'Север (САО)', 'Восток (ВАО)', 'Юг (ЮАО)', 'Запад (ЗАО)'];

  const activeCategoryName = activeCategoryId === null
    ? 'Во всех категориях'
    : categoryOptions.find((c) => c.id === activeCategoryId)?.name ?? 'Во всех категориях';

  useEffect(() => {
    // Имитация задержки загрузки для теста эффекта свечения
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleAuthChange = () => setIsLoggedIn(checkIsAuth());

    // Проверяем статус при монтировании
    handleAuthChange();

    // storage — вход/выход в другой вкладке, authChange — сигнал из модалок
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authChange', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, products(count)')
        .order('id', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Ошибка загрузки категорий:', error);
        return;
      }

      setCategoryOptions((data as CategoryRow[]).map((c) => ({
        id: c.id,
        name: c.name,
        count: c.products?.[0]?.count || 0,
      })));
    }

    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans antialiased">
      <header className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <div className="flex items-center gap-3">
            <div className="flex gap-1 text-[#2B41B7]"></div>
            <span>
              <img src="/logo.svg" alt="Jerdesh" className="h-8 w-auto sm:h-10" />
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => {
                // Проверяем прямо в момент клика, есть ли данные в localStorage
                const isAuth = checkIsAuth();

                if (!isAuth) {
                  setIsAuthOpen(true); // Открываем окно входа
                } else {
                  router.push('/create-ad'); // Переходим к созданию
                }
              }}
              className="flex items-center gap-1.5 rounded-full bg-[#3B51D5] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2B41B7] sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Опубликовать объявление</span>
              <span className="sm:hidden">Опубликовать</span>
            </button>

            <Link
              href="/favorites"
              aria-label="Избранные"
              className="flex items-center gap-1.5 rounded-full border border-[#FFD214] px-3 py-2.5 text-sm font-medium text-[#FFD214] transition-colors hover:bg-[#FFD214]/5 sm:px-5"
            >
              <Heart className="h-4 w-4 fill-none" />
              <span className="hidden sm:inline">Избранные</span>
            </Link>
            {isLoggedIn ? (
              <button
                onClick={() => {
                  localStorage.removeItem('isAuth');
                  localStorage.removeItem('userPhone');
                  window.dispatchEvent(new Event('authChange')); // Сигнал для выхода
                }}
                className="rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Выйти
              </button>
            ) : (
              <button className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50" onClick={() => setIsAuthOpen(true)}>
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1552px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <PageNav
          showBack={false}
          className="mb-3"
          items={activeCategoryId === null
            ? [{ label: 'Главная' }]
            : [{ label: 'Главная' }, { label: activeCategoryName }]}
        />

        <div className="flex items-center">
          <button className="rounded-t-2xl bg-[#08004D] px-6 py-3 text-sm font-medium text-white">
            Мои подписки
          </button>
          <button className="rounded-t-2xl bg-[#08004D]/10 px-6 py-3 text-sm font-medium text-[#08004D] hover:bg-[#08004D]/20">
            Все
          </button>
        </div>

        {loading ? (
          <div className="relative min-h-[241px] w-full rounded-b-3xl rounded-tr-3xl bg-gray-100 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
            <Skeleton className="mb-6 h-10 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="relative w-full rounded-b-3xl rounded-tr-3xl bg-gradient-to-r from-[#08004D] to-[#1d039e] px-4 py-6 text-white sm:px-8 sm:py-8 lg:px-12 lg:py-10">

            <div className="relative z-10 flex max-w-4xl flex-col justify-between gap-5 sm:h-full sm:gap-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Онлайн-платформа по поиску работы в Москве!
              </h1>
              <div className="w-full rounded-3xl bg-[#1F177C] p-2 sm:rounded-full sm:p-[20px]">
                <div className="flex w-full flex-col gap-1 rounded-2xl bg-white p-1 shadow-lg sm:flex-row sm:items-center sm:gap-0 sm:rounded-full">
                  <div className="min-w-0 flex-1 px-3 sm:px-4">
                    <input
                      type="text"
                      placeholder="Поиск"
                      className="w-full bg-transparent py-2 text-gray-900 placeholder-gray-400 outline-none"
                    />
                  </div>


                  <div className="hidden h-6 w-px bg-gray-200 sm:block"></div>

                  <div className="relative min-w-0 px-3 sm:px-4">
                    <button
                      onClick={() => {
                        setIsLocationOpen(!isLocationOpen);
                        setIsCategoryOpen(false);
                      }}
                      className="flex items-center text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      <span className="text-sm select-none">{selectedLocation}</span>
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${isLocationOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div className={`absolute left-0 z-50 mt-2 w-full min-w-[14rem] max-w-[18rem] rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl transition-all duration-300 ease-in-out sm:mt-4 ${isLocationOpen
                      ? 'opacity-100 visible translate-y-0'
                      : 'opacity-0 invisible -translate-y-2 pointer-events-none'
                      }`}>
                      {locations.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => {
                            setSelectedLocation(loc);
                            setIsLocationOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${selectedLocation === loc ? 'bg-[#2B41B7]/10 text-[#2B41B7] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="hidden h-6 w-px bg-gray-200 sm:block"></div>

                  <div className="relative min-w-0 px-3 sm:px-4">
                    <button
                      onClick={() => {
                        setIsCategoryOpen(!isCategoryOpen);
                        setIsLocationOpen(false);
                      }}
                      className="flex items-center text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      <span className="text-sm select-none">{activeCategoryName}</span>
                      <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div className={`absolute left-0 z-50 mt-2 w-full min-w-[14rem] max-w-[18rem] rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl transition-all duration-300 ease-in-out sm:mt-4 ${isCategoryOpen
                      ? 'opacity-100 visible translate-y-0'
                      : 'opacity-0 invisible -translate-y-2 pointer-events-none'
                      }`}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategoryId(null);
                          setIsCategoryOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${activeCategoryId === null ? 'bg-[#2B41B7]/10 text-[#2B41B7] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        Во всех категориях
                      </button>
                      {categoryOptions.map((cat) => (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => {
                            setActiveCategoryId(cat.id);
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm rounded-xl transition-colors ${activeCategoryId === cat.id ? 'bg-[#2B41B7]/10 text-[#2B41B7] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Найти"
                    className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full bg-[#2B41B7] text-white transition-colors hover:bg-[#1605C9]"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 overflow-hidden rounded-b-3xl rounded-tr-3xl pointer-events-none">
              <div className="absolute bottom-0 right-0 h-[280px] w-[280px] translate-x-1/2 translate-y-1/2 sm:h-[482px] sm:w-[482px]">
                <div
                  className="h-full w-full animate-spin bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: "url('/ulut.png')",
                    animationDuration: '25s'
                  }}
                />
              </div>
            </div>

          </div>
        )}

        <div className="mt-8 mb-8">
          {loading ? (
            <div className="flex gap-4">
              <Skeleton className="h-20 w-40" />
              <Skeleton className="h-20 w-40" />
            </div>
          ) : (
            <>
              <CategoryList
                categories={categoryOptions}
                activeCategoryId={activeCategoryId}
                onSelectCategory={setActiveCategoryId}
              />
              <StoriesSection />

              {/* key сбрасывает страницу и заново грузит ленту при смене категории */}
              <div className="fade-in" key={activeCategoryId ?? 'all'}>
                <AnnouncementSection categoryId={activeCategoryId} />
              </div>

            </>
          )}
        </div>

        {/* Модалки держим вне блока загрузки, чтобы кнопки входа работали сразу */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSwitchToRegister={() => {
            setIsAuthOpen(false);     // 1. Закрываем окно входа
            setIsRegisterOpen(true);  // 2. Открываем окно регистрации
          }}
          onSwitchToForgot={() => {
            setIsAuthOpen(false);     // 3. Закрываем окно входа
            setIsForgotOpen(true);    // 4. Открываем окно сброса пароля
          }}
        />

        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSwitchToLogin={() => {
            setIsRegisterOpen(false); // Закрываем регистрацию
            setIsAuthOpen(true);      // Открываем вход обратно
          }}
        />

        <ForgotPasswordModal
          isOpen={isForgotOpen}
          onClose={() => setIsForgotOpen(false)}
          onSwitchToLogin={() => {
            setIsForgotOpen(false);   // Закрываем восстановление
            setIsAuthOpen(true);      // Открываем вход обратно
          }}
        />
      </main>



      <footer className="w-full bg-[#110077] text-white">
        <div className="mx-auto max-w-[1552px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-4">
            <div className="space-y-6 lg:col-span-8">
              <h2 className="text-3xl font-bold tracking-tight">Jerdesh - Moscow</h2>

              <div className="flex max-w-md items-center rounded-full bg-white p-1 shadow-md">
                <input
                  type="text"
                  placeholder="Получить объявление по подписке в чат-бота"
                  className="w-full bg-transparent px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none"
                />
                <button className="rounded-full bg-[#2B41B7] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1605C9]">
                  Активировать
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm font-medium">
                <button className="rounded-full bg-[#2B41B7] px-4 py-1.5 text-white">
                  Русский
                </button>
                <button className="text-gray-300 transition-colors hover:text-white">
                  Кыргызча
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#229ED9] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.62.15-.15 2.71-2.48 2.76-2.7a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                  Жардаш-Москва
                </a>
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#25D366] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.167 1.451 4.814 1.452 5.413 0 9.817-4.401 9.82-9.813.002-2.622-1.018-5.086-2.873-6.944C16.497 1.99 14.041.975 11.417.975c-5.397 0-9.792 4.397-9.794 9.812-.001 1.742.474 3.442 1.378 4.945l-.993 3.626 3.71-.973zm13.12-7.37c-.3-.15-1.772-.875-2.046-.975-.274-.1-.474-.15-.674.15-.2.3-.773.975-.948 1.175-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.488-.892-.796-1.493-1.778-1.668-2.078-.175-.3-.018-.463.13-.612.134-.133.3-.349.45-.524.149-.174.2-.299.3-.499.1-.2.05-.375-.025-.524-.075-.15-.674-1.622-.924-2.222-.243-.585-.49-.505-.674-.515-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 376-.275.3-.1.05-1.05 1.05-2.35 2.35-.45 4.8 2.5 4.9.074.015 4.675 7.143 11.325 10.023 1.581.685 2.815 1.093 3.778 1.398 1.587.505 3.033.434 4.177.264 1.275-.19 2.772-.751 3.172-1.476.4-.724.4-1.349.274-1.475-.125-.125-.35-.2-.65-.35z" />
                  </svg>
                  Жардаш-Москва
                </a>
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#E1306C] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 stroke-current fill-none" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  Жардаш-Москва
                </a>
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#1877F2] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                  Жардаш-Москва
                </a>
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#229ED9] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.62.15-.15 2.71-2.48 2.76-2.7a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                  Жардаш-Москва
                </a>
                <a href="#" className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#229ED9] shadow-sm transition-transform hover:scale-[1.02]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.62.15-.15 2.71-2.48 2.76-2.7a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                  Жардаш-Москва
                </a>
              </div>
            </div>

            <div className="flex flex-col items-start space-y-4 lg:col-span-4 lg:items-end">
              <span className="text-sm font-bold tracking-wider text-gray-200">
                Наши приложения:
              </span>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a href="#" className="flex items-center gap-3 rounded-xl bg-black px-4 py-2 text-white transition-opacity hover:opacity-90 w-44">
                  <div className="text-xs">
                    <p className="text-[10px] text-gray-400 uppercase">Get it on</p>
                    <p className="text-sm font-semibold">Google Play</p>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-3 rounded-xl bg-black px-4 py-2 text-white transition-opacity hover:opacity-90 w-44">
                  <div className="text-xs">
                    <p className="text-[10px] text-gray-400 uppercase">Download on the</p>
                    <p className="text-sm font-semibold">App Store</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <hr className="my-8 border-gray-700/50" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-8 items-center bg-zinc-900 px-2 font-mono text-xs font-bold text-yellow-400 tracking-wider rounded border border-zinc-700">
                <span className="text-purple-500">BT</span>
                <span className="text-blue-500">CP</span>
                <span className="text-green-500">YT</span>
                <span className="text-white ml-1">1214</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setIsAuthOpen(true)}
                className="rounded-full bg-white px-6 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
              >
                Войти
              </button>
              <button className="flex items-center gap-2 rounded-full bg-[#229ED9] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d8ec4]">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.62.15-.15 2.71-2.48 2.76-2.7a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
                Telegram
              </button>
            </div>

            <div>
              <Link href="/create-ad">
                <button className="flex items-center gap-1.5 rounded-full bg-[#3B51D5] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2B41B7]">
                  <Plus className="h-4 w-4" />
                  Опубликовать объявление
                </button>
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 LLC. Все права защищены.</p>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <a href="#" className="hover:text-white transition-colors">О нас</a>
              <a href="#" className="hover:text-white transition-colors">Контакты</a>
              <a href="#" className="hover:text-white transition-colors">Условия использования</a>
              <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            </div>
            <p>Создание сайта PROlab Agency.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}