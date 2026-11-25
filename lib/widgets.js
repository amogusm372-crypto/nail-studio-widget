// Общие функции для работы с клиентами (таблица public.widgets).
// Используется и API чата, и страницей /w/<id>. Только на сервере.

const env = (...names) => {
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw !== 'string') continue;
    const value = raw.trim().replace(/^["']+|["']+$/g, '').trim();
    if (value) return value;
  }
  return '';
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // ref -> { at, value }

function connection() {
  const base = env('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  return base && key ? { base, key } : null;
}

/** Найти клиента по uuid или по slug (например, "demo-sto"). Вернёт строку widgets или null. */
export async function getWidget(idOrSlug) {
  const ref = String(idOrSlug ?? '').trim().toLowerCase();
  const filter = UUID_RE.test(ref) ? `id=eq.${ref}` : SLUG_RE.test(ref) ? `slug=eq.${ref}` : null;
  if (!filter) return null;

  const hit = cache.get(ref);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const conn = connection();
  if (!conn) {
    console.error('[widgets] Supabase не настроен (нужны URL и SUPABASE_SERVICE_ROLE_KEY)');
    return null;
  }

  try {
    const res = await fetch(`${conn.base}/rest/v1/widgets?${filter}&select=*&limit=1`, {
      headers: { apikey: conn.key, Authorization: `Bearer ${conn.key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[widgets] Supabase HTTP ${res.status} при поиске клиента "${ref}"`);
      return null;
    }
    const rows = await res.json();
    const value = Array.isArray(rows) && rows[0] ? rows[0] : null;
    cache.set(ref, { at: Date.now(), value });
    if (cache.size > 200) cache.clear();
    return value;
  } catch (error) {
    console.error(`[widgets] ошибка запроса: ${String(error?.message ?? error)}`);
    return null;
  }
}

/** Только то, что можно показывать в браузере (без chat_id и прочего). */
export function publicWidget(w) {
  return {
    id: w.id,
    name: w.business_name,
    color: HEX_RE.test(w.widget_color ?? '') ? w.widget_color : '#2563eb',
    welcome: w.welcome_message ?? '',
    theme: ['sto', 'detailing', 'general'].includes(w.theme) ? w.theme : 'general',
  };
}

export function isOverLimit(w) {
  const used = Number(w?.messages_used);
  const limit = Number(w?.messages_limit);
  return Number.isFinite(used) && Number.isFinite(limit) && used >= limit;
}

/** +1 к счётчику сообщений (атомарно, через SQL-функцию из supabase_setup.sql). */
export async function incrementUsage(widgetId) {
  const conn = connection();
  if (!conn || !UUID_RE.test(String(widgetId))) return;
  try {
    const res = await fetch(`${conn.base}/rest/v1/rpc/increment_widget_usage`, {
      method: 'POST',
      headers: {
        apikey: conn.key,
        Authorization: `Bearer ${conn.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wid: widgetId }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.warn(`[widgets] счётчик не обновлён: HTTP ${res.status} (выполнен ли supabase_setup.sql?)`);
  } catch (error) {
    console.warn(`[widgets] счётчик не обновлён: ${String(error?.message ?? error)}`);
  }
}
