// Tezgâhın ürettiği HTML sayfaları: panel/ayarlar sarmalayıcıları, ekran
// görüntüsü çerçevesi ve kapak görselleri.
import {
  APP_ORIGIN,
  APP_ROUTE,
  APP_TITLE,
  COVERS,
  SCENES,
  SHOT_HEIGHT,
  SHOT_WIDTH,
} from './scenes.mjs';

const PANEL_WIDTH = 420;

// Sürücü modülü defer'lı yüklenir; iframe'ler ondan önce konuşabilir.
const MESSAGE_BUFFER = 'window.__harnessQueue=[];addEventListener("message",(e)=>window.__harnessQueue.push(e.data));';

// --------------------------------------------------------------- chrome stub

// Panel ve ayarlar sayfası eklenti kabuğu olmadan çalışır. Taklit edilen yüzey
// bilinçli olarak dar: `src/ui` içinde geçen `chrome.*` çağrılarının tamamı bu
// kadar. Durum, gerçek STATE_SNAPSHOT mesajı olarak port üzerinden verilir —
// yani panel, eklenti içindekiyle aynı yoldan beslenir.
const chromeStub = (tabUrl, version) => `
(() => {
  const noop = () => {};
  const event = { addListener: noop, removeListener: noop };
  const ports = [];

  window.chrome = {
    runtime: {
      connect: () => {
        const listeners = [];
        ports.push(listeners);
        // Tezgâh, durumu ancak port kurulduktan sonra gönderebilir; erken
        // gönderilen snapshot hiçbir dinleyiciye ulaşmazdı.
        parent.postMessage({ type: 'HARNESS_UI_READY' }, '*');
        return {
          onMessage: { addListener: (fn) => listeners.push(fn) },
          onDisconnect: event,
          postMessage: noop,
          disconnect: noop,
        };
      },
      getManifest: () => ({ version: ${JSON.stringify(version)} }),
      openOptionsPage: noop,
      lastError: undefined,
    },
    tabs: {
      query: async () => [{ id: 1, url: ${JSON.stringify(tabUrl)} }],
      create: noop,
      update: noop,
      onActivated: event,
      onUpdated: event,
    },
    i18n: { getUILanguage: () => 'en' },
    permissions: { contains: async () => true, request: async () => true },
    windows: { update: noop },
    storage: { session: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  };

  addEventListener('message', (message) => {
    const data = message.data;
    if (!data) return;

    if (data.type === 'DRSIM_SCENE_STATE') {
      ports.forEach((listeners) => listeners.forEach((fn) => fn({ type: 'STATE_SNAPSHOT', state: data.state })));
      return;
    }

    // scrollIntoView, kaydırma kabına göre değil görünür alana göre hizalıyor ve
    // sonuç senaryodan senaryoya kayıyordu; hedefin kap içindeki yeri doğrudan
    // hesaplanıyor.
    // Paneldeki .drsim-body yalnızca kap yüksekliği sınırlıysa kaydırılır;
    // içerik taşınca belge kendisi kayıyor. Hangisi gerçekten kaydırılabiliyorsa
    // o kullanılmalı, yoksa scrollTop sessizce 0'da kalıyor.
    const bring = (element, offset) => {
      if (!element) return;
      const box = document.querySelector('.drsim-body');
      if (box && box.scrollHeight > box.clientHeight + 1) {
        box.scrollTop += element.getBoundingClientRect().top - box.getBoundingClientRect().top - offset;
        return;
      }
      scrollTo({ top: element.getBoundingClientRect().top + scrollY - offset });
    };

    if (data.type === 'DRSIM_SCROLL_TEST') {
      const target = document.querySelector('[data-test="' + data.test + '"]');
      bring(target?.closest('.drsim-slot') ?? target?.closest('.drsim-section'), data.offset ?? 0);
      return;
    }

    if (data.type === 'DRSIM_SCROLL_TITLE') {
      const titles = [...document.querySelectorAll('.drsim-section__title')];
      const match = titles.find((element) => element.textContent === data.title);
      bring(match?.closest('.drsim-section'), data.offset ?? 0);
    }
  });
})();
`;

