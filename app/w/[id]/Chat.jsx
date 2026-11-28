'use client';
import { useEffect, useRef, useState } from 'react';

const THEMES = {
  sto: {
    emoji: '🔧',
    role: 'Адміністратор автосервісу',
    chips: ['Скільки коштує діагностика?', 'Хочу записатись на ремонт', 'Чи є вільний час сьогодні?'],
  },
  detailing: {
    emoji: '✨',
    role: 'Адміністратор детейлінгу',
    chips: ['Скільки коштує комплексна мийка?', 'Хочу записатись на детейлінг', 'Чи є вільний час на вихідних?'],
  },
  general: {
    emoji: '💬',
    role: 'Онлайн-адміністратор',
    chips: ['Які у вас послуги?', 'Хочу записатись', 'Скільки це коштує?'],
  },
};

const DEFAULT_WELCOME = 'Вітаю! Допоможу записатись. Напишіть, що вас цікавить.';
// Стандартное приветствие из базы (английское) заменяем украинским.
const isDbDefault = (text) => !text || /^Hi! Ask me anything/i.test(text);

const MAX_LEN = 600;
const HISTORY = 12;

const css = `
  html, body { margin: 0; background: #0b0d12; color: #e8eaf0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { min-height: 100dvh; display: flex; justify-content: center;
    background: radial-gradient(900px 480px at 50% -10%, color-mix(in srgb, var(--accent) 30%, transparent), transparent), #0b0d12; }
  .card { width: 100%; max-width: 520px; height: 100dvh; display: flex; flex-direction: column; }
  .embed.wrap { background: #0b0d12; }
  .embed .card { max-width: none; }
  .head { display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    padding-top: calc(14px + env(safe-area-inset-top, 0px)); border-bottom: 1px solid #1d212b; }
  .avatar { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 22px;
    background: color-mix(in srgb, var(--accent) 22%, #151821); box-shadow: 0 0 0 2px var(--accent), 0 0 22px color-mix(in srgb, var(--accent) 45%, transparent); }
  .who { flex: 1; min-width: 0; }
  .name { font-weight: 650; font-size: 16px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role { font-size: 12.5px; color: #8b93a7; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; flex: none; }
  .close { flex: none; width: 36px; height: 36px; border-radius: 50%; border: 0; background: #171a22; color: #c5cadb;
    font-size: 22px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
  .close:hover { background: #222736; }
  .msgs { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 6px; }
  .msg { max-width: 82%; padding: 10px 14px; border-radius: 16px; line-height: 1.4; font-size: 15px;
    white-space: pre-wrap; word-break: break-word; margin-top: 4px; }
  .bot { align-self: flex-start; background: #171a22; border: 1px solid #222736; border-bottom-left-radius: 5px; }
  .me { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 5px; margin-top: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px; align-self: flex-start; max-width: 92%; }
  .chip { background: transparent; color: #e8eaf0; border: 1px solid color-mix(in srgb, var(--accent) 70%, #2a3040);
    border-radius: 999px; padding: 8px 13px; font-size: 13.5px; cursor: pointer; text-align: left; }
  .chip:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .chip:disabled { opacity: .35; cursor: default; }
  .typing { display: inline-flex; gap: 4px; }
  .typing i { width: 6px; height: 6px; border-radius: 50%; background: #8b93a7; animation: b 1s infinite; }
  .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
  @keyframes b { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
  .foot { padding: 10px 14px; padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #1d212b; }
  .row { display: flex; gap: 8px; }
  .row input { flex: 1; min-width: 0; background: #12151c; color: #e8eaf0; border: 1px solid #262c3b;
    border-radius: 12px; padding: 12px 14px; font-size: 16px; outline: none; }
  .row input:focus { border-color: var(--accent); }
  .row button { background: var(--accent); color: #fff; border: 0; border-radius: 12px; padding: 0 18px;
    font-size: 15px; font-weight: 600; cursor: pointer; }
  .row button:disabled { opacity: .5; cursor: default; }
  .note { margin: 8px 2px 0; font-size: 11.5px; color: #6f7790; line-height: 1.35; }
`;

export default function Chat({ widget, embed = false }) {
  const theme = THEMES[widget.theme] ?? THEMES.general;
  const welcome = isDbDefault(widget.welcome) ? DEFAULT_WELCOME : widget.welcome;

  const [messages, setMessages] = useState([
    { role: 'assistant', content: welcome, chips: widget.chips?.length ? widget.chips : theme.chips },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function send(raw) {
    const text = raw.trim().slice(0, MAX_LEN);
    if (!text || loading) return;

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId: widget.slug || widget.id,
          message: text,
          history: next
            .slice(0, -1)
            .slice(-HISTORY)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.warnings) console.warn('[chat warnings]', data.warnings);

      const reply = data.reply || 'Не вдалося отримати відповідь. Спробуйте ще раз.';
      const chips = Array.isArray(data.quick_replies) ? data.quick_replies.filter((c) => typeof c === 'string') : [];
      setMessages([...next, { role: 'assistant', content: reply, chips }]);
    } catch {
      setMessages([
        ...next,
        { role: 'assistant', content: 'Не вдалося надіслати повідомлення. Перевірте інтернет і спробуйте ще раз.', chips: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function closeEmbed() {
    try {
      window.parent?.postMessage({ type: 'chat-widget:close' }, '*');
    } catch {
      /* ignore */
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={`wrap${embed ? ' embed' : ''}`} style={{ '--accent': widget.color }}>
      <style>{css}</style>
      <div className="card">
        <header className="head">
          <div className="avatar">{theme.emoji}</div>
          <div className="who">
            <div className="name">{widget.name}</div>
            <div className="role">
              <span className="dot" />
              {widget.subtitle || theme.role} · онлайн
            </div>
          </div>
          {embed && (
            <button className="close" onClick={closeEmbed} aria-label="Закрити чат" type="button">
              ×
            </button>
          )}
        </header>

        <div className="msgs">
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}>{m.content}</div>
              {m.role === 'assistant' && m.chips?.length > 0 && !(loading && i === lastIndex) && (
                <div className="chips">
                  {m.chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="chip"
                      disabled={loading || i !== lastIndex}
                      onClick={() => send(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="msg bot">
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="foot">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишіть повідомлення…"
              maxLength={MAX_LEN}
              autoComplete="off"
            />
            <button type="submit" disabled={loading || !input.trim()}>Надіслати</button>
          </form>
          <p className="note">
            Надсилаючи контактні дані, ви погоджуєтесь на їх обробку для зв’язку з вами щодо запису.
          </p>
        </footer>
      </div>
    </div>
  );
}
