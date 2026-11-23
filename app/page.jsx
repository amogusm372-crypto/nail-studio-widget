'use client';
import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Привет! Помогу записаться в студию маникюра. Оставьте имя и телефон или напишите желаемое время.' }
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextHistory = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: nextHistory.slice(-10) })
      });
      const data = await res.json();
      if (data.warnings) console.warn('[chat warnings]', data.warnings);
      if (!res.ok) console.error('[chat] HTTP', res.status, data);
      const reply = data.reply || data.message || data.error || JSON.stringify(data);
      setMessages([...nextHistory, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages([...nextHistory, { role: 'assistant', content: 'Ошибка сети: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Nail Studio MVP</h1>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minHeight: 300, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 8, background: m.role === 'user' ? '#e6f0ff' : '#f3f4f6' }}>
              <b>{m.role === 'user' ? 'Вы' : 'Ассистент'}:</b> {m.content}
            </span>
          </div>
        ))}
        {loading && <div>Печатает...</div>}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение или телефон..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px 18px', borderRadius: 6, cursor: 'pointer' }}>
          Отправить
        </button>
      </form>
    </main>
  );
}
