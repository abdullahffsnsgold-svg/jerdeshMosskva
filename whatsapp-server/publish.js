/**
 * Публикация адреса туннеля в Supabase.
 *
 * Сайт берёт адрес из таблицы public.gateway_config (скрипт
 * supabase/gateway-config.sql), поэтому после перезагрузки компьютера
 * не нужно вписывать новый адрес в Vercel и пересобирать проект.
 *
 * Пишем service-role ключом: он лежит только в локальном .env
 * и в браузер не попадает. Чтение таблицы открыто — адрес шлюза публичный.
 */

export async function publishGatewayUrl(url, log = console.log) {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    log(
      'Адрес не опубликован: в whatsapp-server/.env нет SUPABASE_URL или ' +
        'SUPABASE_SERVICE_ROLE_KEY.',
    );
    return false;
  }

  try {
    const response = await fetch(`${base}/rest/v1/gateway_config`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Строка одна: вставляем или обновляем её
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ id: 1, gateway_url: url, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      log(`Supabase отклонил адрес (${response.status}): ${text.slice(0, 200)}`);
      return false;
    }

    log(`Адрес ${url} сохранён в Supabase — сайт подхватит его сам.`);
    return true;
  } catch (error) {
    log(`Не удалось записать адрес в Supabase: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}
