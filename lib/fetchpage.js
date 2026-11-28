// Безопасная загрузка чужой страницы (для генератора демо в админке).
// Защита от SSRF: только http/https на стандартных портах, адрес проверяется при КАЖДОМ соединении
// (включая редиректы), внутренние и служебные IP запрещены, лимит размера и времени.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';

export function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (family === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const dotted = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIp(dotted[1]);
    const hex = x.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
      return isPrivateIp([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
    }
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true; // не IP-адрес: считаем небезопасным
}

export function parseHttpUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) throw new Error('Укажите адрес сайта');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Некорректный адрес сайта');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Разрешены только http и https');
  if (url.username || url.password) throw new Error('Адрес с логином и паролем не поддерживается');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Нестандартные порты запрещены');
  if (!url.hostname) throw new Error('Некорректный адрес сайта');
  return url;
}

function makeLookup(allowPrivate) {
  return (hostname, options, cb) => {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
      if (err) return cb(err);
      if (!allowPrivate && addrs.some((a) => isPrivateIp(a.address))) {
        return cb(Object.assign(new Error('Адрес сайта внутренний — загрузка запрещена'), { code: 'EBLOCKED' }));
      }
      if (options?.all) return cb(null, addrs);
      return cb(null, addrs[0].address, addrs[0].family);
    });
  };
}

function requestOnce(url, { allowPrivate, maxBytes, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:';
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !allowPrivate && isPrivateIp(host)) {
      return reject(new Error('Адрес сайта внутренний — загрузка запрещена'));
    }

    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };

    const req = (secure ? https : http).request(
      {
        hostname: host,
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: makeLookup(allowPrivate),
        timeout: timeoutMs,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; ChatWidgetBot/1.0)',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'accept-language': 'uk,ru;q=0.8,en;q=0.5',
          'accept-encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          return finish(resolve, { status, headers: res.headers, body: null });
        }

        const type = String(res.headers['content-type'] || '');
        if (type && !/text\/|html|xml|json/i.test(type)) {
          res.destroy();
          return finish(reject, new Error('Это не веб-страница (тип содержимого не текстовый)'));
        }

        const enc = String(res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        let total = 0;
        stream.on('data', (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy();
            return finish(reject, new Error('Страница слишком большая'));
          }
          chunks.push(chunk);
        });
        stream.on('end', () => finish(resolve, { status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('error', (e) => finish(reject, e));
      },
    );

    const timer = setTimeout(() => {
      req.destroy();
      finish(reject, new Error('Сайт слишком долго отвечает'));
    }, timeoutMs);

    req.on('timeout', () => {
      req.destroy();
      finish(reject, new Error('Сайт слишком долго отвечает'));
    });
    req.on('error', (e) => finish(reject, e.code === 'EBLOCKED' ? e : new Error(`Не удалось открыть сайт: ${e.message}`)));
    req.end();
  });
}

function decodeBody(buffer, contentType) {
  const charset = String(contentType || '').match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() || 'utf-8';
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

/** { html, finalUrl }. allowPrivate нужен только тестам. */
export async function fetchPageText(inputUrl, { maxBytes = 1_500_000, timeoutMs = 9000, maxRedirects = 3, allowPrivate = false } = {}) {
  let url = parseHttpUrl(inputUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(url, { allowPrivate, maxBytes, timeoutMs });
    if (res.body === null) {
      const location = res.headers.location;
      if (!location) throw new Error('Сайт вернул редирект без адреса');
      url = parseHttpUrl(new URL(location, url).href); // каждый переход проверяется заново
      continue;
    }
    if (res.status >= 400) throw new Error(`Сайт ответил ошибкой HTTP ${res.status}`);
    return { html: decodeBody(res.body, res.headers['content-type']), finalUrl: url.href };
  }
  throw new Error('Слишком много перенаправлений');
}
