// ВРЕМЕННАЯ диагностика Telegram. Открыть:
//   https://<сайт>/api/tg-check?secret=<DIAG_SECRET>            — проверка токена, chat_id, webhook
//   https://<сайт>/api/tg-check?secret=<DIAG_SECRET>&send=1     — + тестовое сообщение
// После отладки удалите файл и переменную DIAG_SECRET.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');

async function tg(token, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params ?? {}),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => null);
  return { http: res.status, ...(data ?? { ok: false, description: 'не JSON' }) };
}

export async function GET(req) {
  const url = new URL(req.url);
  const diagSecret = clean(process.env.DIAG_SECRET);
  if (!diagSecret || url.searchParams.get('secret') !== diagSecret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rawToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const rawChat = process.env.TELEGRAM_CHAT_ID ?? '';
  const token = clean(rawToken);
  const chatId = clean(rawChat);

  const report = {
    env: {
      TELEGRAM_BOT_TOKEN: {
        set: !!token,
        looksValid: /^\d{6,}:[\w-]{30,}$/.test(token),
        hadQuotesOrSpaces: rawToken !== token,
      },
      TELEGRAM_CHAT_ID: { set: !!chatId, value: chatId, hadQuotesOrSpaces: rawChat !== chatId },
      GROQ_API_KEY: { set: !!clean(process.env.GROQ_API_KEY) },
      NEXT_PUBLIC_SUPABASE_URL: { set: !!clean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
      SUPABASE_SERVICE_ROLE_KEY: { set: !!clean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    },
  };

  if (!token) return NextResponse.json({ ...report, stop: 'TELEGRAM_BOT_TOKEN не задан в runtime' });

  try {
    const me = await tg(token, 'getMe');
    report.getMe = me.ok ? { ok: true, username: me.result?.username } : me;

    const wh = await tg(token, 'getWebhookInfo');
    report.webhook = wh.ok
      ? { url: wh.result?.url || '(не задан)', pending: wh.result?.pending_update_count, lastError: wh.result?.last_error_message }
      : wh;

    if (chatId) {
      const chat = await tg(token, 'getChat', { chat_id: chatId });
      report.getChat = chat.ok
        ? { ok: true, type: chat.result?.type, title: chat.result?.title ?? chat.result?.first_name }
        : chat;
    }

    if (url.searchParams.get('send') === '1' && chatId) {
      report.testSend = await tg(token, 'sendMessage', { chat_id: chatId, text: '✅ Тест с Netlify: бот может писать в этот чат' });
    }
  } catch (e) {
    report.networkError = String(e?.message ?? e).replaceAll(token, '***');
  }

  return NextResponse.json(report);
}
