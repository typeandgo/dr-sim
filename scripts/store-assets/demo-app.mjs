// Ekran görüntülerinde panelin yanında duran demo uygulama.
//
// Kartların "çalışıyor" / "çöktü" hâli KURGU DEĞİLDİR: sayfa DR-SIM'in gerçek
// interceptor'ını (`dist/content/interceptor.main.js`) yükler, gerçek
// RuntimeConfig'i alır ve istekleri gerçekten atar. Kırmızıya dönen kart,
// DR-SIM'in o isteği gerçekten kestiği anlamına gelir.
import { API_ORIGIN, APP_ROUTE, APP_TITLE, WIDGETS } from './scenes.mjs';

const css = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: #111827;
    color: #f9fafb;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; flex-direction: column;
  }
  .topbar {
    display: flex; align-items: center; gap: 10px;
    padding: 0 16px; height: 44px; flex: 0 0 44px;
    background: #0d131f; border-bottom: 1px solid #374151;
  }
  .mark { width: 16px; height: 16px; border-radius: 4px; background: #2563eb; flex: 0 0 auto; }
  .brand { font-weight: 650; letter-spacing: .2px; }
  .pill {
    font-size: 10px; text-transform: uppercase; letter-spacing: .8px;
    color: #9ca3af; border: 1px solid #374151; border-radius: 999px; padding: 1px 7px;
  }
  .spacer { flex: 1 1 auto; }
  .who { color: #9ca3af; font-size: 12px; }
  .avatar { width: 22px; height: 22px; border-radius: 999px; background: #263243; border: 1px solid #4b5563; }

  .shell { flex: 1 1 auto; display: flex; min-height: 0; }
  .nav {
    flex: 0 0 168px; padding: 14px 10px; background: #0d131f;
    border-right: 1px solid #374151; display: flex; flex-direction: column; gap: 2px;
  }
  .nav h4 {
    margin: 4px 8px 8px; font-size: 10px; letter-spacing: .9px;
    text-transform: uppercase; color: #6b7280; font-weight: 600;
  }
  .nav a { padding: 6px 8px; border-radius: 6px; color: #d1d5db; text-decoration: none; }
  .nav a.on { background: #1f2937; color: #fff; font-weight: 600; }

  main { flex: 1 1 auto; padding: 16px 18px; overflow: hidden; }
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 2px; }
  h1 { font-size: 17px; margin: 0; letter-spacing: -.2px; }
  .crumb { color: #6b7280; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
  .lede { color: #9ca3af; margin: 0 0 14px; font-size: 12px; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  /* Izgara öğesinin varsayılan min-width'i içeriğin en dar hâlidir; mono path
     satırı yüzünden kartlar kabı taşırıyordu. */
  .grid > * { min-width: 0; }
  .card {
    background: #1f2937; border: 1px solid #374151; border-left: 3px solid #4b5563;
    border-radius: 8px; padding: 10px 12px; min-height: 72px;
  }
  .card .label { color: #9ca3af; font-size: 11px; margin-bottom: 6px; }
  .card .value { font-size: 21px; font-weight: 650; letter-spacing: -.4px; }
  .card .value.text { font-size: 14px; font-weight: 600; }
  .card .ep {
    margin-top: 6px; color: #6b7280; font-size: 10px;
    font-family: ui-monospace, Menlo, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .card.ok { border-left-color: #22c55e; }
  .card.pending .value { color: #4b5563; }
  .card.down { border-left-color: #ef4444; background: #24202a; }
  .card.down .value { font-size: 13px; font-weight: 600; color: #fca5a5; }
  .card.down .ep { color: #b1707a; }

  .strip {
    margin-top: 14px; display: flex; align-items: center; gap: 8px;
    border: 1px solid #7f1d1d; background: #2a1a1d; color: #fca5a5;
    border-radius: 8px; padding: 8px 12px; font-size: 12px;
  }
  .strip b { color: #fecaca; font-weight: 650; }
  .strip[hidden] { display: none; }
  .dot { width: 7px; height: 7px; border-radius: 999px; background: #ef4444; flex: 0 0 auto; }
`;

const card = (widget) => `      <article class="card pending" data-id="${widget.id}">
        <div class="label">${widget.label}</div>
        <div class="value">—</div>
        <div class="ep">${widget.xhr ? 'XHR ' : 'GET '}${widget.path}</div>
      </article>`;

export const demoAppHtml = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${APP_TITLE}</title>
    <style>${css}</style>
    <script src="http://localhost:7180/content/interceptor.main.js"></script>
  </head>
  <body>
    <div class="topbar">
      <span class="mark"></span>
      <span class="brand">${APP_TITLE}</span>
      <span class="pill">demo</span>
      <span class="spacer"></span>
      <span class="who">operations</span>
      <span class="avatar"></span>
    </div>

    <div class="shell">
      <nav class="nav">
        <h4>Workspace</h4>
        <a href="#">Overview</a>
        <a href="#" class="on">Orders</a>
        <a href="#">Invoices</a>
        <a href="#">Messages</a>
        <a href="#">Customers</a>
        <h4>Account</h4>
        <a href="#">Billing</a>
        <a href="#">Settings</a>
      </nav>

      <main>
        <div class="head">
          <h1>Orders</h1>
          <span class="crumb">${APP_ROUTE}</span>
        </div>
        <p class="lede">Each tile below is one backend endpoint.</p>

        <div class="grid">
${WIDGETS.map(card).join('\n')}
        </div>

        <div class="strip" id="strip" hidden>
          <span class="dot"></span>
          <span><b id="downCount">0</b> of ${WIDGETS.length} tiles could not load — the rest of the page still works.</span>
        </div>
      </main>
    </div>

    <script>
      const API = ${JSON.stringify(API_ORIGIN)};
      const WIDGETS = ${JSON.stringify(WIDGETS)};
      const TOKEN = 'drsim-store-harness';

      // Interceptor'dan çıkan telemetriyi tezgâha taşı: paneldeki envanter ve
      // loglar bu gerçek kayıtlardan üretiliyor.
      addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== 'DRSIM_TELEMETRY' || data.__drsim !== TOKEN) return;
        parent.postMessage({ type: 'DEMO_TELEMETRY', records: data.records, dropped: data.dropped }, '*');
      });

      const paint = (widget, state, value, detail) => {
        const element = document.querySelector('[data-id="' + widget.id + '"]');
        element.className = 'card ' + state;
        const box = element.querySelector('.value');
        box.textContent = value;
        box.classList.toggle('text', widget.field === 'value' || state === 'down');
        if (detail) element.querySelector('.ep').textContent = detail;
      };

      let down = 0;
      const markDown = () => {
        down += 1;
        document.getElementById('downCount').textContent = String(down);
        document.getElementById('strip').hidden = false;
      };

      const show = (widget, payload) => paint(widget, 'ok', String(payload[widget.field]));

      const fail = (widget, status, statusText, simulated) => {
        markDown();
        paint(
          widget,
          'down',
          status ? 'Unavailable' : 'No response',
          (status ? status + ' ' + statusText : 'network error') + (simulated ? ' · simulated' : ''),
        );
      };

      const viaFetch = async (widget) => {
        try {
          const response = await fetch(API + widget.path);
          const simulated = response.headers.get('x-drsim-simulated') === '1';
          if (!response.ok) {
            fail(widget, response.status, response.statusText, simulated);
            return;
          }
          show(widget, await response.json());
        } catch {
          fail(widget, 0, '', false);
        }
      };

      const viaXhr = (widget) => new Promise((resolve) => {
        const request = new XMLHttpRequest();
        request.open('GET', API + widget.path);
        request.onload = () => {
          const simulated = request.getAllResponseHeaders().includes('x-drsim-simulated');
          if (request.status >= 400) fail(widget, request.status, request.statusText, simulated);
          else show(widget, JSON.parse(request.responseText));
          resolve();
        };
        request.onerror = () => { fail(widget, 0, '', false); resolve(); };
        request.send();
      });

      const run = async () => {
        await Promise.all(WIDGETS.map((widget) => (widget.xhr ? viaXhr(widget) : viaFetch(widget))));
        parent.postMessage({ type: 'DEMO_DONE' }, '*');
      };

      // Tezgâh önce config'i verir; interceptor'ın patch'i yerine oturmadan
      // istek atmak senaryoyu yarım gösterirdi.
      let started = false;
      addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'DEMO_CONFIG' || started) return;
        started = true;
        postMessage({ type: 'DRSIM_INIT', token: TOKEN }, location.origin);
        postMessage({ type: 'DRSIM_CONFIG', config: event.data.config, __drsim: TOKEN }, location.origin);
        setTimeout(run, 30);
      });

      parent.postMessage({ type: 'DEMO_READY' }, '*');
    </script>
  </body>
</html>
`;
