// HTML -> чистый текст для нейросети. Без зависимостей.

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', copy: '©', hryvnia: '₴', euro: '€',
};

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(cp);
      } catch {
        return '';
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function metaContent(html, key) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`, 'i'));
  const content = tag?.[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return content ? decode(content[1]).trim() : '';
}

/** Достаёт из HTML заголовок, описание, телефоны, JSON-LD и основной текст. */
export function extractPage(html, { maxChars = 9000 } = {}) {
  const src = String(html ?? '');

  const title = decode(src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const description = metaContent(src, 'description') || metaContent(src, 'og:description');
  const siteName = metaContent(src, 'og:site_name');

  const phones = [...new Set([...src.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map((m) => decodeURIComponent(m[1]).trim()))]
    .filter(Boolean)
    .slice(0, 5);

  const ldjson = [...src.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim().slice(0, 1500))
    .filter(Boolean)
    .slice(0, 3);

  const body = decode(
    src
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  );

  const lines = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 2 || line === lines[lines.length - 1]) continue;
    lines.push(line);
  }
  const text = lines.join('\n').slice(0, maxChars);

  return [
    title && `Назва сторінки: ${title}`,
    siteName && `Назва сайту: ${siteName}`,
    description && `Опис: ${description}`,
    phones.length && `Телефони: ${phones.join(', ')}`,
    ldjson.length && `Структуровані дані: ${ldjson.join(' | ')}`,
    text && `Текст сторінки:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n');
}
