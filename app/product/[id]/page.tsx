'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Phone,
  MapPin,
  Eye,
  Calendar,
  User,
  DollarSign,
  AlertTriangle,
  Heart,
  Plus
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import AuthModal from '@/app/components/AuthModal';
import PageNav from '@/app/components/PageNav';
import { checkIsAuth } from '@/lib/auth';
import { toggleFavorite, useFavoriteIds } from '@/lib/favorites';

interface Product {
  id: string | number;
  title: string | null;
  description: string | null;
  price: number | null;
  location: string | null;
  views: number | null;
  image_url: string | null;
  customer_name: string | null;
  customer_number: string | null;
  created_at: string | null;
}

interface ProductWithCategory extends Product {
  categories?: { name: string } | null;
}

interface Comment {
  id: string | number;
  username: string | null;
  text: string;
  created_at?: string | null;
}

const Skeleton = ({ className }: { className: string }) => (
  <div className={`skeleton ${className} rounded-2xl`} />
);

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCommentSending, setIsCommentSending] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const favoriteIds = useFavoriteIds();

  useEffect(() => {
    const handleAuthChange = () => setIsLoggedIn(checkIsAuth());

    handleAuthChange();
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authChange', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadData = async () => {
      const [{ data: productData, error: productError }, { data: commentsData }] = await Promise.all([
        supabase.from('products').select('*, categories(name)').eq('id', id).maybeSingle(),
        supabase.from('comments').select('*').eq('product_id', id).order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      if (productError) {
        console.error('Ошибка загрузки объявления:', productError);
      }
      setProduct((productData as ProductWithCategory | null) ?? null);
      setComments((commentsData as Comment[] | null) ?? []);
      setLoading(false);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAddComment = async () => {
    // Комментарии доступны только вошедшим пользователям
    if (!isLoggedIn) {
      toast.info('Войдите, чтобы оставить комментарий');
      setIsAuthOpen(true);
      return;
    }

    const text = commentText.trim();
    if (!text || isCommentSending) return;

    setIsCommentSending(true);

    const { data, error } = await supabase
      .from('comments')
      .insert({
        product_id: id,
        text,
        username: localStorage.getItem('userPhone') || 'Пользователь',
      })
      .select()
      .single();

    if (error) {
      console.error('Ошибка добавления комментария:', error);
      toast.error('Не удалось отправить комментарий', { description: error.message });
    } else if (data) {
      // Новый комментарий показываем сразу, без перезагрузки страницы
      setComments((prev) => [data as Comment, ...prev]);
      setCommentText('');
    }

    setIsCommentSending(false);
  };

  const crumbs: { label: string; href?: string }[] = [
    { label: 'Главная', href: '/' },
    ...(product?.categories?.name ? [{ label: product.categories.name }] : []),
    ...(product?.title ? [{ label: product.title }] : []),
  ];

  const createdLabel = product?.created_at
    ? new Date(product.created_at).toLocaleDateString('ru-RU')
    : '—';

  const priceLabel = product?.price != null
    ? `${product.price.toLocaleString('ru-RU')} ₽`
    : 'Не указана';

  return (
    <div className="min-h-screen bg-[#F7F7F7] w-full text-[#1a1a1a] pb-10">
      <header className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <div className="flex items-center gap-3">
            <Link href="/">
              <img src="/logo.svg" alt="Jerdesh" className="h-8 w-auto sm:h-10" />
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/create-ad">
              <button className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#3B51D5] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#2B41B7] sm:px-5 sm:text-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Опубликовать объявление</span>
                <span className="sm:hidden">Опубликовать</span>
              </button>
            </Link>
            <Link
              href="/favorites"
              aria-label="Избранные"
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#FFD214] px-3 py-2.5 text-sm font-medium text-[#FFD214] transition-colors hover:bg-[#FFD214]/5 sm:px-5"
            >
              <Heart className="h-4 w-4 fill-none" />
              <span className="hidden sm:inline">Избранные</span>
            </Link>
            <button onClick={() => setIsAuthOpen(true)} className="flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              Войти
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <User className="h-4 w-4" />
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-4 pt-6 sm:pt-8">
        <PageNav items={crumbs} />

        {loading ? (
          /* Скелетон загрузки (размеры повторяют контент) */
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <div className="flex gap-6">
              <Skeleton className="w-[364px] h-[364px]" />
              <Skeleton className="w-[628px] h-[400px]" />
            </div>
          </div>
        ) : !product ? (
          <div className="py-20 text-center">
            <h1 className="text-2xl font-bold mb-2">Объявление не найдено</h1>
            <p className="text-[#707070] mb-6">Возможно, оно уже снято с публикации.</p>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-[#5B5BFF] px-6 py-3 text-white font-semibold">
              На главную
            </Link>
          </div>
        ) : (
          /* Твой оригинальный контент с анимацией */
          <div className="fade-in">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-[42px] lg:leading-[50px]">{product.title}</h1>
              <button
                type="button"
                onClick={() => toggleFavorite(Number(product.id))}
                aria-label={favoriteIds.includes(Number(product.id)) ? 'Убрать из избранного' : 'Добавить в избранное'}
                aria-pressed={favoriteIds.includes(Number(product.id))}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${favoriteIds.includes(Number(product.id))
                  ? 'border-red-200 bg-red-50 text-red-500'
                  : 'border-gray-200 bg-white text-gray-400 hover:text-red-500'
                  }`}
              >
                <Heart size={20} fill={favoriteIds.includes(Number(product.id)) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#707070] sm:gap-6 sm:text-[14px]">
              <span className="flex items-center gap-1"><MapPin size={16} /> {product.location || 'Не указано'}</span>
              <span className="flex items-center gap-1"><Eye size={16} /> {product.views || 0} просмотров</span>
              <span className="flex items-center gap-1"><Calendar size={16} /> {createdLabel}</span>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <section className="w-full max-w-[364px]">
                <div className="mb-4 aspect-square w-full overflow-hidden rounded-[20px] bg-gray-200">
                  {product.image_url ? (
                    <img src={product.image_url} className="w-full h-full object-cover" alt={product.title || 'Фото объявления'} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Нет фото</div>
                  )}
                </div>
              </section>
              <aside className="w-full lg:w-[628px]">
                <div className="bg-[#F3F1FF] rounded-[22px] p-7">
                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] text-[#707070] mb-2 font-medium"><User size={14} /> Имя</div>
                      <p className="text-[14px] font-semibold">{product.customer_name || 'Не указано'}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] text-[#707070] mb-2 font-medium"><Phone size={14} /> Телефон</div>
                      <p className="break-all text-[14px] font-bold text-[#5B5BFF]">{product.customer_number || 'Не указан'}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[13px] text-[#707070] mb-2 font-medium"><DollarSign size={14} /> Стоимость</div>
                      <p className="text-[14px] font-semibold">{priceLabel}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <h2 className="mb-3 text-xl font-bold sm:text-[28px]">Описание</h2>
                    <p className="text-[14px] leading-[24px] text-[#5f5f5f]">{product.description || 'Описание не указано'}</p>
                  </div>
                  {product.customer_number && (
                    <a href={`tel:${product.customer_number}`} className="h-[46px] px-6 bg-[#5B5BFF] text-white rounded-full font-semibold flex items-center gap-2 w-max">
                      <Phone size={18} /> Позвонить
                    </a>
                  )}
                </div>
                <div className="mt-4 bg-[#F5F5F5] border border-[#E8E8E8] rounded-[18px] p-5 flex items-center gap-3">
                  <AlertTriangle className="text-[#707070]" size={20} />
                  <p className="text-[13px] text-[#ff0000]">Избегайте мошенничества, проверяйте перед оплатой. Администрация проекта не несет ответственности за достоверность публикуемых объявлений.</p>
                </div>
              </aside>
            </div>

            <section className="mt-12 max-w-[1034px]">
              <h2 className="mb-6 text-2xl font-bold sm:text-[32px]">Комментарии ({comments.length})</h2>
              <div className="w-full h-[54px] rounded-full bg-[#EFEFEF] px-6 flex items-center mb-10">
                {isLoggedIn ? (
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Написать комментарий"
                    className="bg-transparent outline-none flex-1 text-[15px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true)}
                    className="flex min-h-[40px] flex-1 items-center truncate text-left text-[15px] text-gray-500"
                  >
                    Войдите, чтобы оставить комментарий
                  </button>
                )}
                <button onClick={handleAddComment} disabled={isCommentSending} aria-label="Отправить комментарий" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5B5BFF] text-white disabled:opacity-50">↑</button>
              </div>
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="p-4 bg-white rounded-xl border border-[#EFEFEF]">
                    <p className="font-bold text-[14px]">{c.username || 'Гость'}</p>
                    <p className="text-[15px]">{c.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSwitchToRegister={() => {
          setIsAuthOpen(false);
          router.push('/');
        }}
        onSwitchToForgot={() => {
          setIsAuthOpen(false);
          router.push('/');
        }}
      />
    </div>
  );
}
