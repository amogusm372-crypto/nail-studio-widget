import { cleanClient, json, ownerUserId, requireAdmin, sb } from '../../../../lib/admin.js';
import { clearWidgetCache } from '../../../../lib/widgets.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Список клиентов
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const r = await sb('widgets?select=*&order=created_at.desc');
  if (!r.ok) return json({ error: r.error }, r.status >= 400 ? r.status : 500);
  return json({ clients: r.data ?? [] });
}

// Создать клиента
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const v = cleanClient(body, { create: true });
  if (!v.ok) return json({ error: v.errors.join('; ') }, 400);

  const owner = await ownerUserId();
  if (!owner.ok) return json({ error: owner.error }, 500);

  const r = await sb('widgets', {
    method: 'POST',
    body: { ...v.value, user_id: owner.id },
    prefer: 'return=representation',
  });
  if (!r.ok) return json({ error: r.error }, r.status === 409 ? 409 : 400);

  clearWidgetCache();
  return json({ client: r.data?.[0] ?? null }, 201);
}
