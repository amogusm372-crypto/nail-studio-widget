import { cookies } from 'next/headers';
import AdminApp from './AdminApp';
import Login from './Login';
import { adminConfigProblem, adminConfigured, COOKIE, isAuthedToken } from '../../lib/admin.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Адмінка', robots: { index: false, follow: false } };

const box = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  background: '#0b0d12',
  color: '#e8eaf0',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  padding: 24,
  textAlign: 'center',
};

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main style={box}>
        <div>
          <div style={{ fontSize: 40 }}>🔒</div>
          <h1 style={{ fontSize: 20 }}>Админка закрыта</h1>
          <p style={{ color: '#8b93a7', maxWidth: 420 }}>{adminConfigProblem()}</p>
        </div>
      </main>
    );
  }

  const token = (await cookies()).get(COOKIE)?.value;
  return isAuthedToken(token) ? <AdminApp /> : <Login />;
}
