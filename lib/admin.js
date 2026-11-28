// Общее для админки: вход по паролю, подпись cookie, проверка прав, работа с Supabase, валидация.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { SLUG_RE } from './slug.js';

export const COOKIE = 'admin_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MIN_PASSWORD = 8;

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID_RE.test(String(v ?? ''));

/* ------------------------------- Вход -------------------------------- */

const adminPassword = () => clean(process.env.ADMIN_PASSWORD);

/** Админка работает, только если задан ADMIN_PASSWORD длиной от 8 символов. */
export const adminConfigured = () => adminPassword().length >= MIN_PASSWORD;
export const adminConfigProblem = () =>
  !adminPassword()
    ? 'Переменная ADMIN_PASSWORD не задана в Netlify: админка закрыта.'
    : adminPassword().length < MIN_PASSWORD
      ? `ADMIN_PASSWORD короче ${MIN_PASSWORD} символов: админка закрыта.`
      : '';

const secretKey = () =>
  createHash('sha256')
    .update(`admin-session|${clean(process.env.ADMIN_SESSION_SECRET)}|${adminPassword()}`)
    .digest();
const sign = (exp) => createHmac('sha256', secretKey()).update(String(exp)).digest('hex');

export function makeToken() {
  const exp = Date.now() + SESSION_SECONDS * 1000;
  return `${exp}.${sign(exp)}`;
}

export function isAuthedToken(token) {
  if (!adminConfigured() || typeof token !== 'string') return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(sign(exp), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordOk(input) {
  if (!adminConfigured()) return false;
  const a = createHash('sha256').update(String(input ?? '')).digest();
  const b = createHash('sha256').update(adminPassword()).digest();
  return timingSafeEqual(a, b);
}

export function setSessionCookie(res) {
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
  return res;
}

export function clearSessionCookie(res) {
  res.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function cookieFromRequest(req) {
  const direct = req.cookies?.get?.(COOKIE)?.value;
  if (direct) return direct;
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function clientIp(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

/** null, если доступ разрешён; иначе готовый ответ с ошибкой. */
export function requireAdmin(req) {
  if (!adminConfigured()) return json({ error: adminConfigProblem() }, 503);

  // Защита от CSRF: изменяющие запросы только с нашего же сайта.
  if (req.method && req.method !== 'GET') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        /* пусто */
      }
      if (!host || originHost !== host) return json({ error: 'Запрос с чужого сайта отклонён' }, 403);
    }
  }

  if (!isAuthedToken(cookieFromRequest(req))) return json({ error: 'Нужен вход' }, 401);
  return null;
}

/* ------------------------------ Supabase ------------------------------ */

function connection() {
  const base = clean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  return base && key ? { base, key } : null;
}

const SB_HINTS = {
  '23505': 'Такой slug уже занят: выберите другой',
  'PGRST204': 'В таблице не хватает колонок: выполните supabase_setup_v4.sql в Supabase',
  '42703': 'В таблице не хватает колонок: выполните supabase_setup_v4.sql в Supabase',
  '23502': 'Не заполнено обязательное поле',
  '22P02': 'Некорректный формат значения',
  '42501': 'Нет прав на запись: нужен секретный (service_role) ключ',
};

/** Запрос к REST API Supabase: { ok, status, data } или { ok:false, status, error }. */
export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const conn = connection();
  if (!conn) return { ok: false, status: 500, error: 'Supabase не настроен: нужны URL и секретный ключ' };
  try {
    const res = await fetch(`${conn.base}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: conn.key,
        Authorization: `Bearer ${conn.key}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* не JSON */
    }
    if (!res.ok) {
      const hint = SB_HINTS[data?.code];
      const status = res.status === 409 ? 409 : res.status;
      return { ok: false, status, error: hint || data?.message || `Supabase HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 502, error: `Supabase: ${String(error?.message ?? error)}` };
  }
}

/** user_id владельца для новых клиентов: из ADMIN_OWNER_USER_ID или из самой старой строки widgets. */
export async function ownerUserId() {
  const fromEnv = clean(process.env.ADMIN_OWNER_USER_ID);
  if (isUuid(fromEnv)) return { ok: true, id: fromEnv };
  const r = await sb('widgets?select=user_id&order=created_at.asc&limit=1');
  if (!r.ok) return { ok: false, error: r.error };
  const id = r.data?.[0]?.user_id;
  return id ? { ok: true, id } : { ok: false, error: 'В widgets нет ни одной строки: задайте ADMIN_OWNER_USER_ID (uuid из Authentication → Users)' };
}

/* ----------------------------- Валидация ------------------------------ */

export const THEMES = ['sto', 'detailing', 'general'];
export const THEME_COLORS = { sto: '#f97316', detailing: '#22d3ee', general: '#2563eb' };
export const DEFAULT_WELCOME = 'Вітаю! Допоможу записатись. Напишіть, що вас цікавить.';

const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function cleanChipList(raw, { max = 4 } = {}) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const text = str(item, 40);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length === max) break;
  }
  return out;
}

/** Проверка и очистка данных клиента. create=true: обязательны slug и название. */
export function cleanClient(input, { create }) {
  const b = input && typeof input === 'object' ? input : {};
  const errors = [];
  const v = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

  if (create || has('slug')) {
    const slug = str(b.slug, 60).toLowerCase();
    if (!SLUG_RE.test(slug)) errors.push('slug: 2–49 символов, только латиница, цифры и дефис, начинается с буквы или цифры');
    else v.slug = slug;
  }
  if (create || has('business_name')) {
    const name = str(b.business_name, 120);
    if (!name) errors.push('Укажите название бизнеса');
    else v.business_name = name;
  }
  if (has('subtitle')) v.subtitle = str(b.subtitle, 80) || null;
  if (has('theme')) {
    if (!THEMES.includes(b.theme)) errors.push('Ниша: sto, detailing или general');
    else v.theme = b.theme;
  }
  if (has('accent_color')) {
    const c = str(b.accent_color, 7);
    if (!HEX_RE.test(c)) errors.push('Цвет: формат #rrggbb');
    else v.accent_color = c.toLowerCase();
  }
  if (has('welcome_message') || create) v.welcome_message = str(b.welcome_message, 300) || DEFAULT_WELCOME;
  if (has('start_chips')) v.start_chips = cleanChipList(b.start_chips);
  if (has('telegram_chat_id')) {
    const id = str(String(b.telegram_chat_id ?? ''), 24);
    if (id && !/^-?\d{5,20}$/.test(id)) errors.push('telegram_chat_id: только число (для группы со знаком минус)');
    else v.telegram_chat_id = id || null;
  }
  if (has('business_context') || create) v.business_context = str(b.business_context, 6000);
  if (has('is_active')) v.is_active = b.is_active !== false && b.is_active !== 'false';
  if (has('site_url')) {
    const u = str(b.site_url, 300);
    if (u && !/^https?:\/\/[^\s]+$/i.test(u)) errors.push('URL сайта: должен начинаться с http:// или https://');
    else v.site_url = u || null;
  }
  if (has('messages_limit') || create) {
    const n = Number(b.messages_limit ?? 1000);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) errors.push('Лимит сообщений: целое число от 1');
    else v.messages_limit = n;
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}