// Derlenmiş sayfayı olduğu gibi servis eder, yalnızca stub'ı modül script'inden
// ÖNCE araya sokar: klasik script, defer'lı modülden önce çalışır.
export const withChromeStub = (html, tabUrl, version) => html.replace(
  '<script type="module"',
  `<script>${chromeStub(tabUrl, version)}</script>\n    <script type="module"`,
);

// ----------------------------------------------------------------- ortak stil

const shell = (extra = '') => `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${SHOT_WIDTH}px; height: ${SHOT_HEIGHT}px; overflow: hidden;
    background: #0a0f1a;
    background-image:
      radial-gradient(1100px 520px at 12% -12%, rgba(37, 99, 235, .20), transparent 60%),
      radial-gradient(900px 480px at 104% 8%, rgba(239, 68, 68, .16), transparent 62%);
    color: #f9fafb;
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { height: 100%; padding: 32px 44px 36px; display: flex; flex-direction: column; }
  .cap { flex: 0 0 auto; margin-bottom: 18px; }
  .cap h1 { margin: 0 0 5px; font-size: 29px; line-height: 1.18; letter-spacing: -.7px; font-weight: 700; }
  .cap p { margin: 0; font-size: 14.5px; color: #9ca3af; max-width: 960px; }

  .stage { flex: 1 1 auto; min-height: 0; display: flex; gap: 22px; }

  .frame {
    flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;
    background: #111827; border: 1px solid #3a465a; border-radius: 11px; overflow: hidden;
    box-shadow: 0 26px 60px rgba(0, 0, 0, .55), 0 2px 0 rgba(255, 255, 255, .04) inset;
  }
  .bar {
    flex: 0 0 34px; display: flex; align-items: center; gap: 7px;
    padding: 0 12px; background: #0d131f; border-bottom: 1px solid #2b3648;
  }
  .light { width: 9px; height: 9px; border-radius: 999px; background: #3f4a5c; }
  .light:first-child { background: #f4776a; }
  .light:nth-child(2) { background: #f5bf4f; }
  .light:nth-child(3) { background: #61c554; }
  .url {
    margin-left: 8px; flex: 0 1 340px; padding: 3px 10px; border-radius: 999px;
    background: #131b29; border: 1px solid #2b3648; color: #8d99ab;
    font: 10.5px/1.5 ui-monospace, Menlo, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .tag {
    margin-left: auto; display: flex; align-items: center; gap: 5px;
    color: #9ca3af; font-size: 10.5px;
  }
  .tag .swatch { width: 12px; height: 12px; border-radius: 3px; }

  .body { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
  iframe { border: 0; display: block; }
  .app { flex: 1 1 auto; height: 100%; }
  .rail { flex: 0 0 ${PANEL_WIDTH}px; border-left: 1px solid #2b3648; background: #1f2937; }
  .rail iframe { width: ${PANEL_WIDTH}px; height: 100%; }
${extra}
`;

const lights = `<span class="light"></span><span class="light"></span><span class="light"></span>`;

const sidePanelTag = `<span class="tag"><span class="swatch" style="background:#1f2937;border:1px solid #4b5563"></span>side panel</span>`;

// ------------------------------------------------------------------ ekran 1-4

const docCard = `
  .scrim {
    position: absolute; inset: 0 ${PANEL_WIDTH}px 0 0;
    background: rgba(6, 10, 18, .58);
  }
  .doc {
    position: absolute; top: 50%; left: calc((100% - ${PANEL_WIDTH}px) / 2);
    transform: translate(-50%, -50%); width: 408px;
    background: #0d131f; border: 1px solid #3a465a; border-radius: 9px;
    box-shadow: 0 26px 54px rgba(0, 0, 0, .7); overflow: hidden;
  }
  .doc header {
    display: flex; align-items: center; gap: 7px; padding: 7px 11px;
    background: #151d2b; border-bottom: 1px solid #2b3648;
    font: 11px ui-monospace, Menlo, monospace; color: #d1d5db;
  }
  .doc header .dot { width: 7px; height: 7px; border-radius: 2px; background: #22c55e; }
  .doc pre {
    margin: 0; padding: 10px 12px; max-height: 236px; overflow: hidden;
    font: 10px/1.55 ui-monospace, Menlo, monospace; color: #9ca3af; white-space: pre-wrap;
    /* Kesilen metin bıçakla kesilmiş gibi durmasın */
    mask-image: linear-gradient(#000 78%, transparent);
  }
  .doc pre b { color: #e5e7eb; font-weight: 600; }
`;

