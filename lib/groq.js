// Мини-клиент Groq для админки: один запрос, ответ в виде JSON-объекта.
const BASE = 'https://api.groq.com/openai/v1';
const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'];

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : '');

function parseJsonLoose(raw) {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try {
        return JSON.parse(text.slice(a, b + 1));
      } catch {
        /* ниже */
      }
    }
  }
  return null;
}

export async function groqJson({ system, user, maxTokens = 1500, timeoutMs = 25000 }) {
  const apiKey = clean(process.env.GROQ_API_KEY);
  if (!apiKey) throw new Error('GROQ_API_KEY не задан');

  const queue = [...new Set([clean(process.env.GROQ_MODEL), ...MODELS].filter(Boolean))];
  let lastError = 'нет доступных моделей';

  for (const model of queue) {
    const call = (json) =>
      fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

    try {
      let res = await call(true);
      let body = res.ok ? '' : await res.text().catch(() => '');
      if (res.status === 400 && /response_format|json/i.test(body)) {
        res = await call(false);
        body = res.ok ? '' : await res.text().catch(() => '');
      }
      if (!res.ok) {
        lastError = `Groq HTTP ${res.status} (${model})`;
        // модель недоступна, слишком большой запрос или лимит: пробуем следующую
        if ([404, 413, 429].includes(res.status) || /model_not_found|decommission/i.test(body)) continue;
        throw new Error(lastError);
      }
      const data = await res.json();
      const parsed = parseJsonLoose(data?.choices?.[0]?.message?.content);
      if (parsed && typeof parsed === 'object') return parsed;
      lastError = `Groq вернул не JSON (${model})`;
    } catch (error) {
      lastError = String(error?.message ?? error).replace(apiKey, '***');
      if (error?.name === 'TimeoutError') lastError = `Groq не ответил вовремя (${model})`;
    }
  }
  throw new Error(lastError);
}
