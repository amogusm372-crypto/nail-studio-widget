import { cleanClient, isUuid, json, requireAdmin, sb } from '../../../../../lib/admin.js';
import { clearWidgetCache } from '../../../../../lib/widgets.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Изменить клиента (можно присылать только изменённые поля)
export async function PUT(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Некорректный id' }, 400);

  const body = await req.json().catch(() => null);
  const v = cleanClient(body, { create: false });
  if (!v.ok) return json({ error: v.errors.join('; ') }, 400);
  if (!Object.keys(v.value).length) return json({ error: 'Нечего сохранять' }, 400);

  const r = await sb(`widgets?id=eq.${id}`, { method: 'PATCH', body: v.value, prefer: 'return=representation' });
  if (!r.ok) return json({ error: r.error }, r.status === 409 ? 409 : 400);
  if (!r.data?.length) return json({ error: 'Клиент не найден' }, 404);

  clearWidgetCache();
  return json({ client: r.data[0] });
}

// Удалить клиента (заявки в leads остаются)
export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Некорректный id' }, 400);

  const r = await sb(`widgets?id=eq.${id}`, { method: 'DELETE', prefer: 'return=representation' });
  if (!r.ok) return json({ error: r.error }, 400);
  if (!r.data?.length) return json({ error: 'Клиент не найден' }, 404);

  clearWidgetCache();
  return json({ ok: true });
}
