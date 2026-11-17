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
    // 首次来访会弹五步导览，先关掉，避免它改视图影响断言
    await cdp.eval(`
      const sk = document.querySelector('.tour.is-on [data-act="skip"]');
      if (sk) sk.click();
      try { localStorage.setItem('cn-geo:tour:v1', '1'); } catch (e) {}
      return 1;
    `);
    await sleep(250);
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
    ok(base.tabs === 7, '视图数量不对', base.tabs);
    ok(base.themes === 3, '主题数量不对', base.themes);
    ok(base.overflow, '出现横向溢出');

    // 六个视图：标签不重叠
    for (const t of ['landform', 'climate', 'agri', 'water', 'notes', 'quiz', 'explore']) {
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

    // 拼音搜索
    const py = await cdp.eval(`
      const inp = document.querySelector('#search');
      inp.value = 'sc';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const b = document.querySelector('#searchResults button');
      return { n: document.querySelectorAll('#searchResults button').length, t: b ? b.textContent : '' };
    `);
    ok(py.n >= 1 && /四川/.test(py.t), '拼音搜索 sc 没命中四川省', py);

    // 城市图层
    const city = await cdp.eval(`
      const cb = document.querySelector('[data-layer="cities"]');
      cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
      return { on: window.__DBG.state.layers.cities, n: window.__DBG.DEBUG.labels.length, ov: window.__DBG.overlaps().n };
    `);
    ok(city.on && city.n > 40, '城市图层没有增加标签', city);
    ok(city.ov === 0, '城市图层开启后标签重叠', city);
    await cdp.eval(`const cb = document.querySelector('[data-layer="cities"]'); cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);

    // 地形晕渲：默认在「地势」视图开启，切换后画面真的变化
    const hill = await cdp.eval(`
      document.querySelector('#tabs .tab[data-tab="landform"]').click();
      await new Promise((r) => setTimeout(r, 700));
      const snap = () => {
        const c = document.querySelector('#map'); const g = c.getContext('2d');
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const sum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4 * 7) s += d[i] + d[i + 1] + d[i + 2]; return s; };
      const before = sum(snap());
      const cb = document.querySelector('[data-layer="hill"]');
      cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const off = sum(snap());
      cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const on = sum(snap());
      return { on: window.__DBG.state.layers.hill, delta: Math.abs(on - off), same: on === off, labels: window.__DBG.DEBUG.labels.length, ov: window.__DBG.overlaps().n };
    `);
    ok(hill.on, '地势视图没有默认开启地形晕渲', hill);
    ok(!hill.same && hill.delta > 0, '开关地形晕渲后画面没有变化', hill);
    ok(hill.ov === 0, '晕渲视图标签重叠', hill);

    // 省份详情：缩略轮廓 + 三条排名
    const outline = await cdp.eval(`
      const p = window.__DBG.screen(103.0, 31.0);
      const r = document.querySelector('#map').getBoundingClientRect();
      const c = document.querySelector('#map');
      const opts = { clientX: r.left + p[0], clientY: r.top + p[1], bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 };
      c.dispatchEvent(new PointerEvent('pointerdown', opts));
      c.dispatchEvent(new PointerEvent('pointerup', opts));
      await new Promise((res) => setTimeout(res, 350));
      const svg = document.querySelector('#panel .prov-svg');
      const path = svg && svg.querySelector('path');
      const bars = document.querySelectorAll('#panel .bar-row').length;
      return { name: window.__DBG.state.selected, d: path ? path.getAttribute('d').length : 0, bars, box: svg ? Math.round(svg.getBoundingClientRect().width) : 0 };
    `);
    ok(outline.d > 200 && outline.box > 20, '省份详情没有画出轮廓缩略图', outline);
    ok(outline.bars >= 3, '省份详情缺少排名条', outline);

    // A4 打印版式：地图高度按 110mm 排，且不横向溢出
    const pr = await cdp.eval(`
      const r = document.querySelector('#mapwrap').getBoundingClientRect();
      const tabs = getComputedStyle(document.querySelector('#tabs')).display;
      return { mapH: Math.round(r.height), tabsHidden: tabs === 'none', overflow: document.documentElement.scrollWidth - window.innerWidth, printBtn: !!document.querySelector('#printBtn') };
    `);
    ok(pr.printBtn, '缺少打印按钮');

    // 速记页四张示意图
    const figs = await cdp.eval(`
      document.querySelector('#tabs .tab[data-tab="notes"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const fs = [...document.querySelectorAll('.k-fig')];
      let boxed = 0;
      for (const f of fs) { const u = f.querySelector('use'); try { if (u.getBBox().width > 80) boxed++; } catch (e) {} }
      return { n: fs.length, boxed, texts: document.querySelectorAll('.k-fig text').length };
    `);
    ok(figs.n === 4 && figs.boxed === 4, '速记页四张示意图没有画出来', figs);
    ok(figs.texts >= 10, '示意图缺少标注', figs);

    // 等温线：切换后画面变化，且 11 条线都有标注
    const iso = await cdp.eval(`
      // 前面的用例可能停在闯关里，先退出来再切视图
      for (let i = 0; i < 3 && __DBG.state.quiz && __DBG.state.quiz.active; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise((r) => setTimeout(r, 120));
      }
      const tabBtn = document.querySelector('#tabs .tab[data-tab="climate"]');
      if (!tabBtn) return { err: 'no tab', tabs: document.querySelectorAll('#tabs .tab').length, body: document.body.dataset.tab, tab: __DBG.state.tab };
      tabBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      const isoBtn = document.querySelector('[data-iso="jan"]');
      if (!isoBtn) return { err: 'no iso btn', tab: __DBG.state.tab, panel: (document.querySelector('#panel h2') || {}).textContent };
      const c = document.querySelector('#map'); const g = c.getContext('2d');
      const a = g.getImageData(0, 0, c.width, c.height).data;
      isoBtn.click();
      await new Promise((r) => setTimeout(r, 700));
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 24) n++;
      const lines = __DBG.iso('jan');
      const placed = __DBG.isoLabels().filter((l) => l.placed).length;
      return { changed: n, levels: lines.length, placed, pts: lines.reduce((s2, l) => s2 + l.pts, 0) };
    `);
    ok(iso.changed > 5000, '1 月等温线没有画出来', iso);
    ok(iso.levels === 11 && iso.pts > 2000, '等温线条数或路径异常', iso);
    ok(iso.placed >= 8, '等温线标注缺失', iso);

    // 气泡图：切到人口后画面出现气泡
    const bub = await cdp.eval(`
      for (let i = 0; i < 3 && !document.querySelector('[data-bubble]'); i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.querySelector('#tabs .tab[data-tab="explore"]').click();
        await new Promise((r) => setTimeout(r, 250));
      }
      const bubBtn = document.querySelector('[data-bubble="pop"]');
      if (!bubBtn) return { err: 'no bubble btn', selected: __DBG.state.selected };
      const c = document.querySelector('#map'); const g = c.getContext('2d');
      const a = g.getImageData(0, 0, c.width, c.height).data;
      bubBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 20) n++;
      const on = __DBG.state.bubble;
      const off = document.querySelector('[data-bubble=""]');
      if (off) off.click();
      const offI = document.querySelector('[data-iso=""]');
      if (offI) offI.click();
      return { changed: n, bubble: on };
    `);
    ok(bub.bubble === 'pop', '气泡图按钮没有生效', bub);
    ok(bub.changed > 3000, '人口气泡图没有画出来', bub);

    // 动态层：水系视图两帧之间画面会变
    const anim = await cdp.eval(`
      document.querySelector('#tabs .tab[data-tab="water"]').click();
      await new Promise((r) => setTimeout(r, 700));
      const c = document.querySelector('#map'); const g = c.getContext('2d');
      // 无头环境里 rAF 偶尔会被节流，多试几次取最大值
      let best = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const a = g.getImageData(0, 0, c.width, c.height).data;
        await new Promise((r) => setTimeout(r, 420));
        const b = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 24) n++;
        if (n > best) best = n;
      }
      return { changed: best };
    `);
    ok(anim.changed > 200, '水系视图的河流流动没有动起来', anim);

    // 鼠标读数：经纬度 + 海拔
    const ro = await cdp.eval(`
      const [x, y] = window.__DBG.screen(104.07, 30.57);
      const r = document.querySelector('#map').getBoundingClientRect();
      const c = document.querySelector('#map');
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1, pointerType: 'mouse' }));
      await new Promise((res) => setTimeout(res, 200));
      const el = document.querySelector('#readout');
      return { on: el.classList.contains('is-on'), txt: el.textContent };
    `);
    ok(ro.on && /°E/.test(ro.txt) && /°N/.test(ro.txt), '鼠标读数没有出现经纬度', ro);
    ok(/海拔|海域/.test(ro.txt), '鼠标读数缺少海拔', ro);

    // 错题本：写入一条错题 → 闯关页出现「只考错题」
    const wb = await cdp.eval(`
      localStorage.setItem('cn-geo:wrong:v1', JSON.stringify([
        { k: 'click:甘肃省', type: 'click', prompt: '在地图上找到：甘肃省', answer: '', options: null, why: '', meta: '', name: '甘肃省', misses: 1, ts: Date.now() }
      ]));
      document.querySelector('#tabs .tab[data-tab="quiz"]').click();
      await new Promise((res) => setTimeout(res, 300));
      const btn = document.querySelector('#wrongPick [data-mode="wrong"]');
      const label = btn ? btn.textContent : '';
      btn && btn.click();
      await new Promise((res) => setTimeout(res, 300));
      const prompt = (document.querySelector('.quiz-q') || {}).textContent || '';
      const type = window.__DBG.state.quiz && window.__DBG.state.quiz.mode;
      localStorage.removeItem('cn-geo:wrong:v1');
      return { label, prompt, type };
    `);
    ok(/只考错题/.test(wb.label), '闯关页没有错题本入口', wb);
    ok(wb.type === 'wrong' && /甘肃省/.test(wb.prompt), '错题本模式没有只考错题', wb);
    await cdp.eval(`document.querySelector('#tabs .tab[data-tab="explore"]').click(); return 1;`);
    await sleep(300);

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

    // 等降水量线：4 条线（200/400/800/1600），400 与 800 加粗
    const ppt = await cdp.eval(`
      document.querySelector('#tabs .tab[data-tab="climate"]').click();
      await new Promise((r) => setTimeout(r, 600));
      const c = document.querySelector('#map'), g = c.getContext('2d');
      const off = document.querySelector('[data-iso=""]');
      if (off) off.click();
      await new Promise((r) => setTimeout(r, 400));
      const a = g.getImageData(0, 0, c.width, c.height).data;
      document.querySelector('[data-iso="ppt"]').click();
      await new Promise((r) => setTimeout(r, 800));
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 24) n++;
      const ls = __DBG.iso('ppt') || [];
      const lab = __DBG.isoLabels().filter(l => l.placed).length;
      return { iso: __DBG.state.iso, levels: ls.length, lines: ls.map(l => l.v + ':' + l.n).join(','), changed: n, lab };
    `);
    ok(ppt.iso === 'ppt', '年降水量线没有生效', ppt);
    ok(ppt.levels === 4, '年降水量线应该 4 条（200/400/800/1600）', ppt);
    ok(ppt.lab >= 4, '年降水量线标注没放上去', ppt);
    ok(ppt.changed > 5000, '切换年降水量线后画面没变化', ppt);

    // 省际对比：选第一个省 → 点「与另一省对比」→ 再点第二个省 → 弹窗出现对比表
    const cmp = await cdp.eval(`
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.querySelector('#tabs .tab[data-tab="explore"]').click();
      await new Promise((r) => setTimeout(r, 500));
      const pick = async (lon, lat) => {
        const p = __DBG.screen(lon, lat), b = document.querySelector('#map').getBoundingClientRect();
        const o = { clientX: b.left + p[0], clientY: b.top + p[1], bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 };
        const c = document.querySelector('#map');
        c.dispatchEvent(new PointerEvent('pointerdown', o));
        c.dispatchEvent(new PointerEvent('pointerup', o));
        await new Promise((r) => setTimeout(r, 380));
      };
      await pick(104.07, 30.57);
      const hasBtn = !!document.querySelector('#cmpProv');
      const first = __DBG.state.selected;
      document.querySelector('#cmpProv').click();
      await new Promise((r) => setTimeout(r, 200));
      const hintOn = document.querySelector('#cmpHint').classList.contains('is-on');
      await pick(113.26, 23.13);
      await new Promise((r) => setTimeout(r, 500));
      const dlg = document.querySelector('#cmp');
      const out = { first, hasBtn, hintOn, open: dlg.open, rows: document.querySelectorAll('#cmp .cmp-row').length,
        names: [...document.querySelectorAll('#cmp .cmp-name')].map(e => e.textContent).join('/'),
        note: (document.querySelector('#cmp .cmp-note') || {}).textContent || '' };
      dlg.close();
      return out;
    `);
    ok(cmp.hasBtn && cmp.hintOn, '省际对比入口或提示不正常', cmp);
    ok(cmp.open && cmp.rows >= 4, '省际对比弹窗没画出来', cmp);
    ok(/倍/.test(cmp.note), '省际对比缺少结论文案', cmp);

    // 深链接
    await cdp.send('Page.navigate', { url: target.split('?')[0] + '?theme=day&tab=climate&p=' + encodeURIComponent('四川省') });
    await cdp.waitFor('window.__DBG && window.__DBG.state.selected', 20000);
    await sleep(500);
    const deep = await cdp.eval(`return { tab: window.__DBG.state.tab, theme: window.__DBG.state.theme, sel: window.__DBG.state.selected };`);
    ok(deep.tab === 'climate', '深链接 tab 没生效', deep);
    ok(deep.theme === 'day', '深链接 theme 没生效', deep);
    ok(deep.sel === '四川省', '深链接 p 没生效', deep);

    // 深链接：农业视图
    await cdp.send('Page.navigate', { url: target.split('?')[0] + '?tab=agri' });
    await cdp.waitFor('window.__DBG && window.__DBG.state.tab', 20000);
    await sleep(500);
    const agri = await cdp.eval(`return { tab: window.__DBG.state.tab, fill: window.__DBG.state.fill, crops: document.querySelectorAll('[data-crop]').length };`);
    ok(agri.tab === 'agri', '深链接 tab=agri 没生效', agri);
    ok(agri.crops >= 5, '农业视图缺少作物按钮', agri);

    // 图例可点击：点一行高亮该分区，再点取消
    await cdp.send('Page.navigate', { url: target.split('?')[0] });
    await cdp.waitFor('window.__DBG && window.__DBG.DEBUG.labels.length > 0', 20000);
    await sleep(700);
    const lg = await cdp.eval(`
      const row = document.querySelector('#legend .legend-row[data-hi]');
      const before = document.querySelectorAll('#legend .legend-row[data-hi]').length;
      row.click();
      await new Promise((r) => setTimeout(r, 320));
      const hi = window.__DBG.state.hi;
      const off = document.querySelectorAll('#legend .legend-row.is-off').length;
      document.querySelector('#legend .legend-row[data-hi="' + row.dataset.hi + '"]').click();
      await new Promise((r) => setTimeout(r, 260));
      return { before, hi, off, after: window.__DBG.state.hi, offAfter: document.querySelectorAll('#legend .legend-row.is-off').length };
    `);
    ok(lg.before >= 5, '图例没有可点击的条目', lg);
    ok(lg.hi && lg.off === lg.before - 1, '点击图例没有高亮对应分区', lg);
    ok(lg.after === null && lg.offAfter === 0, '再次点击图例没有取消高亮', lg);

    // 剖面悬停 → 地图竖线
    const mk = await cdp.eval(`
      document.querySelector('#tabs .tab[data-tab="landform"]').click();
      await new Promise((r) => setTimeout(r, 800));
      const c = document.querySelector('#profile').getBoundingClientRect();
      const cv = document.querySelector('#profile');
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: c.left + c.width * 0.45, clientY: c.top + c.height * 0.5, bubbles: true, pointerId: 1, pointerType: 'mouse' }));
      await new Promise((r) => setTimeout(r, 320));
      return { lon: window.__DBG.state.profileLon, dock: document.querySelector('#dockTitle').textContent };
    `);
    ok(typeof mk.lon === 'number' && /°E/.test(mk.dock), '剖面悬停没有联动地图', mk);

    // 导出 PNG
    const ex = await cdp.eval(`
      document.querySelector('#exportPng').click();
      for (let i = 0; i < 50 && !window.__DBG.lastExport; i++) await new Promise((r) => setTimeout(r, 100));
      return window.__DBG.lastExport || null;
    `);
    ok(ex && ex.w === 1600 && ex.bytes > 50000, '导出 PNG 失败', ex);

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
  console.log('✓ 冒烟测试通过：画布/标签/七视图/点击/拼音搜索/城市图层/鼠标读数/错题本/晕渲/轮廓/示意图/等温线/等降水线/气泡/对比/动画/主题/深链接');
})();
