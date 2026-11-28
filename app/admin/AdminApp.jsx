'use client';
import { useCallback, useEffect, useState } from 'react';
import { slugify } from '../../lib/slug.js';

const THEMES = [
  ['sto', 'Автосервис / СТО'],
  ['detailing', 'Детейлинг / мойка'],
  ['general', 'Другое'],
];
const THEME_COLORS = { sto: '#f97316', detailing: '#22d3ee', general: '#2563eb' };

const EMPTY = {
  slug: '', business_name: '', subtitle: '', theme: 'sto', accent_color: '#f97316', welcome_message: '',
  chips: '', telegram_chat_id: '', business_context: '', is_active: true, site_url: '', messages_limit: 1000,
};

const toForm = (c) => ({
  slug: c.slug || '',
  business_name: c.business_name || '',
  subtitle: c.subtitle || '',
  theme: c.theme || 'general',
  accent_color: c.accent_color || '#f97316',
  welcome_message: c.welcome_message || '',
  chips: (Array.isArray(c.start_chips) ? c.start_chips : []).join('\n'),
  telegram_chat_id: c.telegram_chat_id || '',
  business_context: c.business_context || '',
  is_active: c.is_active !== false,
  site_url: c.site_url || '',
  messages_limit: c.messages_limit ?? 1000,
});

const fromForm = (f) => ({
  slug: f.slug.trim(),
  business_name: f.business_name.trim(),
  subtitle: f.subtitle.trim(),
  theme: f.theme,
  accent_color: f.accent_color.trim(),
  welcome_message: f.welcome_message.trim(),
  start_chips: f.chips.split('\n').map((s) => s.trim()).filter(Boolean),
  telegram_chat_id: f.telegram_chat_id.trim(),
  business_context: f.business_context,
  is_active: f.is_active,
  site_url: f.site_url.trim(),
  messages_limit: Number(f.messages_limit) || 1000,
});

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.reload();
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

const css = `
  html,body{margin:0;background:#0b0d12;color:#e8eaf0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  *{box-sizing:border-box}
  .page{max-width:1100px;margin:0 auto;padding:20px 16px 80px}
  .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
  .top h1{font-size:22px;margin:0;flex:1}
  .btn{background:#171a22;color:#e8eaf0;border:1px solid #2a3040;border-radius:10px;padding:8px 13px;font-size:14px;cursor:pointer;white-space:nowrap}
  .btn:hover:not(:disabled){background:#1f2430}
  .btn:disabled{opacity:.5;cursor:default}
  .btn.primary{background:#f97316;border-color:#f97316;color:#fff;font-weight:600}
  .btn.danger{color:#f87171;border-color:#4a2327}
  .btn.sm{padding:5px 9px;font-size:12.5px}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#16a34a;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .toast.err{background:#dc2626}
  .tablewrap{overflow-x:auto;border:1px solid #1d212b;border-radius:12px}
  table{border-collapse:collapse;width:100%;font-size:14px;min-width:820px}
  th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #1d212b;vertical-align:middle}
  th{color:#8b93a7;font-weight:500;font-size:12.5px;background:#10131a}
  tr:last-child td{border-bottom:0}
  .name{font-weight:600}
  .muted{color:#8b93a7;font-size:12.5px}
  .pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;border:1px solid;cursor:pointer;background:none}
  .pill.on{color:#34d399;border-color:#1f6f52}
  .pill.off{color:#f87171;border-color:#6f2a2a}
  .actions{display:flex;gap:6px;flex-wrap:wrap}
  .panel{background:#10131a;border:1px solid #1d212b;border-radius:14px;padding:18px;margin-bottom:22px}
  .panel h2{margin:0 0 14px;font-size:18px}
  .gen{background:#12161f;border:1px dashed #2f3850;border-radius:12px;padding:14px;margin-bottom:18px;display:grid;gap:10px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  label{display:grid;gap:5px;font-size:13px;color:#aab1c4}
  input[type=text],input[type=url],input[type=number],select,textarea{background:#0b0d12;color:#e8eaf0;border:1px solid #262c3b;border-radius:10px;padding:10px 12px;font-size:15px;font-family:inherit;width:100%}
  textarea{resize:vertical;min-height:90px}
  .full{grid-column:1/-1}
  .row{display:flex;gap:8px;align-items:center}
  input[type=color]{width:46px;height:40px;padding:2px;background:#0b0d12;border:1px solid #262c3b;border-radius:8px}
  .hint{font-size:12px;color:#6f7790}
  .warn{background:#2a2110;border:1px solid #6b5316;color:#facc15;border-radius:10px;padding:10px 12px;font-size:13px}
  .switch{display:flex;gap:8px;align-items:center;color:#e8eaf0;font-size:14px}
`;

