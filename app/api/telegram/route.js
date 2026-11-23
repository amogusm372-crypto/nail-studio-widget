// Webhook бота: отвечает на /start и показывает chat_id.
// Регистрация (один раз, подставьте значения):
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://nail-studio-widget-demo.netlify.app/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
// TELEGRAM_WEBHOOK_SECRET — любая строка из латиницы/цифр/_/-, задаётся и в Netlify, и в setWebhook.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');

export async function POST(req) {
  const secret = clean(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = typeof msg?.text === 'string' ? msg.text : '';

  if (token && chatId && text.startsWith('/start')) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Привет! Я бот заявок студии.\nВаш chat_id: ${chatId}\nЕсли он совпадает с TELEGRAM_CHAT_ID — заявки будут приходить сюда.`,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) console.error(`[tg-webhook] sendMessage HTTP ${res.status}`);
    } catch (e) {
      console.error('[tg-webhook] ошибка отправки:', String(e?.message ?? e).replaceAll(token, '***'));
    }
  }

  // Telegram всегда ждёт 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true });
}
