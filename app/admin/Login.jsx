'use client';
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0b0d12', color: '#e8eaf0',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', padding: 24, margin: 0,
      }}
    >
      <style>{`html,body{margin:0;background:#0b0d12}`}</style>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>🔐 Вход в админку</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoFocus
          autoComplete="current-password"
          style={{ background: '#12151c', color: '#e8eaf0', border: '1px solid #262c3b', borderRadius: 10, padding: '12px 14px', fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={busy || !password}
          style={{ background: '#f97316', color: '#fff', border: 0, borderRadius: 10, padding: '12px', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: busy || !password ? 0.6 : 1 }}
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>
        {error && <p style={{ color: '#f87171', margin: 0, fontSize: 14 }}>{error}</p>}
      </form>
    </main>
  );
}
