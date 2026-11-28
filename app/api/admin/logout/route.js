import { clearSessionCookie, json } from '../../../../lib/admin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return clearSessionCookie(json({ ok: true }));
}
