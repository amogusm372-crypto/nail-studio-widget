// Антиспам по IP. Два слоя: память экземпляра (быстро) + Supabase (общий для всех экземпляров Netlify).
// Если Supabase недоступен или SQL ещё не выполнен, работает только память (клиентов из-за сбоя не блокируем).
// Для чата по умолчанию 30 сообщений / 10 минут и 120 / сутки (RATE_SHORT_MAX, RATE_DAY_MAX в Netlify).
import { createHash } from 'node:crypto';

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');
const envNum = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const mem = new Map(); // key -> [timestamps]

function memCheck(key, SHORT, DAY) {
  const now = Date.now();
  const hits = (mem.get(key) || []).filter((t) => now - t < DAY.secs * 1000);
  const shortHits = hits.filter((t) => now - t < SHORT.secs * 1000).length;
  if (shortHits >= SHORT.max) return 'short';
  if (hits.length >= DAY.max) return 'day';
  hits.push(now);
  mem.set(key, hits);
  if (mem.size > 5000) mem.clear();
  return 'ok';
}

async function dbCheck(key, SHORT, DAY) {
  const base = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const svc = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!base || !svc) return null;
  try {
    const res = await fetch(`${base}/rest/v1/rpc/check_rate`, {
      method: 'POST',
      headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_key: key,
        p_max_short: SHORT.max,
        p_short_secs: SHORT.secs,
        p_max_day: DAY.max,
        p_day_secs: DAY.secs,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      console.warn(`[rate] check_rate HTTP ${res.status} (выполнен ли supabase_setup_v3.sql?)`);
      return null;
    }
    const verdict = await res.json();
    return ['ok', 'short', 'day'].includes(verdict) ? verdict : null;
  } catch (error) {
    console.warn(`[rate] check_rate: ${String(error?.message ?? error)}`);
    return null;
  }
}

/**
 * { ok: true } или { ok: false, reason: 'short' | 'day' }.
 * scope разделяет счётчики (чат / вход в админку), shortMax и dayMax переопределяют лимиты.
 */
export async function checkRate(ip, { scope = 'chat', shortMax, dayMax } = {}) {
  const SHORT = { max: shortMax ?? envNum('RATE_SHORT_MAX', 30), secs: 10 * 60 };
  const DAY = { max: dayMax ?? envNum('RATE_DAY_MAX', 120), secs: 24 * 60 * 60 };

  // IP храним только в виде хэша.
  const salt = clean(process.env.RATE_LIMIT_SALT) || 'chat-widget';
  const key = createHash('sha256').update(`${scope}|${ip}|${salt}`).digest('hex').slice(0, 32);

  const local = memCheck(key, SHORT, DAY);
  if (local !== 'ok') return { ok: false, reason: local };

  const remote = await dbCheck(key, SHORT, DAY);
  if (remote && remote !== 'ok') return { ok: false, reason: remote };
  return { ok: true };
}
