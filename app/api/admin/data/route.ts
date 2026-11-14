import { NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin/session';
import { SERVICE_ROLE_HINT, createAdminClient } from '@/lib/admin/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIST_LIMIT = 100;

/**
 * Всё, что показывает панель: счётчики и последние записи.
 * Доступ только при живой админ-сессии, запросы идут с service-role ключом.
 */
export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'not_configured', message: SERVICE_ROLE_HINT },
      { status: 503 },
    );
  }

  const countOf = (table: string) =>
    supabase.from(table).select('*', { count: 'exact', head: true });

  const [productsCount, usersCount, storiesCount, commentsCount, categoriesCount] =
    await Promise.all([
      countOf('products'),
      countOf('users'),
      countOf('user_stories'),
      countOf('comments'),
      countOf('categories'),
    ]);

  const countError =
    productsCount.error ??
    usersCount.error ??
    storiesCount.error ??
    commentsCount.error ??
    categoriesCount.error;

  if (countError) {
    const missingTables = /does not exist|schema cache/i.test(countError.message);
    return NextResponse.json(
      {
        ok: false,
        error: missingTables ? 'schema_missing' : 'db_error',
        message: missingTables
          ? 'Таблицы не найдены: выполните supabase/schema.sql в Supabase → SQL Editor.'
          : countError.message,
      },
      { status: 502 },
    );
  }

  const [products, stories, comments, users, categories] = await Promise.all([
    supabase
      .from('products')
      .select('id, title, price, location, views, customer_name, customer_number, image_url, created_at, categories ( name )')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from('user_stories')
      .select('id, title, text, media_url, media_type, customer_number, created_at')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from('comments')
      .select('id, text, username, created_at, product_id, products ( title )')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      // Пароли (даже хеши) панель не запрашивает
      .from('users')
      .select('id, phone, created_at')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase.from('categories').select('id, name').order('name'),
  ]);

  const firstError = products.error ?? stories.error ?? comments.error ?? users.error ?? categories.error;

  if (firstError) {
    return NextResponse.json(
      { ok: false, error: 'db_error', message: firstError.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    stats: {
      products: productsCount.count ?? 0,
      users: usersCount.count ?? 0,
      stories: storiesCount.count ?? 0,
      comments: commentsCount.count ?? 0,
      categories: categoriesCount.count ?? 0,
    },
    products: products.data ?? [],
    stories: stories.data ?? [],
    comments: comments.data ?? [],
    users: users.data ?? [],
    categories: categories.data ?? [],
    limit: LIST_LIMIT,
  });
}
