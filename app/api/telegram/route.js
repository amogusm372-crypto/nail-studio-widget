// Webhook бота: на /start отвечает пользователю его chat_id.
// Так клиент получает свой chat_id и присылает его вам (вписываете в widgets.telegram_chat_id).
// Регистрация (один раз, подставьте свои значения):
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<сайт>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
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
          text: `Вітаю! Це бот, який надсилатиме вам заявки з чату.\n\nВаш chat_id: ${chatId}\n\nНадішліть це число тому, хто вас підключає.`,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) console.error(`[tg-webhook] sendMessage HTTP ${res.status}`);
    } catch (e) {
      console.error('[tg-webhook] помилка відправки:', String(e?.message ?? e).replaceAll(token, '***'));
    }
  }

  // Telegram всегда ждёт 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true });
}
