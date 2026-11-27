// Общее для Telegram: тексты, телефоны, inline-кнопки, вызов Bot API.
// Язык уведомлений владельцу меняется здесь (TG_TEXT), больше нигде.

export const TG_TEXT = {
  newLead: 'Нова заявка',
  client: 'Клієнт',
  contact: 'Контакт',
  summary: 'Суть',
  noName: 'не вказано',
  writeBtn: '💬 Написати в Telegram',
  takeBtn: 'Взяти в роботу',
  takenBtn: '✅ Взято в роботу',
  takenToast: 'Позначено як «Взято в роботу»',
  alreadyToast: 'Вже в роботі',
};

export const CB_TAKE = 'lead_taken';
export const CB_DONE = 'lead_done';

/**
 * Приводит телефон к международному виду без «+»: 380501234567.
 * Допущение: номера без кода страны считаем украинскими.
 * Вернёт '' если цифр меньше 9 или больше 15.
 */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return '';
  if (digits.length === 9) return `380${digits}`; // 501234567
  if (digits.length === 10 && digits.startsWith('0')) return `38${digits}`; // 0501234567
  if (digits.length === 11 && digits.startsWith('80')) return `3${digits}`; // 80501234567
  return digits;
}

/** Inline-кнопки под заявкой: «Написать в Telegram» (если есть телефон/@ник) и «Взять в работу». */
export function leadKeyboard({ phone = '', handle = '' } = {}) {
  const rows = [];
  const cleanHandle = String(handle).replace(/^@/, '');
  const url = /^[1-9]\d{8,14}$/.test(phone)
    ? `https://t.me/+${phone}`
    : /^[a-z][a-z0-9_]{4,31}$/i.test(cleanHandle)
      ? `https://t.me/${cleanHandle}`
      : '';
  if (url) rows.push([{ text: TG_TEXT.writeBtn, url }]);
  rows.push([{ text: TG_TEXT.takeBtn, callback_data: CB_TAKE }]);
  return { inline_keyboard: rows };
}

/** Убирает кнопки-ссылки (если Telegram отклонил URL), оставляет остальные. */
export function stripUrlButtons(markup) {
  const rows = (markup?.inline_keyboard ?? [])
    .map((row) => row.filter((b) => !b.url))
    .filter((row) => row.length);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

/** «Взять в работу» -> «✅ Взято в работу», остальные кнопки без изменений. */
export function markTaken(markup) {
  const rows = (markup?.inline_keyboard ?? []).map((row) =>
    row.map((b) => (b.callback_data === CB_TAKE ? { text: TG_TEXT.takenBtn, callback_data: CB_DONE } : b)),
  );
  return { inline_keyboard: rows };
}

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');

/** Вызов Bot API. Токен из TELEGRAM_BOT_TOKEN; в ошибках токен скрыт. */
export async function tgApi(method, params) {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN) || clean(process.env.TELEGRAM_TOKEN);
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN не задан' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => null);
    return data ?? { ok: false, description: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, description: String(error?.message ?? error).replaceAll(token, '***') };
  }
}
