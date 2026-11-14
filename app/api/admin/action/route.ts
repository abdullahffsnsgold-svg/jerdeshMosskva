import { NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin/session';
import { SERVICE_ROLE_HINT, createAdminClient } from '@/lib/admin/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action =
  | 'delete_product'
  | 'delete_story'
  | 'delete_comment'
  | 'delete_user'
  | 'add_category'
  | 'delete_category';

const TABLES: Record<string, string> = {
  delete_product: 'products',
  delete_story: 'user_stories',
  delete_comment: 'comments',
  delete_user: 'users',
  delete_category: 'categories',
};

export async function POST(request: Request) {
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

  let payload: { action?: unknown; id?: unknown; name?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, message: 'Некорректный запрос.' }, { status: 400 });
  }

  const action = payload.action as Action;

  // ---------- Добавление категории ----------
  if (action === 'add_category') {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';

    if (name.length < 2 || name.length > 40) {
      return NextResponse.json(
        { ok: false, message: 'Название категории — от 2 до 40 символов.' },
        { status: 400 },
      );
    }

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { ok: false, message: 'Такая категория уже есть.' },
        { status: 409 },
      );
    }

    const { error } = await supabase.from('categories').insert({ name });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  }

  // ---------- Удаление записи ----------
  const table = TABLES[action];

  if (!table) {
    return NextResponse.json({ ok: false, message: 'Неизвестное действие.' }, { status: 400 });
  }

  const id = Number(payload.id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: 'Некорректный id.' }, { status: 400 });
  }

  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  }

  if (!count) {
    return NextResponse.json(
      { ok: false, message: 'Запись уже удалена — обновите список.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
