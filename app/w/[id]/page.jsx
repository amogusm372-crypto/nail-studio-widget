import Chat from './Chat';
import { getWidget, publicWidget } from '../../../lib/widgets.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const w = await getWidget(id);
  return {
    title: w ? `${w.business_name} — онлайн-адміністратор` : 'Чат',
    robots: { index: false },
  };
}

export default async function WidgetPage({ params }) {
  const { id } = await params;
  const w = await getWidget(id);

  if (!w) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p>Чат не знайдено. Перевірте посилання.</p>
      </main>
    );
  }

  return <Chat widget={publicWidget(w)} />;
}