export default function AdminApp() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | client
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genUrl, setGenUrl] = useState('');
  const [genText, setGenText] = useState('');
  const [genNote, setGenNote] = useState('');
  const [toast, setToast] = useState(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const notify = useCallback((text, err = false) => {
    setToast({ text, err });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/api/admin/clients');
      setClients(data.clients || []);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  function openNew() {
    setEditing('new');
    setForm(EMPTY);
    setSlugTouched(false);
    setGenUrl('');
    setGenText('');
    setGenNote('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEdit(c) {
    setEditing(c);
    setForm(toForm(c));
    setSlugTouched(true);
    setGenUrl(c.site_url || '');
    setGenText('');
    setGenNote('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onName(value) {
    setForm((f) => ({ ...f, business_name: value, ...(editing === 'new' && !slugTouched ? { slug: slugify(value) } : {}) }));
  }

  function onTheme(value) {
    setForm((f) => ({ ...f, theme: value, accent_color: THEME_COLORS[value] || f.accent_color }));
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = fromForm(form);
      if (editing === 'new') {
        await api('/api/admin/clients', { method: 'POST', body: JSON.stringify(payload) });
        notify('Клиент создан');
      } else {
        await api(`/api/admin/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('Сохранено');
      }
      setEditing(null);
      await load();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (editing === 'new' || !window.confirm(`Удалить клиента «${editing.business_name}»? Заявки в базе останутся.`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/clients/${editing.id}`, { method: 'DELETE' });
      notify('Удалено');
      setEditing(null);
      await load();
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c) {
    try {
      await api(`/api/admin/clients/${c.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !(c.is_active !== false) }) });
      await load();
    } catch (err) {
      notify(err.message, true);
    }
  }

  async function generate() {
    setGenBusy(true);
    setGenNote('');
    try {
      const data = await api('/api/admin/generate', { method: 'POST', body: JSON.stringify({ url: genUrl.trim(), text: genText.trim() }) });
      const d = data.draft;
      setForm((f) => ({
        ...f,
        business_name: d.business_name || f.business_name,
        slug: editing === 'new' && !slugTouched ? d.slug || f.slug : f.slug,
        subtitle: d.subtitle || f.subtitle,
        theme: d.theme,
        accent_color: d.accent_color || f.accent_color,
        welcome_message: d.welcome_message || f.welcome_message,
        chips: (d.start_chips || []).join('\n') || f.chips,
        business_context: d.business_context || f.business_context,
        site_url: d.site_url || f.site_url,
      }));
      const missing = data.notes?.missing || [];
      setGenNote(missing.length ? `Не найдено на сайте: ${missing.join(', ')}. Допишите вручную.` : 'Готово. Проверьте текст перед сохранением.');
      notify('Форма заполнена ИИ');
    } catch (err) {
      setGenNote(err.message);
      notify('Не получилось заполнить', true);
    } finally {
      setGenBusy(false);
    }
  }

  const link = (c) => `${origin}/w/${c.slug || c.id}`;
  const code = (c) =>
    `<script src="${origin}/widget.js" data-client="${c.slug}" data-color="${c.accent_color || '#f97316'}" async></script>`;
  const doCopy = async (text, label) => {
    await copyText(text);
    notify(`${label} скопировано`);
  };

  const formSlug = form.slug.trim();

  return (
    <div className="page">
      <style>{css}</style>

      <div className="top">
        <h1>⚙️ Клиенты чата</h1>
        <button className="btn primary" onClick={openNew}>+ Новый клиент</button>
        <button className="btn" onClick={load}>Обновить</button>
        <button
          className="btn"
          onClick={async () => {
            await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
            window.location.reload();
          }}
        >
          Выйти
        </button>
      </div>

      {editing && (
        <form className="panel" onSubmit={save}>
          <h2>{editing === 'new' ? 'Новый клиент' : `Редактирование: ${editing.business_name}`}</h2>

          <div className="gen">
            <strong style={{ fontSize: 14 }}>✨ Заполнить по сайту через ИИ</strong>
            <input type="text" placeholder="URL сайта бизнеса, например https://example.com" value={genUrl} onChange={(e) => setGenUrl(e.target.value)} />
            <textarea
              placeholder="Или вставьте текст с сайта / из Instagram (услуги, цены, адрес). Если заполнено, сайт не скачивается."
              value={genText}
              onChange={(e) => setGenText(e.target.value)}
              style={{ minHeight: 70 }}
            />
            <div className="row">
              <button type="button" className="btn primary" disabled={genBusy || (!genUrl.trim() && genText.trim().length < 80)} onClick={generate}>
                {genBusy ? 'Читаю и думаю…' : 'Спарсить и заполнить через ИИ'}
              </button>
              {genNote && <span className="hint" style={{ color: '#facc15' }}>{genNote}</span>}
            </div>
            <span className="hint">ИИ заполняет поля формы, но ничего не сохраняет: проверьте текст и нажмите «Сохранить».</span>
          </div>

          <div className="grid">
            <label>Название бизнеса *
              <input type="text" value={form.business_name} onChange={(e) => onName(e.target.value)} required maxLength={120} />
            </label>
            <label>Slug * (латиница, цифры, дефис)
              <input
                type="text"
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }}
                required
                maxLength={49}
                placeholder="avtoservis-motor"
              />
              <span className="hint">{formSlug ? `${origin}/w/${formSlug}` : 'Ссылка появится после ввода'}</span>
            </label>
            <label>Подзаголовок
              <input type="text" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={80} placeholder="Автосервис · Кременчук" />
            </label>
            <label>Ниша (правила диалога)
              <select value={form.theme} onChange={(e) => onTheme(e.target.value)}>
                {THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Цвет (accent_color)
              <div className="row">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(form.accent_color) ? form.accent_color : '#f97316'} onChange={(e) => set('accent_color', e.target.value)} />
                <input type="text" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} maxLength={7} />
              </div>
            </label>
            <label>Telegram chat_id владельца
              <input type="text" value={form.telegram_chat_id} onChange={(e) => set('telegram_chat_id', e.target.value)} placeholder="1102204148" inputMode="numeric" />
              <span className="hint">Клиент пишет /start боту, бот отвечает его chat_id. Пусто = заявки придут вам.</span>
            </label>
            <label className="full">Приветствие
              <textarea value={form.welcome_message} onChange={(e) => set('welcome_message', e.target.value)} maxLength={300} style={{ minHeight: 60 }} />
            </label>
            <label className="full">Стартовые кнопки (по одной на строку, до 4; пусто = стандартные для ниши)
              <textarea value={form.chips} onChange={(e) => set('chips', e.target.value)} style={{ minHeight: 80 }} placeholder={'Скільки коштує діагностика?\nХочу записатись на ремонт'} />
            </label>
            <label className="full">Системный промпт: прайс и правила (описание бизнеса для бота)
              <textarea value={form.business_context} onChange={(e) => set('business_context', e.target.value)} maxLength={6000} style={{ minHeight: 260 }} />
              <span className="hint">{form.business_context.length}/6000. Бот опирается только на этот текст и не выдумывает цены и время.</span>
            </label>
            <label>Лимит сообщений
              <input type="number" min={1} value={form.messages_limit} onChange={(e) => set('messages_limit', e.target.value)} />
            </label>
            <div className="switch" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input id="act" type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              <label htmlFor="act" style={{ color: '#e8eaf0', fontSize: 14 }}>Виджет включён (is_active)</label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
            <button className="btn" type="button" onClick={() => setEditing(null)}>Отмена</button>
            {editing !== 'new' && <button className="btn danger" type="button" onClick={remove} disabled={busy}>Удалить клиента</button>}
          </div>
          {editing !== 'new' && <p className="hint">Изменения на странице чата видны не позже чем через минуту.</p>}
        </form>
      )}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Клиент</th><th>Slug</th><th>Статус</th><th>chat_id</th><th>Заявок</th><th>Сообщ.</th><th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="muted">Загрузка…</td></tr>}
            {!loading && !clients.length && <tr><td colSpan={7} className="muted">Клиентов пока нет. Нажмите «+ Новый клиент».</td></tr>}
            {clients.map((c) => (
              <tr key={c.id}>
                <td><div className="name">{c.business_name}</div><div className="muted">{c.subtitle || '—'}</div></td>
                <td>{c.slug || <span className="muted">нет slug</span>}</td>
                <td>
                  <button className={`pill ${c.is_active !== false ? 'on' : 'off'}`} onClick={() => toggleActive(c)} title="Переключить">
                    {c.is_active !== false ? 'включён' : 'выключен'}
                  </button>
                </td>
                <td>{c.telegram_chat_id || <span className="muted">нет (пишет вам)</span>}</td>
                <td>{c.leads_count ?? 0}</td>
                <td className="muted">{c.messages_used ?? 0}/{c.messages_limit ?? '—'}</td>
                <td>
                  <div className="actions">
                    <button className="btn sm" onClick={() => openEdit(c)}>Изменить</button>
                    {c.slug && <a className="btn sm" href={link(c)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Открыть</a>}
                    {c.slug && <button className="btn sm" onClick={() => doCopy(link(c), 'Ссылка')}>Скопировать ссылку</button>}
                    {c.slug && <button className="btn sm" onClick={() => doCopy(code(c), 'Код')}>Скопировать код для сайта</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className={`toast${toast.err ? ' err' : ''}`}>{toast.text}</div>}
    </div>
  );
}
