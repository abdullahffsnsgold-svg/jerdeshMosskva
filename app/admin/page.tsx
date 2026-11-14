'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  Film,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface Stats {
  products: number;
  users: number;
  stories: number;
  comments: number;
  categories: number;
}

interface ProductRow {
  id: number;
  title: string | null;
  price: number | null;
  location: string | null;
  views: number | null;
  customer_name: string | null;
  customer_number: string | null;
  created_at: string | null;
  categories?: { name: string } | { name: string }[] | null;
}

interface StoryRow {
  id: number;
  title: string | null;
  text: string | null;
  media_type: string | null;
  media_url: string;
  customer_number: string | null;
  created_at: string | null;
}

interface CommentRow {
  id: number;
  text: string;
  username: string | null;
  created_at: string | null;
  product_id: number;
  products?: { title: string } | { title: string }[] | null;
}

interface UserRow {
  id: number;
  phone: string;
  created_at: string | null;
}

interface CategoryRow {
  id: number;
  name: string;
}

interface AdminData {
  stats: Stats;
  products: ProductRow[];
  stories: StoryRow[];
  comments: CommentRow[];
  users: UserRow[];
  categories: CategoryRow[];
  limit: number;
}

type TabKey = 'products' | 'stories' | 'comments' | 'users' | 'categories';

const TABS: { key: TabKey; label: string; icon: typeof ShoppingBag }[] = [
  { key: 'products', label: 'Объявления', icon: ShoppingBag },
  { key: 'stories', label: 'Сторис', icon: Film },
  { key: 'comments', label: 'Комментарии', icon: MessageSquare },
  { key: 'users', label: 'Пользователи', icon: Users },
  { key: 'categories', label: 'Категории', icon: Tag },
];

/** Supabase отдаёт связь и объектом, и массивом — приводим к строке */
function relationName(
  value: { name?: string } | { name?: string }[] | null | undefined,
  fallback: string,
) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.name ?? fallback;
}

function relationTitle(value: { title?: string } | { title?: string }[] | null | undefined) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.title ?? 'объявление удалено';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return 'цена не указана';
  return `${Number(value).toLocaleString('ru-RU')} сом`;
}

