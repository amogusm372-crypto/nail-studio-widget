import Chat from './Chat';
import { getWidget, isActive, publicWidget } from '../../../lib/widgets.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const w = await getWidget(id);
  return {
    title: w ? `${w.business_name} — онлайн-адміністратор` : 'Чат',
    robots: { index: false },
  };
}

function Stub({ emoji, title, text }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        margin: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#0b0d12',
        color: '#e8eaf0',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</div>
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ margin: 0, color: '#8b93a7', lineHeight: 1.5 }}>{text}</p>
      </div>
    </main>
  );
}

export default async function WidgetPage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const embed = sp.embed === 'true' || sp.embed === '1';

  const w = await getWidget(id);

  if (!w) {
    return <Stub emoji="🔍" title="Чат не знайдено" text="Перевірте посилання або зверніться до власника сайту." />;
  }
  if (!isActive(w)) {
    return (
      <Stub
        emoji="🔌"
        title="Чат тимчасово вимкнено"
        text="Онлайн-адміністратор зараз недоступний. Зв’яжіться з нами іншим зручним способом."
      />
    );
  }

  return <Chat widget={publicWidget(w)} embed={embed} />;
}
