// Webhook бота:
//  • /start      -> бот отвечает пользователю его chat_id (так клиент узнаёт, что вписать в widgets.telegram_chat_id);
//  • кнопка «Взять в работу» под заявкой -> меняется на «✅ Взято в работу».
// Регистрация (один раз; подставьте свои значения):
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<сайт>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
import { NextResponse } from 'next/server';
import { CB_DONE, CB_TAKE, markTaken, TG_TEXT, tgApi } from '../../../lib/telegram.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');

export async function POST(req) {
  const secret = clean(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const update = await req.json().catch(() => null);

  try {
    // 1) Нажатие inline-кнопки
    const cq = update?.callback_query;
    if (cq?.id) {
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;

      if (cq.data === CB_TAKE && chatId && messageId) {
        const edited = await tgApi('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: markTaken(cq.message.reply_markup),
        });
        if (!edited.ok) console.error(`[tg-webhook] editMessageReplyMarkup: ${edited.description}`);
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id, text: TG_TEXT.takenToast });
      } else if (cq.data === CB_DONE) {
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id, text: TG_TEXT.alreadyToast });
      } else {
        await tgApi('answerCallbackQuery', { callback_query_id: cq.id });
      }
      return NextResponse.json({ ok: true });
    }

    // 2) Сообщение /start
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    const text = typeof msg?.text === 'string' ? msg.text : '';
    if (chatId && text.startsWith('/start')) {
      const sent = await tgApi('sendMessage', {
        chat_id: chatId,
        text: `Вітаю! Це бот, який надсилатиме вам заявки з чату.\n\nВаш chat_id: ${chatId}\n\nНадішліть це число тому, хто вас підключає.`,
      });
      if (!sent.ok) console.error(`[tg-webhook] sendMessage: ${sent.description}`);
    }
  } catch (error) {
    console.error('[tg-webhook] ошибка:', String(error?.message ?? error));
  }

  // Telegram всегда ждёт 200, иначе будет повторять доставку.
  return NextResponse.json({ ok: true });
}
