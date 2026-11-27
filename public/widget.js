/*!
 * Chat widget loader (vanilla JS, без зависимостей).
 * Подключение:
 *   <script src="https://ВАШ-САЙТ/widget.js" data-client="slug" data-color="#f97316" async></script>
 * Необязательно: data-greeting="Текст облачка"  data-delay="10000" (мс до облачка)
 */
(function () {
  'use strict';
  if (window.__chatWidgetLoaded) return;
  window.__chatWidgetLoaded = true;

  var script =
    document.currentScript || document.querySelector('script[data-client][src*="widget.js"]');
  if (!script) return;

  var slug = String(script.getAttribute('data-client') || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) {
    console.warn('[chat-widget] укажите data-client="slug" клиента');
    return;
  }

  var colorAttr = String(script.getAttribute('data-color') || '').trim();
  var color = /^#[0-9a-f]{6}$/i.test(colorAttr) ? colorAttr : '#f97316';
  var greeting = String(
    script.getAttribute('data-greeting') || 'Вітаю! Маєте питання? Напишіть — відповімо одразу 👋',
  ).slice(0, 140);
  var delayAttr = Number(script.getAttribute('data-delay'));
  var delay = isFinite(delayAttr) && script.hasAttribute('data-delay') ? Math.max(0, delayAttr) : 10000;

  var origin;
  try {
    origin = new URL(script.src, location.href).origin;
  } catch (e) {
    return;
  }
  var frameUrl = origin + '/w/' + encodeURIComponent(slug) + '?embed=true';
  var seenKey = 'chat-widget-greeted-' + slug;

  var CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box}' +
    '.btn{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));width:60px;height:60px;' +
    'border-radius:50%;border:0;padding:0;background:' + color + ';color:#fff;cursor:pointer;display:grid;place-items:center;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.28);transition:transform .15s ease}' +
    '.btn:hover{transform:scale(1.07)}' +
    '.btn:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.btn svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.btn .ic-close{display:none}' +
    '.is-open .btn .ic-chat{display:none}.is-open .btn .ic-close{display:block}' +
    '.pulse{animation:pl 2.2s ease-out 3}' +
    '@keyframes pl{0%{box-shadow:0 0 0 0 ' + color + '88,0 8px 24px rgba(0,0,0,.28)}' +
    '70%{box-shadow:0 0 0 18px ' + color + '00,0 8px 24px rgba(0,0,0,.28)}' +
    '100%{box-shadow:0 0 0 0 ' + color + '00,0 8px 24px rgba(0,0,0,.28)}}' +
    '.bubble{position:fixed;right:20px;bottom:calc(92px + env(safe-area-inset-bottom,0px));max-width:260px;' +
    'background:#fff;color:#16181d;padding:12px 30px 12px 14px;border-radius:16px 16px 4px 16px;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'cursor:pointer;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .25s,transform .25s}' +
    '.bubble.show{opacity:1;transform:none;pointer-events:auto}' +
    '.bubble .x{position:absolute;top:3px;right:6px;border:0;background:none;color:#8a8f9c;font-size:20px;line-height:1;cursor:pointer;padding:2px 4px}' +
    '.panel{position:fixed;right:20px;bottom:calc(92px + env(safe-area-inset-bottom,0px));width:380px;' +
    'height:min(640px,calc(100vh - 120px));border-radius:16px;overflow:hidden;background:#0b0d12;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.4);display:none}' +
    '.is-open .panel{display:block}' +
    '.panel iframe{width:100%;height:100%;border:0;display:block}' +
    '@media(max-width:480px){.panel{inset:0;width:100%;height:100%;border-radius:0}' +
    '.is-open .btn,.is-open .bubble{display:none}}';

  var host, root, wrap, btn, bubble, panel, frame;
  var loaded = false;
  var timer = null;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function markGreeted() {
    try { sessionStorage.setItem(seenKey, '1'); } catch (e) { /* ignore */ }
  }
  function wasGreeted() {
    try { return sessionStorage.getItem(seenKey) === '1'; } catch (e) { return false; }
  }

  function hideBubble() {
    clearTimeout(timer);
    bubble.classList.remove('show');
    markGreeted();
  }

  function open() {
    if (!loaded) { frame.src = frameUrl; loaded = true; }
    wrap.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    hideBubble();
  }
  function close() {
    wrap.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function toggle() {
    if (wrap.classList.contains('is-open')) close(); else open();
  }

  function mount() {
    host = document.createElement('div');
    host.setAttribute('data-chat-widget', slug);
    host.style.cssText = 'all:initial;position:fixed;right:0;bottom:0;z-index:2147483000;';
    root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = CSS;
    wrap = el('div', '');

    btn = el(
      'button',
      'btn pulse',
      '<svg class="ic-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>' +
        '<svg class="ic-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    );
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Відкрити чат');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', toggle);

    bubble = el('div', 'bubble');
    bubble.setAttribute('role', 'status');
    bubble.appendChild(document.createTextNode(greeting));
    var x = el('button', 'x', '&times;');
    x.type = 'button';
    x.setAttribute('aria-label', 'Закрити');
    x.addEventListener('click', function (e) { e.stopPropagation(); hideBubble(); });
    bubble.appendChild(x);
    bubble.addEventListener('click', open);

    panel = el('div', 'panel');
    frame = document.createElement('iframe');
    frame.title = 'Чат';
    frame.setAttribute('allow', '');
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    panel.appendChild(frame);

    wrap.appendChild(style);
    wrap.appendChild(panel);
    wrap.appendChild(bubble);
    wrap.appendChild(btn);
    root.appendChild(wrap);
    document.body.appendChild(host);

    if (!wasGreeted()) {
      timer = setTimeout(function () {
        if (!wrap.classList.contains('is-open')) bubble.classList.add('show');
      }, delay);
    }
  }

  // Кнопка «×» внутри чата просит родителя закрыть панель.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    if (e.data && e.data.type === 'chat-widget:close') close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrap && wrap.classList.contains('is-open')) close();
  });

  window.ChatWidget = { open: function () { if (wrap) open(); }, close: function () { if (wrap) close(); } };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
