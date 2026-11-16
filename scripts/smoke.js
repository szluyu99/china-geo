#!/usr/bin/env node
/**
 * 冒烟测试：无第三方依赖。
 * 用本机 Chrome 的 DevTools 协议打开单文件成品，检查「画出来了 / 标签不重叠 / 能点 / 能搜 / 主题会换 / 深链接生效」。
 * 用法：node scripts/smoke.js [file|url]      缺省用 dist/china-geo.html
 * 指定浏览器：CHROME=/path/to/chrome node scripts/smoke.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const target = process.argv[2] || 'file://' + path.join(root, 'dist/china-geo.html');
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

const exe = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!exe) { console.error('✗ 找不到 Chrome，可用 CHROME=... 指定'); process.exit(1); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cngeo-smoke-'));
const chrome = spawn(exe, [
  '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files', '--window-size=1440,900', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const fails = [];
const ok = (cond, msg, extra) => { if (!cond) fails.push(msg + (extra ? ` → ${JSON.stringify(extra)}` : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function browserWS() {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('等待 DevTools 端口超时')), 20000);
    chrome.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    chrome.on('exit', (code) => { clearTimeout(timer); reject(new Error('Chrome 提前退出 ' + code)); });
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket 连接失败')); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { res, rej } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        c.errors.push('异常：' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        c.errors.push('console.error：' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(method + ' 超时')); } }, 30000);
    });
  }
  async eval(body) {
    const r = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async waitFor(expr, timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = await this.eval(`return !!(${expr});`).catch(() => false);
      if (v) return true;
      await sleep(120);
    }
    throw new Error('等待超时：' + expr);
  }
}

(async () => {
  let cdp;
  try {
    const ws = await browserWS();
    const origin = ws.replace('ws://', 'http://').replace(/\/devtools\/.*$/, '');
    const list = await (await fetch(origin + '/json/list')).json();
    const page = list.find((t) => t.type === 'page');
    cdp = await CDP.connect(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    await cdp.send('Page.navigate', { url: target });
    await cdp.waitFor('window.__DBG && window.__DBG.DEBUG.labels.length > 0', 20000);
    await sleep(600);

    const base = await cdp.eval(`
      return {
        labels: window.__DBG.DEBUG.labels.length,
        overlaps: window.__DBG.overlaps().n,
        tabs: [...document.querySelectorAll('#tabs .tab')].length,
        themes: [...document.querySelectorAll('#themer button')].length,
        canvas: (() => { const c = document.querySelector('#map'); return c.width > 300 && c.height > 300; })(),
        overflow: document.documentElement.scrollWidth <= window.innerWidth + 1
      };
    `);
    ok(base.canvas, '地图画布没有尺寸');
    ok(base.labels >= 28, '省份标签缺失', base.labels);
    ok(base.overlaps === 0, '省份标签重叠', base.overlaps);
    ok(base.tabs === 6, '视图数量不对', base.tabs);
    ok(base.themes === 3, '主题数量不对', base.themes);
    ok(base.overflow, '出现横向溢出');

    // 六个视图：标签不重叠
    for (const t of ['landform', 'climate', 'water', 'notes', 'quiz', 'explore']) {
      await cdp.eval(`document.querySelector('#tabs .tab[data-tab="${t}"]').click(); return 1;`);
      await sleep(350);
      const o = await cdp.eval(`return { ov: window.__DBG.overlaps().n, tab: window.__DBG.state.tab };`);
      ok(o.ov === 0, `${t} 视图标签重叠 ${o.ov} 处`);
      ok(o.tab === t, `${t} 视图没切换成功`);
    }

    // 点击省份
    const pt = await cdp.eval(`
      const [x, y] = window.__DBG.screen(113.4, 23.4);
      const r = document.querySelector('#map').getBoundingClientRect();
      return [Math.round(r.left + x), Math.round(r.top + y)];
    `);
    await cdp.eval(`
      const c = document.querySelector('#map');
      const opts = { clientX: ${pt[0]}, clientY: ${pt[1]}, bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 };
      c.dispatchEvent(new PointerEvent('pointerdown', opts));
      c.dispatchEvent(new PointerEvent('pointerup', opts));
      return 1;
    `);
    await sleep(400);
    const sel = await cdp.eval(`return { name: window.__DBG.state.selected, head: (document.querySelector('#panel h2') || {}).textContent || '' };`);
    ok(!!sel.name, '点击地图没有选中省份');
    ok(!/undefined|NaN|\[object/.test(sel.head), '详情面板出现异常文本', sel.head);

    // 搜索
    const search = await cdp.eval(`
      const inp = document.querySelector('#search');
      inp.value = '长江';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      return document.querySelectorAll('#searchResults button').length;
    `);
    ok(search >= 1, '搜索「长江」没有结果');

    // 主题
    const bright = [];
    for (const t of ['night', 'paper', 'day']) {
      await cdp.eval(`document.querySelector('#themer button[data-theme="${t}"]').click(); return 1;`);
      await sleep(400);
      bright.push(await cdp.eval(`
        const c = document.querySelector('#map'), g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 101) { s += 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]; n++; }
        return Math.round(s / n);
      `));
    }
    ok(bright[0] + 40 < bright[2], '夜间与白昼主题亮度没有明显差异', bright);

    // 深链接
    await cdp.send('Page.navigate', { url: target.split('?')[0] + '?theme=day&tab=climate&p=' + encodeURIComponent('四川省') });
    await cdp.waitFor('window.__DBG && window.__DBG.state.selected', 20000);
    await sleep(500);
    const deep = await cdp.eval(`return { tab: window.__DBG.state.tab, theme: window.__DBG.state.theme, sel: window.__DBG.state.selected };`);
    ok(deep.tab === 'climate', '深链接 tab 没生效', deep);
    ok(deep.theme === 'day', '深链接 theme 没生效', deep);
    ok(deep.sel === '四川省', '深链接 p 没生效', deep);

    ok(cdp.errors.length === 0, '控制台有报错', cdp.errors.slice(0, 3));
  } catch (e) {
    fails.push(e.message);
  } finally {
    try { chrome.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }

  if (fails.length) {
    console.error(`✗ 冒烟测试失败（${fails.length} 项）`);
    for (const f of fails) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('✓ 冒烟测试通过：画布/标签/六视图/点击/搜索/主题/深链接');
})();