const calloutCss = `
  .frame.narrow { flex: 0 0 668px; }
  .notes { flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; justify-content: center; }
  .note {
    background: rgba(17, 24, 39, .72); border: 1px solid #2b3648;
    border-left: 3px solid #4b5563; border-radius: 9px; padding: 11px 14px;
  }
  .note h3 { margin: 0 0 3px; font-size: 13.5px; font-weight: 650; letter-spacing: -.2px; }
  .note p { margin: 0; font-size: 12.5px; line-height: 1.45; color: #9ca3af; }
  .note.danger { border-left-color: #ef4444; }
  .note.warning { border-left-color: #f59e0b; }
  .note.info { border-left-color: #2563eb; }
  .note.accent { border-left-color: #22c55e; }
`;

const noteHtml = (note) => `<div class="note ${note.tone}"><h3>${note.title}</h3><p>${note.text}</p></div>`;

const stageFor = (scene, id) => {
  if (scene.kind === 'options') {
    return `
      <div class="stage">
        <div class="frame narrow">
          <div class="bar">${lights}<span class="url">chrome-extension://…/ui/options/index.html</span>
            <span class="tag"><span class="swatch" style="background:#1f2937;border:1px solid #4b5563"></span>settings</span>
          </div>
          <div class="body"><iframe class="app" id="options" src="/options?scene=${id}"></iframe></div>
        </div>
        <div class="notes">${(scene.callouts ?? []).map(noteHtml).join('')}</div>
      </div>`;
  }

  return `
    <div class="stage">
      <div class="frame">
        <div class="bar">${lights}<span class="url">${APP_ORIGIN}${APP_ROUTE}</span>${sidePanelTag}</div>
        <div class="body">
          <iframe class="app" id="app" src="${APP_ORIGIN}${APP_ROUTE}"></iframe>
          <div class="rail"><iframe id="panel" src="/panel?scene=${id}"></iframe></div>
          ${scene.variant === 'report' ? '<div class="scrim" id="scrim" hidden></div><div class="doc" id="doc" hidden><header><span class="dot"></span>dr-sim-report.md</header><pre id="docBody"></pre></div>' : ''}
        </div>
      </div>
    </div>`;
};

