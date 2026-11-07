'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import Pagination from './Pagination';

interface Product {
  id: string | number;
  title: string | null;
  description: string | null;
  image_url: string | null;
  customer_name: string | null;
}

interface AnnouncementSectionProps {
  categoryId?: number | null;
}

const ITEMS_PER_PAGE = 10;

export default function AnnouncementSection({ categoryId = null }: AnnouncementSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select('*, categories(name)', { count: 'exact' });

      // Фильтруем только когда выбрана конкретная категория
      if (categoryId !== null) {
        query = query.eq('category_id', categoryId);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (cancelled) return;

      if (error) {
        console.error('Ошибка загрузки объявлений:', error);
        setProducts([]);
        setTotalPages(1);
      } else {
        setProducts((data as Product[] | null) ?? []);
        setTotalPages(Math.max(1, Math.ceil((count ?? 0) / ITEMS_PER_PAGE)));
      }

      setLoading(false);
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [currentPage, categoryId]);

  return (
    <section className="mx-auto w-full max-w-[1156px] px-4 py-8 sm:px-6 sm:py-10">
      <h2 className="mb-5 text-xl font-bold sm:mb-8 sm:text-2xl">Рекомендации для вас</h2>

      {/* Сетка с карточками */}
      <div className="grid grid-cols-1 justify-items-center gap-4 sm:gap-6 lg:grid-cols-2">
        {products.map((item, index) => (
          <Link href={`/product/${item.id}`} key={item.id} className="w-full max-w-[496px]">
            <ProductCard product={item} index={index} />
          </Link>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="skeleton h-[150px] w-full max-w-[496px] rounded-2xl" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <p className="py-10 text-center text-gray-500">
          {categoryId === null ? 'Объявлений пока нет' : 'В этой категории пока нет объявлений'}
        </p>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page: number) => setCurrentPage(page)}
      />
    </section>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const hoverStyles = index % 2 === 0
    ? 'hover:shadow-blue-500/20 hover:border-blue-300'
    : 'hover:shadow-pink-500/20 hover:border-pink-300';

  return (
    <div
      className={`flex w-full gap-3 rounded-3xl border-2 border-transparent bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-2xl sm:h-[172px] sm:gap-4 sm:p-4 ${hoverStyles}`}
    >
      {/* Картинка: на мобильных меньше, на десктопе 140x140 */}
      <div className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-[140px] sm:w-[140px]">
        {product.image_url ? (
          <img src={product.image_url} className="h-full w-full object-cover" alt={product.title || 'Фото объявления'} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">Нет фото</div>
        )}
      </div>

      {/* Контент */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 sm:py-1">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold leading-tight text-gray-900 sm:text-lg">
            {product.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 sm:text-sm">
            {product.description}
          </p>
        </div>

        {/* АВТОР И КНОПКА */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
              {product.customer_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="truncate text-xs font-semibold text-gray-700 sm:text-sm">
              {product.customer_name || 'Пользователь'}
            </span>
          </div>
          <button
            type="button"
            aria-label="В избранное"
            className="shrink-0 text-gray-300 transition hover:text-red-500"
          >
            <Heart size={20} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
