'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PageNav from '@/app/components/PageNav';
import { toggleFavorite, useFavoriteIds } from '@/lib/favorites';

interface FavoriteProduct {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string | null;
  customer_name: string | null;
  price: number | null;
}

export default function FavoritesPage() {
  const favoriteIds = useFavoriteIds();
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (favoriteIds.length === 0) {
        if (cancelled) return;
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('id, title, description, image_url, customer_name, price')
        .in('id', favoriteIds);

      if (cancelled) return;

      if (error) {
        console.error('Ошибка загрузки избранного:', error);
        setProducts([]);
      } else {
        // Сохраняем порядок добавления в избранное, а не порядок ответа базы
        const byId = new Map(
          ((data as FavoriteProduct[] | null) ?? []).map((item) => [Number(item.id), item]),
        );
        setProducts(
          favoriteIds
            .map((id) => byId.get(id))
            .filter((item): item is FavoriteProduct => Boolean(item)),
        );
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [favoriteIds]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1a1a1a]">
      <header className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <Link href="/">
            <img src="/logo.svg" alt="Jerdesh" className="h-8 w-auto sm:h-10" />
          </Link>
          <Link
            href="/create-ad"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#3B51D5] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#2B41B7] sm:px-5 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Опубликовать объявление</span>
            <span className="sm:hidden">Опубликовать</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1156px] flex-1 px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <PageNav items={[{ label: 'Главная', href: '/' }, { label: 'Избранные' }]} />

        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Избранные</h1>
        <p className="mb-6 text-sm text-gray-500">
          {favoriteIds.length > 0
            ? `Сохранено объявлений: ${favoriteIds.length}`
            : 'Здесь появятся объявления, которые вы отметили сердечком.'}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="skeleton h-[150px] w-full rounded-3xl" />
            <div className="skeleton h-[150px] w-full rounded-3xl" />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 py-16 text-center">
            <Heart className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="mb-1 text-lg font-semibold">В избранном пока пусто</p>
            <p className="mb-6 text-sm text-gray-500">
              Нажмите на сердечко в объявлении, чтобы сохранить его здесь.
            </p>
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-[#3B51D5] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2B41B7]"
            >
              Смотреть объявления
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:gap-6 lg:grid-cols-2">
            {products.map((product) => (
              <article
                key={product.id}
                className="relative flex w-full max-w-[496px] gap-3 rounded-3xl border-2 border-transparent bg-white p-3 shadow-sm transition-all duration-300 hover:border-pink-300 hover:shadow-2xl hover:shadow-pink-500/20 sm:h-[172px] sm:gap-4 sm:p-4"
              >
                <Link
                  href={`/product/${product.id}`}
                  className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-[140px] sm:w-[140px]"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      className="h-full w-full object-cover"
                      alt={product.title || 'Фото объявления'}
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-gray-400">
                      Нет фото
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 sm:py-1">
                  <Link href={`/product/${product.id}`} className="min-w-0">
                    <h2 className="truncate text-base font-bold leading-tight text-gray-900 sm:text-lg">
                      {product.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 sm:text-sm">
                      {product.description}
                    </p>
                  </Link>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                        {product.customer_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="truncate text-xs font-semibold text-gray-700 sm:text-sm">
                        {product.customer_name || 'Пользователь'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {product.price != null && (
                        <span className="text-sm font-bold text-[#5B5BFF]">
                          {product.price.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(Number(product.id))}
                        aria-label="Убрать из избранного"
                        aria-pressed
                        className="text-red-500 transition hover:text-red-600"
                      >
                        <Heart size={20} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