export const shotHtml = (id) => {
  const scene = SCENES[id];
  const extra = (scene.kind === 'options' ? calloutCss : '') + (scene.variant === 'report' ? docCard : '');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>DR-SIM — ${id}</title>
    <script>${MESSAGE_BUFFER}</script>
    <style>${shell(extra)}</style>
  </head>
  <body>
    <div class="wrap">
      <div class="cap">
        <h1>${scene.caption}</h1>
        <p>${scene.sub}</p>
      </div>
      ${stageFor(scene, id)}
    </div>
    <img src="/hold?token=${id}" alt="" hidden />
    <script type="module" src="/drive.js?scene=${id}"></script>
  </body>
</html>
`;
};

// ------------------------------------------------------------------- kapaklar

// Toolbar ikonunun birebir vektör karşılığı (bkz. scripts/make-icons.mjs):
// dış kenarlık, panel gövdesi, "engellendi" halkası ve 45°'lik çapraz.
export const markSvg = (size, accent = '#ef4444') => `
<svg width="${size}" height="${size}" viewBox="0 0 128 128" aria-hidden="true">
  <rect x="0" y="0" width="128" height="128" rx="28" fill="#4b5563" />
  <rect x="6.4" y="6.4" width="115.2" height="115.2" rx="25.3" fill="#1f2937" />
  <circle cx="64" cy="64" r="34.5" fill="none" stroke="${accent}" stroke-width="13" />
  <line x1="35" y1="93" x2="93" y2="35" stroke="${accent}" stroke-width="11.5" />
</svg>`;

const coverBase = (width, height) => `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${width}px; height: ${height}px; overflow: hidden;
    background: #0a0f1a;
    background-image:
      radial-gradient(760px 420px at 8% -18%, rgba(37, 99, 235, .26), transparent 62%),
      radial-gradient(680px 380px at 100% 112%, rgba(239, 68, 68, .22), transparent 60%);
    color: #f9fafb;
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; align-items: center;
  }
  .word { font-weight: 750; letter-spacing: -1.2px; }
  .lede { color: #9ca3af; }
`;

export const coverHtml = (id) => {
  const { width, height } = COVERS[id];

  if (id === 'promo-small') {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>DR-SIM — promo tile</title>
    <script>${MESSAGE_BUFFER}</script>
    <style>
      ${coverBase(width, height)}
      body { flex-direction: column; justify-content: center; padding: 0 30px; text-align: center; }
      .mark { margin: 0 auto 16px; filter: drop-shadow(0 10px 22px rgba(0, 0, 0, .55)); }
      .word { font-size: 42px; margin-bottom: 9px; }
      .lede { font-size: 14.5px; line-height: 1.4; }
      .chips { display: flex; gap: 6px; justify-content: center; margin-top: 18px; }
      .chip {
        font: 10px ui-monospace, Menlo, monospace; padding: 3px 8px; border-radius: 999px;
        border: 1px solid #374151; color: #9ca3af;
      }
      .chip.block { border-color: #7f1d1d; background: #2a1a1d; color: #fca5a5; }
      .chip.allow { border-color: #14532d; background: #172a20; color: #86efac; }
    </style>
  </head>
  <body>
    <div class="mark">${markSvg(66)}</div>
    <div class="word">DR-SIM</div>
    <p class="lede">Simulate backend outages<br />in your own browser</p>
    <div class="chips">
      <span class="chip allow">/offers/active</span>
      <span class="chip block">/invoices/overdue 503</span>
    </div>
  </body>
</html>
`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>DR-SIM — marquee</title>
    <script>${MESSAGE_BUFFER}</script>
    <style>
      ${coverBase(width, height)}
      body { padding: 0 0 0 70px; gap: 40px; }
      .left { flex: 0 0 560px; }
      .row { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
      .word { font-size: 60px; }
      .lede { font-size: 21px; line-height: 1.34; margin: 0 0 26px; max-width: 560px; }
      .bullets { display: flex; flex-direction: column; gap: 11px; }
      .b { display: flex; align-items: flex-start; gap: 11px; font-size: 15px; color: #d1d5db; }
      .b i {
        flex: 0 0 auto; width: 8px; height: 8px; border-radius: 999px; margin-top: 6px;
        background: #ef4444;
      }
      .b:nth-child(2) i { background: #f59e0b; }
      .b:nth-child(3) i { background: #22c55e; }
      .right { flex: 1 1 auto; align-self: stretch; position: relative; }
      .card {
        position: absolute; border-radius: 12px; overflow: hidden;
        border: 1px solid #3a465a; background: #111827;
        box-shadow: 0 30px 70px rgba(0, 0, 0, .62);
      }
      /* Uygulamanın sol menüsü kadrajın dışında: kapakta anlatan şey kartlar. */
      .card.appcard { top: 76px; left: 0; width: 520px; height: 400px; }
      .card.appcard iframe { width: 700px; height: 448px; margin: -48px 0 0 -180px; }
      .card.panelcard { top: 34px; left: 320px; width: ${PANEL_WIDTH}px; height: 520px; border-bottom: 0; border-radius: 12px 12px 0 0; }
      .card.panelcard iframe { width: ${PANEL_WIDTH}px; height: 520px; }
    </style>
  </head>
  <body>
    <div class="left">
      <div class="row">
        <span>${markSvg(74)}</span>
        <span class="word">DR-SIM</span>
      </div>
      <p class="lede">Find out what your web app does when the backend behind it stops answering.</p>
      <div class="bullets">
        <div class="b"><i></i><span>Cut off the endpoints you choose — only in your own browser</span></div>
        <div class="b"><i></i><span>503, network error or timeout, with the body you define</span></div>
        <div class="b"><i></i><span>No data leaves the device, no host permission at install</span></div>
      </div>
    </div>
    <div class="right">
      <div class="card appcard"><iframe id="app" src="${APP_ORIGIN}${APP_ROUTE}"></iframe></div>
      <div class="card panelcard"><iframe id="panel" src="/panel?scene=loop"></iframe></div>
    </div>
    <img src="/hold?token=${id}" alt="" hidden />
    <script type="module" src="/drive.js?scene=loop&amp;cover=${id}"></script>
  </body>
</html>
`;
};

export const APP_META = { APP_ORIGIN, APP_ROUTE, APP_TITLE };
