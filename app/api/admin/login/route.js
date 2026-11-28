import { adminConfigProblem, adminConfigured, clientIp, json, passwordOk, setSessionCookie } from '../../../../lib/admin.js';
import { checkRate } from '../../../../lib/rate.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!adminConfigured()) return json({ error: adminConfigProblem() }, 503);

  // Не больше 8 попыток за 10 минут и 40 в сутки с одного IP.
  const rate = await checkRate(clientIp(req), { scope: 'admin-login', shortMax: 8, dayMax: 40 });
  if (!rate.ok) return json({ error: 'Слишком много попыток входа. Подождите немного.' }, 429);

  const body = await req.json().catch(() => ({}));
  if (!passwordOk(body?.password)) {
    console.warn('[admin] неверный пароль');
    return json({ error: 'Неверный пароль' }, 401);
  }
  return setSessionCookie(json({ ok: true }));
}
