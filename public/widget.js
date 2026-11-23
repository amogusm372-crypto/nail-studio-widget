/*!
 * AI Lead-Capture Widget — vanilla JS, zero dependencies.
 * Usage: <script src="https://YOUR-APP.netlify.app/widget.js" data-widget-id="UUID" async></script>
 * Optional: data-api-base="https://other-origin" to override the API origin.
 */
(function () {
  'use strict';

  var script =
    document.currentScript || document.querySelector('script[data-widget-id]');
  if (!script) return;

  var widgetId = script.getAttribute('data-widget-id');
  if (!widgetId) {
    console.warn('[widget] Missing data-widget-id attribute.');
    return;
  }

  // Prevent double-mounting if the snippet is pasted twice.
  var HOST_ID = 'lead-widget-host-' + widgetId;
  if (document.getElementById(HOST_ID)) return;

  var apiBase = script.getAttribute('data-api-base');
  if (!apiBase) {
    try {
      apiBase = new URL(script.src, window.location.href).origin;
    } catch (e) {
      apiBase = '';
    }
  }
  var API_URL = apiBase + '/api/chat';

  var MAX_HISTORY = 10;
  var MAX_INPUT = 1000;
  var FALLBACK_REPLY =
    'Sorry, something went wrong. Please leave your phone or email and we will get back to you.';

  var config = {
    color: '#2563eb',
    welcomeMessage:
      'Hi! Ask me anything or leave your contact and we will reach out.',
    businessName: 'Chat',
  };

  var history = []; // [{ role: 'user' | 'assistant', content: string }]
  var isOpen = false;
  var isSending = false;

  // ---------------------------------------------------------------- DOM
  var host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  var root = host.attachShadow({ mode: 'open' });

  var css = [
    ':host{all:initial}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    '.w{--c:#2563eb;position:fixed;right:20px;bottom:20px;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827}',
    '.fab{width:56px;height:56px;border:0;border-radius:50%;background:var(--c);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s ease}',
    '.fab:hover{transform:scale(1.06)}',
    '.fab:focus-visible,.send:focus-visible,.close:focus-visible{outline:3px solid #fff;outline-offset:-5px;box-shadow:0 0 0 3px var(--c)}',
    '.fab svg{width:26px;height:26px;fill:currentColor}',
    '.panel{position:absolute;right:0;bottom:70px;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 110px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden}',
    '.panel.open{display:flex;animation:pop .18s ease-out}',
    '@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}',
    '.head{background:var(--c);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.title{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.close{background:transparent;border:0;color:#fff;cursor:pointer;font-size:22px;line-height:1;padding:2px 6px;border-radius:6px}',
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f7f8fa}',
    '.m{max-width:82%;padding:9px 12px;border-radius:14px;word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.m.bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:4px}',
    '.m.user{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:4px}',
    '.typing{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;border-radius:14px;border-bottom-left-radius:4px;padding:11px 14px;display:none;gap:4px}',
    '.typing.on{display:flex}',
    '.dot{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:b 1.2s infinite ease-in-out}',
    '.dot:nth-child(2){animation-delay:.15s}.dot:nth-child(3){animation-delay:.3s}',
    '@keyframes b{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}',
    '.form{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}',
    '.in{flex:1;min-width:0;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font:inherit;color:inherit;outline:none;background:#fff}',
    '.in:focus{border-color:var(--c);box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 25%,transparent)}',
    '.send{border:0;border-radius:10px;background:var(--c);color:#fff;padding:0 14px;font:inherit;font-weight:600;cursor:pointer}',
    '.send:disabled{opacity:.5;cursor:not-allowed}',
    '@media (max-width:480px){.w{right:12px;bottom:12px}.panel{position:fixed;right:12px;left:12px;bottom:80px;width:auto;max-width:none}}',
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;

  var wrap = el('div', 'w');

  var fab = el('button', 'fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';

  var panel = el('div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat');

  var head = el('div', 'head');
  var title = el('div', 'title');
  title.textContent = config.businessName;
  var closeBtn = el('button', 'close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close chat');
  closeBtn.textContent = '\u00d7';
  head.appendChild(title);
  head.appendChild(closeBtn);

  var msgs = el('div', 'msgs');
  msgs.setAttribute('aria-live', 'polite');

  var typing = el('div', 'typing');
  typing.setAttribute('aria-label', 'Assistant is typing');
  typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  var form = el('form', 'form');
  var input = el('input', 'in');
  input.type = 'text';
  input.placeholder = 'Type your message\u2026';
  input.maxLength = MAX_INPUT;
  input.setAttribute('aria-label', 'Your message');
  input.autocomplete = 'off';
  var sendBtn = el('button', 'send');
  sendBtn.type = 'submit';
  sendBtn.textContent = 'Send';
  form.appendChild(input);
  form.appendChild(sendBtn);

  msgs.appendChild(typing);
  panel.appendChild(head);
  panel.appendChild(msgs);
  panel.appendChild(form);
  wrap.appendChild(panel);
  wrap.appendChild(fab);
  root.appendChild(style);
  root.appendChild(wrap);

  // ------------------------------------------------------------ Helpers
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function applyConfig() {
    wrap.style.setProperty('--c', config.color);
    title.textContent = config.businessName;
  }

  function addMessage(role, text) {
    var m = el('div', 'm ' + (role === 'user' ? 'user' : 'bot'));
    m.textContent = text; // textContent: never interpret model/visitor text as HTML
    msgs.insertBefore(m, typing);
    scrollDown();
  }

  function scrollDown() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function setTyping(on) {
    typing.classList.toggle('on', on);
    if (on) scrollDown();
  }

  function setSending(on) {
    isSending = on;
    sendBtn.disabled = on;
    setTyping(on);
  }

  function toggle(open) {
    isOpen = typeof open === 'boolean' ? open : !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.setAttribute('aria-label', isOpen ? 'Close chat' : 'Open chat');
    if (isOpen) {
      setTimeout(function () { input.focus(); }, 50);
      scrollDown();
    }
  }

  // ------------------------------------------------------------ Network
  function loadConfig() {
    return fetch(API_URL + '?widgetId=' + encodeURIComponent(widgetId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (typeof data.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(data.color)) {
          config.color = data.color;
        }
        if (typeof data.welcomeMessage === 'string' && data.welcomeMessage) {
          config.welcomeMessage = data.welcomeMessage;
        }
        if (typeof data.businessName === 'string' && data.businessName) {
          config.businessName = data.businessName;
        }
      })
      .catch(function () { /* keep defaults */ });
  }

  function sendMessage(text) {
    var payload = {
      widgetId: widgetId,
      message: text,
      history: history.slice(-MAX_HISTORY),
    };

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    setSending(true);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      })
      .then(function (res) {
        var reply =
          res.data && typeof res.data.reply === 'string' && res.data.reply
            ? res.data.reply
            : FALLBACK_REPLY;
        addMessage('assistant', reply);
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        addMessage('assistant', FALLBACK_REPLY);
      })
      .then(function () {
        setSending(false);
        input.focus();
      });
  }

  // ------------------------------------------------------------- Events
  fab.addEventListener('click', function () { toggle(); });
  closeBtn.addEventListener('click', function () { toggle(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) toggle(false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || isSending) return;
    input.value = '';
    sendMessage(text);
  });

  // --------------------------------------------------------------- Boot
  function mount() {
    document.body.appendChild(host);
    applyConfig();
    loadConfig().then(function () {
      applyConfig();
      addMessage('assistant', config.welcomeMessage);
    });
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