const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" />;

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(true);
  const [databaseConfigured, setDatabaseConfigured] = useState(true);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [data, setData] = useState<AdminData | null>(null);
  const [dataError, setDataError] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const [tab, setTab] = useState<TabKey>('products');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setDataError('');

    try {
      const response = await fetch('/api/admin/data', { cache: 'no-store' });

      if (response.status === 401) {
        setAuthenticated(false);
        setData(null);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | (AdminData & { ok: boolean; message?: string })
        | null;

      if (!response.ok || !payload?.ok) {
        setDataError(payload?.message ?? 'Не удалось загрузить данные.');
        return;
      }

      setData(payload);
    } catch {
      setDataError('Нет связи с сервером. Проверьте интернет и обновите страницу.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Проверяем сессию при открытии страницы
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/session', { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as
          | {
              authenticated?: boolean;
              passwordConfigured?: boolean;
              databaseConfigured?: boolean;
              setupHint?: string | null;
            }
          | null;

        if (cancelled) return;

        setPasswordConfigured(payload?.passwordConfigured ?? true);
        setDatabaseConfigured(payload?.databaseConfigured ?? true);
        setSetupHint(payload?.setupHint ?? null);

        const isSignedIn = Boolean(payload?.authenticated);
        setAuthenticated(isSignedIn);

        if (isSignedIn) await loadData();
      } catch {
        if (!cancelled) setLoginError('Нет связи с сервером.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');

    if (!password) {
      setLoginError('Введите пароль.');
      return;
    }

    setLoggingIn(true);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setLoginError(payload?.message ?? 'Не удалось войти.');
        return;
      }

      setPassword('');
      setAuthenticated(true);
      await loadData();
    } catch {
      setLoginError('Нет связи с сервером. Попробуйте снова.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => null);
    setAuthenticated(false);
    setData(null);
    setConfirming(null);
    setTab('products');
  };

  const runAction = async (action: string, body: Record<string, unknown>, key: string) => {
    setBusyId(key);
    setActionError('');

    try {
      const response = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (response.status === 401) {
        setAuthenticated(false);
        return false;
      }

      if (!response.ok || !payload?.ok) {
        setActionError(payload?.message ?? 'Действие не выполнено.');
        return false;
      }

      setConfirming(null);
      await loadData();
      return true;
    } catch {
      setActionError('Нет связи с сервером.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newCategory.trim().length < 2) {
      setActionError('Название категории — от 2 символов.');
      return;
    }

    setAddingCategory(true);
    const done = await runAction('add_category', { name: newCategory.trim() }, 'add-category');
    setAddingCategory(false);

    if (done) setNewCategory('');
  };

  // ---------- Экран проверки сессии ----------
  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-[#4343D9]" />
      </main>
    );
  }

  // ---------- Вход ----------
  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#4343D9]/10 text-[#4343D9]">
              <Lock size={22} />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Админка Jerdesh</h1>
            <p className="mt-1 text-sm text-gray-500">Доступ по паролю администратора</p>
          </div>

          {!passwordConfigured && (
            <div className="mb-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-[13px] leading-snug text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Переменная <code className="font-mono">ADMIN_PASSWORD</code> не задана на этом деплое.
                Добавьте её в настройках проекта и перезапустите сборку.
              </span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-3" noValidate>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setLoginError('');
              }}
              placeholder="Пароль"
              autoComplete="current-password"
              aria-label="Пароль администратора"
              className="h-11 w-full rounded-full border border-gray-200 px-5 text-base text-gray-900 outline-none transition-colors placeholder-gray-400 focus:border-[#4343D9]"
            />

            {loginError && (
              <p role="alert" className="text-[13px] font-medium leading-snug text-red-600">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn || !passwordConfigured}
              className={`flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white transition-all active:scale-[0.98] ${
                loggingIn || !passwordConfigured
                  ? 'cursor-not-allowed bg-gray-300'
                  : 'bg-[#4343D9] shadow-md shadow-[#4343D9]/20 hover:bg-[#3232B8]'
              }`}
            >
              {loggingIn ? <Spinner /> : 'Войти'}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-gray-500">
            <Link href="/" className="hover:text-gray-900 hover:underline">
              Вернуться на сайт
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const stats = data?.stats;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4343D9]/10 text-[#4343D9]">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight text-gray-900 sm:text-lg">Админка</h1>
              <p className="text-[11px] text-gray-500 sm:text-xs">Jerdesh — Moscow</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loadingData}
              className="flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {loadingData ? <Spinner /> : <RefreshCw size={14} />}
              Обновить
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <LogOut size={14} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        {!databaseConfigured && setupHint && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-snug text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{setupHint}</span>
          </div>
        )}

        {dataError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-red-700"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {[
            { key: 'products', label: 'Объявления', icon: ShoppingBag, value: stats?.products },
            { key: 'users', label: 'Пользователи', icon: Users, value: stats?.users },
            { key: 'stories', label: 'Сторис', icon: Film, value: stats?.stories },
            { key: 'comments', label: 'Комментарии', icon: MessageSquare, value: stats?.comments },
            { key: 'categories', label: 'Категории', icon: Tag, value: stats?.categories },
          ].map(({ key, label, icon: Icon, value }) => (
            <div key={key} className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Icon size={14} />
                <span className="truncate text-[11px] font-medium sm:text-xs">{label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                {value === undefined ? '—' : value}
              </p>
            </div>
          ))}
        </div>

        {/* Разделы */}
        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1 sm:mt-6">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = tab === key;
            const count = stats?.[key];

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setConfirming(null);
                  setActionError('');
                }}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors sm:text-sm ${
                  isActive
                    ? 'bg-[#4343D9] text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
                {count !== undefined && (
                  <span className={isActive ? 'text-white/70' : 'text-gray-400'}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {actionError && (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Скрыть">
              <X size={14} />
            </button>
          </div>
        )}

        <section className="mt-3 space-y-2">
          {loadingData && !data && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-10 text-sm text-gray-500">
              <Spinner />
              Загружаем данные…
            </div>
          )}

          {/* ---------- Объявления ---------- */}
          {tab === 'products' &&
            data?.products.map((product) => {
              const key = `delete_product-${product.id}`;

              return (
                <Row
                  key={product.id}
                  title={product.title || 'Без названия'}
                  badge={relationName(product.categories, 'без категории')}
                  meta={[
                    formatPrice(product.price),
                    product.location,
                    product.customer_name,
                    formatDate(product.created_at),
                  ]}
                  busy={busyId === key}
                  confirming={confirming === key}
                  onAskDelete={() => setConfirming(key)}
                  onCancel={() => setConfirming(null)}
                  onDelete={() => void runAction('delete_product', { id: product.id }, key)}
                />
              );
            })}

          {/* ---------- Сторис ---------- */}
          {tab === 'stories' &&
            data?.stories.map((story) => {
              const key = `delete_story-${story.id}`;

              return (
                <Row
                  key={story.id}
                  title={story.title || story.text || 'Сторис без подписи'}
                  badge={story.media_type === 'video' ? 'видео' : 'фото'}
                  meta={[
                    story.customer_number,
                    formatDate(story.created_at),
                    <a
                      key="open"
                      href={story.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#4343D9] hover:underline"
                    >
                      открыть файл
                    </a>,
                  ]}
                  busy={busyId === key}
                  confirming={confirming === key}
                  onAskDelete={() => setConfirming(key)}
                  onCancel={() => setConfirming(null)}
                  onDelete={() => void runAction('delete_story', { id: story.id }, key)}
                />
              );
            })}

          {/* ---------- Комментарии ---------- */}
          {tab === 'comments' &&
            data?.comments.map((comment) => {
              const key = `delete_comment-${comment.id}`;

              return (
                <Row
                  key={comment.id}
                  title={comment.text}
                  badge={relationTitle(comment.products)}
                  meta={[comment.username || 'Гость', formatDate(comment.created_at)]}
                  busy={busyId === key}
                  confirming={confirming === key}
                  onAskDelete={() => setConfirming(key)}
                  onCancel={() => setConfirming(null)}
                  onDelete={() => void runAction('delete_comment', { id: comment.id }, key)}
                />
              );
            })}

          {/* ---------- Пользователи ---------- */}
          {tab === 'users' &&
            data?.users.map((user) => {
              const key = `delete_user-${user.id}`;

              return (
                <Row
                  key={user.id}
                  icon={<Phone size={15} />}
                  title={`+${user.phone}`}
                  badge={`id ${user.id}`}
                  meta={[`Регистрация: ${formatDate(user.created_at)}`]}
                  busy={busyId === key}
                  confirming={confirming === key}
                  onAskDelete={() => setConfirming(key)}
                  onCancel={() => setConfirming(null)}
                  onDelete={() => void runAction('delete_user', { id: user.id }, key)}
                />
              );
            })}

          {/* ---------- Категории ---------- */}
          {tab === 'categories' && (
            <>
              <form
                onSubmit={handleAddCategory}
                className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center"
              >
                <input
                  value={newCategory}
                  onChange={(event) => {
                    setNewCategory(event.target.value);
                    setActionError('');
                  }}
                  placeholder="Новая категория"
                  maxLength={40}
                  aria-label="Название новой категории"
                  className="h-10 flex-1 rounded-full border border-gray-200 px-4 text-base text-gray-900 outline-none transition-colors placeholder-gray-400 focus:border-[#4343D9] sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={addingCategory}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#4343D9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3232B8] disabled:bg-gray-300"
                >
                  {addingCategory ? <Spinner /> : <Plus size={15} />}
                  Добавить
                </button>
              </form>

              {data?.categories.map((category) => {
                const key = `delete_category-${category.id}`;

                return (
                  <Row
                    key={category.id}
                    icon={<Tag size={15} />}
                    title={category.name}
                    meta={[`id ${category.id}`]}
                    busy={busyId === key}
                    confirming={confirming === key}
                    onAskDelete={() => setConfirming(key)}
                    onCancel={() => setConfirming(null)}
                    onDelete={() => void runAction('delete_category', { id: category.id }, key)}
                    deleteNote="Объявления останутся, но без категории"
                  />
                );
              })}
            </>
          )}

          {data && isTabEmpty(tab, data) && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
              Здесь пока пусто
            </div>
          )}

          {data && isTabFull(tab, data) && (
            <p className="pt-1 text-center text-[11px] text-gray-400">
              Показаны последние {data.limit} записей
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function isTabEmpty(tab: TabKey, data: AdminData) {
  return data[tab].length === 0;
}

function isTabFull(tab: TabKey, data: AdminData) {
  return data[tab].length >= data.limit;
}

interface RowProps {
  title: string;
  badge?: string;
  meta: (string | null | undefined | React.ReactNode)[];
  icon?: React.ReactNode;
  busy: boolean;
  confirming: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  deleteNote?: string;
}

function Row({
  title,
  badge,
  meta,
  icon,
  busy,
  confirming,
  onAskDelete,
  onCancel,
  onDelete,
  deleteNote,
}: RowProps) {
  const visibleMeta = meta.filter(Boolean);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {icon && <span className="text-gray-400">{icon}</span>}
            <p className="min-w-0 break-words text-sm font-medium text-gray-900">{title}</p>
            {badge && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {badge}
              </span>
            )}
          </div>

          {visibleMeta.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500">
              {visibleMeta.map((item, index) => (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-300">·</span>}
                  {item}
                </span>
              ))}
            </p>
          )}
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? <Spinner /> : <Check size={13} />}
              Да
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
              aria-label="Отменить удаление"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskDelete}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
            Удалить
          </button>
        )}
      </div>

      {confirming && (
        <p className="mt-2 text-[12px] text-red-600">
          Удалить безвозвратно?{deleteNote ? ` ${deleteNote}.` : ''}
        </p>
      )}
    </div>
  );
}
