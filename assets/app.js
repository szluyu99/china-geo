/* ============================================================
   中国地理图谱 — 应用逻辑
   ============================================================ */
(() => {
  'use strict';

  const C = window.CN_CONTENT;
  const GEO = window.CN_GEO;
  const RAD = Math.PI / 180;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (n, d = 0) => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });

  const REGION_ORDER = ['华北', '东北', '华东', '华中', '华南', '西南', '西北'];
  const CLIM = Object.fromEntries(C.climates.map((c) => [c.id, c]));
  const STEP = Object.fromEntries(C.steps.map((s) => [s.id, s]));
  const CROPS = C.crops || [];
  const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));
  const PROV_BY_NAME = Object.fromEntries(C.provinces.map((p) => [p.name, p]));
  const RANK = (() => {
    const byArea = C.provinces.slice().sort((a, b) => b.area - a.area).map((p) => p.name);
    const byPop = C.provinces.slice().sort((a, b) => b.pop - a.pop).map((p) => p.name);
    const index = (list) => Object.fromEntries(list.map((n, i) => [n, i + 1]));
    return { area: index(byArea), pop: index(byPop) };
  })();
  const TAB_NAME = {
    explore: '地理分区', landform: '地势三级阶梯', climate: '气候类型',
    agri: '农业分区', water: '水系', notes: '速记', quiz: '闯关'
  };

  const state = {
    tab: 'explore',
    fill: 'region',
    layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false, rail: true, ports: true, hubs: true, bases: true, channels: true },
    selected: null,
    hover: null,
    iso: null,        // 'jan' | 'jul' | 'ppt' | null 等温线 / 等降水量线
    compare: null,    // 对比模式：先记住第一个省，再点第二个省
    bubble: null,     // 'pop' | 'area' | null 气泡图
    hoverMountain: null,
    hoverRiver: null,
    selectedMountain: null,
    selectedInfra: null,   // 交通/能源：{kind, name}
    hoverInfra: null,
    railYear: null,   // 高铁里程时间轴：null = 最新一年
    selectedRiver: null,
    highlightClimate: null,
    hi: null,
    profileLon: null,
    focusLandform: null,
    quiz: null,
    quizMarks: {},
    view: { k: 1, tx: 0, ty: 0 },
    reveal: 0,
    revealT0: 0,
    forceLabelsUntil: 0,
    dimOthers: null,
    theme: 'night',
    layersTouched: false,
    preQuizLayers: null
  };


  /* ------------------------------------------------------------
     主题：CSS 负责界面，地图上的颜色由这里决定
     每个主题提供同一组键，draw* 只读 TH.*
     ------------------------------------------------------------ */
  const NIGHT = {
    sea0: '#0d1a22', sea1: '#0a1319', sea2: '#060a0e',
    coastShadow: 'rgba(8,14,18,0.62)', coastLight: 'rgba(232,240,244,0.30)',
    hillDark: [2, 6, 10], hillLight: [206, 222, 238], hillAlpha: 0.95,
    grid: 'rgba(150,190,210,0.055)', gridText: 'rgba(150,190,210,0.28)', seaText: 'rgba(140,185,205,0.34)',
    stepLine: 'rgba(243,232,211,0.5)',
    qin: 'rgba(127,212,193,0.85)', qinText: 'rgba(150,230,212,0.95)',
    hu: 'rgba(224,192,122,0.55)', huText: 'rgba(232,206,150,0.9)',
    agri: 'rgba(120,190,170,0.62)',
    riverCasing: 'rgba(4,10,14,0.55)', riverActive: 'rgba(255,255,255,0.55)',
    monsoonWarm: 'rgba(226,178,102,0.9)', monsoonCold: 'rgba(120,190,224,0.9)',
    isoCold: 'rgba(120,172,214,0.92)', isoWarm: 'rgba(226,150,96,0.92)', isoZero: 'rgba(232,196,120,0.95)', isoWet: 'rgba(110,196,186,0.9)', isoText: 'rgba(238,242,246,0.95)', bubble: '#5fbfa3',
    mtn: 'rgba(232,206,150,0.82)', mtnActive: '#f6d79b', mtnShadow: 'rgba(0,0,0,0.6)',
    sel: 'rgba(255,214,140,0.95)', selGlow: 'rgba(255,196,110,0.55)',
    capDot: 'rgba(255,255,255,0.9)', capDotEdge: 'rgba(12,20,26,0.9)', capText: 'rgba(233,240,244,0.9)',
    riverText: 'rgba(190,220,235,0.82)', riverTextActive: '#eaf7ff',
    mtnText: 'rgba(226,206,168,0.82)', mtnTextActive: '#fbe6bd',
    provText: 'rgba(240,246,249,0.92)', provTextActive: '#ffe4b5', stepText: 'rgba(255,255,255,0.45)',
    leader: 'rgba(255,255,255,0.28)', halo: 'rgba(5,10,14,0.72)',
    insetBg: 'rgba(7,12,16,0.72)', insetEdge: 'rgba(255,255,255,0.14)',
    insetLand: 'rgba(150,172,184,0.5)', insetLandEdge: 'rgba(178,200,212,0.35)',
    insetDash: 'rgba(216,166,87,0.62)', insetText: 'rgba(255,255,255,0.4)',
    vignette: 'rgba(0,0,0,0.42)', quizFill: 'rgba(110,132,146,0.30)',
    toneTo: '#000000', toneAmt: 0, fillBoost: 1,
    profGrid: 'rgba(255,255,255,0.07)', profAxis: 'rgba(140,165,180,0.55)',
    profAxis2: 'rgba(140,165,180,0.6)', profAxis3: 'rgba(140,165,180,0.45)', profAxis4: 'rgba(140,165,180,0.5)',
    profGrad1: 'rgba(240,201,135,0.55)', profGrad2: 'rgba(200,160,110,0.35)', profGrad3: 'rgba(95,120,110,0.10)',
    profLine: 'rgba(244,214,160,0.95)', profCross: 'rgba(255,255,255,0.22)',
    profDot: '#f6d79b', profDot2: '#f0c987', profLabel: 'rgba(233,240,244,0.78)', profHover: 'rgba(216,166,87,0.5)'
  };

  const PAPER = {
    sea0: '#f9f3e6', sea1: '#f4ecdc', sea2: '#e9dfca',
    coastShadow: 'rgba(96,76,44,0.30)', coastLight: 'rgba(255,255,255,0.55)',
    hillDark: [58, 42, 24], hillLight: [255, 252, 242], hillAlpha: 0.95,
    grid: 'rgba(120,100,70,0.10)', gridText: 'rgba(110,92,62,0.45)', seaText: 'rgba(60,105,125,0.34)',
    stepLine: 'rgba(120,95,58,0.55)',
    qin: 'rgba(32,122,104,0.85)', qinText: 'rgba(22,104,88,0.95)',
    hu: 'rgba(150,105,35,0.55)', huText: 'rgba(128,90,22,0.95)',
    agri: 'rgba(46,132,112,0.62)',
    riverCasing: 'rgba(255,255,255,0.62)', riverActive: 'rgba(20,60,90,0.45)',
    monsoonWarm: 'rgba(168,116,34,0.75)', monsoonCold: 'rgba(40,108,142,0.75)',
    isoCold: 'rgba(42,104,150,0.88)', isoWarm: 'rgba(184,88,44,0.88)', isoZero: 'rgba(158,104,20,0.95)', isoWet: 'rgba(22,116,110,0.9)', isoText: 'rgba(28,36,44,0.95)', bubble: '#1e7866',
    mtn: 'rgba(150,112,52,0.9)', mtnActive: '#8a5f14', mtnShadow: 'rgba(80,60,30,0.25)',
    sel: 'rgba(150,102,20,0.95)', selGlow: 'rgba(196,146,52,0.42)',
    capDot: 'rgba(255,255,255,0.95)', capDotEdge: 'rgba(64,52,34,0.85)', capText: 'rgba(46,54,60,0.92)',
    riverText: 'rgba(28,72,104,0.88)', riverTextActive: '#0d3c5b',
    mtnText: 'rgba(112,82,34,0.9)', mtnTextActive: '#6b4708',
    provText: 'rgba(28,36,42,0.9)', provTextActive: '#6d4300', stepText: 'rgba(70,62,48,0.55)',
    leader: 'rgba(70,58,38,0.4)', halo: 'rgba(252,248,238,0.88)',
    insetBg: 'rgba(255,252,244,0.88)', insetEdge: 'rgba(96,76,44,0.22)',
    insetLand: 'rgba(126,110,82,0.42)', insetLandEdge: 'rgba(96,80,52,0.38)',
    insetDash: 'rgba(158,110,28,0.7)', insetText: 'rgba(74,62,44,0.72)',
    vignette: 'rgba(120,98,62,0.16)', quizFill: 'rgba(120,120,112,0.22)',
    toneTo: '#2a2118', toneAmt: 0.10, fillBoost: 1.18,
    profGrid: 'rgba(90,76,50,0.12)', profAxis: 'rgba(96,84,62,0.75)',
    profAxis2: 'rgba(96,84,62,0.8)', profAxis3: 'rgba(96,84,62,0.6)', profAxis4: 'rgba(96,84,62,0.65)',
    profGrad1: 'rgba(214,166,96,0.55)', profGrad2: 'rgba(186,146,94,0.32)', profGrad3: 'rgba(110,126,110,0.10)',
    profLine: 'rgba(160,112,32,0.95)', profCross: 'rgba(90,74,50,0.35)',
    profDot: '#b5852a', profDot2: '#9c6f18', profLabel: 'rgba(40,46,52,0.82)', profHover: 'rgba(154,106,29,0.55)'
  };

  const DAY = Object.assign({}, PAPER, {
    sea0: '#f8fbfd', sea1: '#f1f6fa', sea2: '#e4ebf1',
    coastShadow: 'rgba(46,66,86,0.30)', coastLight: 'rgba(255,255,255,0.7)',
    grid: 'rgba(60,90,120,0.10)', gridText: 'rgba(70,95,118,0.45)', seaText: 'rgba(44,96,126,0.34)',
    qin: 'rgba(18,118,100,0.85)', qinText: 'rgba(12,98,84,0.95)',
    hu: 'rgba(160,105,25,0.55)', huText: 'rgba(136,86,14,0.95)',
    agri: 'rgba(34,120,104,0.62)',
    riverCasing: 'rgba(255,255,255,0.7)', riverActive: 'rgba(16,58,88,0.45)',
    monsoonWarm: 'rgba(150,104,30,0.78)', monsoonCold: 'rgba(32,98,132,0.78)',
    isoCold: 'rgba(36,96,140,0.9)', isoWarm: 'rgba(176,80,38,0.9)', isoZero: 'rgba(146,96,18,0.95)', isoWet: 'rgba(18,106,100,0.9)', isoText: 'rgba(24,32,40,0.95)', bubble: '#1a7060',
    insetBg: 'rgba(255,255,255,0.9)', insetLand: 'rgba(118,124,130,0.42)',
    halo: 'rgba(250,252,254,0.9)', vignette: 'rgba(90,110,130,0.14)',
    profGrid: 'rgba(40,60,80,0.10)', profAxis: 'rgba(60,80,100,0.75)',
    profAxis2: 'rgba(60,80,100,0.8)', profAxis3: 'rgba(60,80,100,0.6)', profAxis4: 'rgba(60,80,100,0.65)',
    profLabel: 'rgba(30,40,50,0.82)', profCross: 'rgba(60,80,100,0.35)',
    toneTo: '#1c242c', toneAmt: 0.08
  });

  const CANVAS = { night: NIGHT, paper: PAPER, day: DAY };
  const META_THEME = { night: '#070c11', paper: '#f4eee2', day: '#eef2f6' };
  let TH = NIGHT;

  function mixHex(a, b, t) {
    const h = (x) => { const v = x.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16)); };
    const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
    const m = (x, y) => Math.round(x + (y - x) * t);
    return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  // 浅色主题里把原本为深底调的省色压深一点，避免发灰
  const tone = (hex) => (TH.toneAmt ? mixHex(hex, TH.toneTo, TH.toneAmt) : hex);
  const swatch = (hex) => tone(hex);

  const PREF_KEY = 'cn-geo:prefs:v1';
  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        theme: state.theme, layers: state.layers, layersTouched: state.layersTouched, themePinned: state.themePinned,
        iso: state.iso, bubble: state.bubble
      }));
    } catch (e) { /* 隐私模式忽略 */ }
  }
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }

  function applyTheme(name, persist = true) {
    const key = CANVAS[name] ? name : 'night';
    state.theme = key;
    TH = CANVAS[key];
    document.documentElement.dataset.theme = key;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_THEME[key]);
    $$('#themer button').forEach((b) => {
      const on = b.dataset.theme === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderLegend();
    requestDraw();
    if (persist) { state.themePinned = true; savePrefs(); }
    syncURL();
  }

  // 深链接：?theme=paper&tab=climate&p=四川省&river=长江&mountain=秦岭
  function syncURL() {
    if (!window.history || !history.replaceState) return;
    const q = new URLSearchParams();
    q.set('theme', state.theme);
    if (state.tab && state.tab !== 'explore') q.set('tab', state.tab);
    if (state.selected) q.set('p', state.selected);
    if (state.selectedRiver) q.set('river', state.selectedRiver);
    if (state.selectedMountain) q.set('mountain', state.selectedMountain);
    if (state.iso) q.set('iso', state.iso);
    if (state.bubble) q.set('bubble', state.bubble);
    if (state.railYear != null && (C.railHistory || []).length && state.railYear !== C.railHistory.length - 1) {
      q.set('ry', String((C.railHistory[state.railYear] || {}).year || ''));
    }
    if (CMP_PAIR) {
      const ab = CMP_PAIR.split('|');
      q.set('cmp', ab[0]); q.set('vs', ab[1] || '');
    } else if (state.compare) q.set('cmp', state.compare);
    const url = location.pathname + '?' + q.toString() + location.hash;
    try { history.replaceState(null, '', url); } catch (e) { /* file:// 下可能被拒 */ }
  }

  function readURL(search) {
    let q;
    try { q = new URLSearchParams(search == null ? location.search : search); } catch (e) { return; }
    const theme = q.get('theme');
    if (theme && CANVAS[theme]) { applyTheme(theme, false); state.themePinned = true; }
    const tab = q.get('tab');
    if (tab && TAB_PRESET[tab]) setTab(tab);
    const p = q.get('p');
    if (p && PROV_BY_NAME[p]) selectProvince(p);
    // 只有链接里没写 tab 时，才让叠加层把视图带过去，避免 iso/bubble 互相抢
    const explicitTab = q.get('tab');
    const iso = q.get('iso');
    if (iso === 'jan' || iso === 'jul' || iso === 'ppt') { state.iso = iso; if (!explicitTab && state.tab !== 'climate') setTab('climate'); }
    const bubble = q.get('bubble');
    if (bubble === 'pop' || bubble === 'area') { state.bubble = bubble; if (!explicitTab && state.tab !== 'explore') setTab('explore'); }
    const ry = q.get('ry');
    if (ry && C.railHistory && C.railHistory.length) {
      const k0 = C.railHistory.findIndex((d) => String(d.year) === ry);
      if (k0 >= 0) state.railYear = k0;
    }
    const cmp = q.get('cmp'), vs = q.get('vs');
    if (cmp && vs && PROV_BY_NAME[cmp] && PROV_BY_NAME[vs]) openCompare(cmp, vs);
    else if (cmp && PROV_BY_NAME[cmp]) { state.compare = cmp; syncCompareHint(); }
    const river = q.get('river');
    if (river) {
      const r = C.rivers.find((x) => x.name === river);
      if (r) {
        setTab('water');
        state.selectedRiver = r.name; state.selected = null; state.selectedMountain = null;
        renderPanel(); requestDraw();
        const mid = r.path[Math.floor(r.path.length / 2)];
        focusCoords(mid[0], mid[1], 2.1, 0);
      }
    }
    const mtn = q.get('mountain');
    if (mtn) {
      const m = C.mountains.find((x) => x.name === mtn);
      if (m) {
        setTab('landform');
        state.selectedMountain = m.name; state.selected = null; state.selectedRiver = null;
        renderPanel(); requestDraw();
        focusCoords(m.coord[0], m.coord[1], 2.4, 0);
      }
    }
    syncURL();
  }
  /* ------------------------------------------------------------
     Albers 等积圆锥投影（标准纬线 25°N / 47°N）
     ------------------------------------------------------------ */
  const ALBERS = (() => {
    const p1 = 25 * RAD, p2 = 47 * RAD, p0 = 35 * RAD, l0 = 105 * RAD;
    const n = (Math.sin(p1) + Math.sin(p2)) / 2;
    const Cc = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
    const rho0 = Math.sqrt(Cc - 2 * n * Math.sin(p0)) / n;
    return {
      fwd(lon, lat) {
        const th = n * (lon * RAD - l0);
        const rho = Math.sqrt(Math.max(Cc - 2 * n * Math.sin(lat * RAD), 1e-7)) / n;
        return [rho * Math.sin(th), -(rho0 - rho * Math.cos(th))];
      },
      inv(x, y) {
        // y = -(rho0 - rho·cos th) → rho·cos th = rho0 + y
        const d = rho0 + y;
        const th = Math.atan2(x, d);
        const rho = Math.hypot(x, d);
        const sinLat = (Cc - (rho * n) ** 2) / (2 * n);
        const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
        return [(th / n + l0) / RAD, lat / RAD];
      }
    };
  })();
  const albers = (lon, lat) => ALBERS.fwd(lon, lat);

  /* ------------------------------------------------------------
     0.5° 海拔网格（ETOPO1 采样，assets/elev.js）
     ------------------------------------------------------------ */
  const ELEV = window.CN_ELEV || null;
  const ELEV_ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
  function elevRaw(i, j) {
    const o = (j * ELEV.nx + i) * 2;
    const v = ELEV_ALPHA.indexOf(ELEV.data[o]) * 64 + ELEV_ALPHA.indexOf(ELEV.data[o + 1]);
    return (v - 50) * ELEV.unit;
  }
  // 双线性插值：粗网格直接取整点会阶跃，插值后读数更接近连续地形
  function elevAt(lon, lat) {
    if (!ELEV || !ELEV.data) return null;
    const fx = (lon - ELEV.lon0) / ELEV.step, fy = (lat - ELEV.lat0) / ELEV.step;
    if (fx < 0 || fy < 0 || fx > ELEV.nx - 1 || fy > ELEV.ny - 1) return null;
    const i = Math.min(ELEV.nx - 2, Math.floor(fx)), j = Math.min(ELEV.ny - 2, Math.floor(fy));
    const tx = fx - i, ty = fy - j;
    const a = elevRaw(i, j), b = elevRaw(i + 1, j), c = elevRaw(i, j + 1), d = elevRaw(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /* ------------------------------------------------------------
     预投影：把 GeoJSON 变成 Path2D（世界坐标 = 投影坐标）
     ------------------------------------------------------------ */
  const shapes = [];
  let wb = { x0: 0, y0: 0, x1: 1, y1: 1 };
  (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of GEO.features) {
      const path = new Path2D();
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const poly of f.polygons) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = albers(ring[i][0], ring[i][1]);
            if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
            if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
            if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          path.closePath();
        }
      }
      shapes.push({
        name: f.name, kind: f.kind, path,
        bbox: [fx0, fy0, fx1, fy1],
        centroid: f.centroid ? albers(f.centroid[0], f.centroid[1]) : [fx0 + (fx1 - fx0) / 2, fy0 + (fy1 - fy0) / 2]
      });
    }
    wb = { x0, y0, x1, y1 };
  })();

  const provinceShapes = shapes.filter((s) => s.kind === 'province');

  // 陆地合成路径：晕渲裁剪用
  const LAND_PATH = new Path2D();
  for (const s of provinceShapes) LAND_PATH.addPath(s.path);

  /* ------------------------------------------------------------
     地形晕渲：0.25° 网格（CN_ELEV）→ 坡度坡向 → 西北光照 → 分档 Path2D
     世界坐标与视图无关，所以顶点投影和分档只算一次，换主题只换颜色
     ------------------------------------------------------------ */
  const HILL = (() => {
    if (!ELEV || !ELEV.data || !ELEV.nx) return null;
    const nx = ELEV.nx, ny = ELEV.ny;
    const z = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = elevRaw(i, j);
    const px = new Float32Array(nx * ny), py = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [wx, wy] = albers(ELEV.lon0 + i * ELEV.step, ELEV.lat0 + j * ELEV.step);
        px[j * nx + i] = wx; py[j * nx + i] = wy;
      }
    }
    return { nx, ny, z, px, py };
  })();

  const HILL_BANDS = 11;
  let hillBandIdx = null, hillTex = null, hillTexTheme = null;

  // 每格按坡度坡向算光照，落到 0..8 档（-1 = 海面，不画）
  function hillBandIndex() {
    if (hillBandIdx || !HILL) return hillBandIdx;
    const { nx, ny, z } = HILL;
    const idx = new Int8Array(nx * ny).fill(-1);
    const dLat = ELEV.step * 110574;
    const dLon = ELEV.step * 111320 * Math.cos(((ELEV.lat0 + (ny * ELEV.step) / 2) * Math.PI) / 180);
    const LX = -0.66, LY = -0.66, LZ = 0.86; // 光从西北上方来（y 轴向南为正）
    const lLen = Math.hypot(LX, LY, LZ);
    const EX = 7; // 垂直夸张
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (z[k] < -20) continue;
        const dzdx = (z[k + 1] - z[k - 1]) / (2 * dLon);
        const dzdy = (z[k + nx] - z[k - nx]) / (2 * dLat);
        const ux = -dzdx * EX, uy = -dzdy * EX, uz = 1;
        const inv = 1 / Math.hypot(ux, uy, uz);
        const dot = ((ux * LX + uy * LY + uz * LZ) * inv) / lLen;
        // 平地（法线朝上）时 dot = LZ/|L| ≈ 0.665，作为中性档；坡面偏离越多，明暗差越大
        const u = (dot - 0.665) / 0.22;
        let b = 5 + Math.round(u * 5);
        idx[k] = b < 0 ? 0 : b > HILL_BANDS - 1 ? HILL_BANDS - 1 : b;
      }
    }
    hillBandIdx = idx;
    return idx;
  }

  // 把分档画进一张「世界坐标」纹理：只做一次（换主题时重建），之后每帧只是一次贴图
  function hillTexture() {
    const idx = hillBandIndex();
    if (!idx) return null;
    if (hillTex && hillTexTheme === state.theme) return hillTex;
    const { nx, ny, px, py } = HILL;
    const worldW = wb.x1 - wb.x0, worldH = wb.y1 - wb.y0;
    const TEX_W = 1800;
    const scale = TEX_W / worldW;
    const cw = Math.round(TEX_W), ch = Math.round(worldH * scale);
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const buckets = [];
    for (let b = 0; b < HILL_BANDS; b++) buckets.push([]);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const b = idx[j * nx + i];
        if (b < 0) continue;
        const k = j * nx + i;
        const x = (px[k] - wb.x0) * scale;
        const y = (py[k] - wb.y0) * scale;
        const w2 = Math.max(1.2, (px[k + 1] - px[k]) * scale) + 0.6;
        const h2 = Math.max(1.2, (py[k + nx] - py[k]) * scale) + 0.6;
        buckets[b].push(x, y, w2, h2);
      }
    }
    const dark = TH.hillDark || [8, 12, 16];
    const light = TH.hillLight || [220, 230, 240];
    const amp = TH.hillAlpha == null ? 0.8 : TH.hillAlpha;
    for (let b = 0; b < HILL_BANDS; b++) {
      const t = b / (HILL_BANDS - 1);
      const wgt = Math.abs(t - 0.5) * 2; // 中间档（平地）不着色
      if (wgt < 0.04) continue;
      const a = (Math.pow(wgt, 0.95) * amp).toFixed(3);
      const col = t < 0.5 ? dark : light;
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      const arr = buckets[b];
      for (let q = 0; q < arr.length; q += 4) g.fillRect(arr[q], arr[q + 1], arr[q + 2], arr[q + 3]);
    }
    hillTex = c;
    hillTexTheme = state.theme;
    return c;
  }

  function drawHillshade() {
    if (!state.layers.hill) return;
    const tex = hillTexture();
    if (!tex) return;
    ctx.save();
    ctx.clip(LAND_PATH);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, wb.x0, wb.y0, wb.x1 - wb.x0, wb.y1 - wb.y0);
    ctx.restore();
  }


  // 实际陆地外框（海南只取本岛，不含三沙群岛），用于铺满画布
  const landBBox = (() => {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of provinceShapes) {
      const bb = s.name === '海南省' ? geoBBox(108.4, 18.0, 111.2, 20.3) : s.bbox;
      b = [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])];
    }
    return b;
  })();
  const nineDash = shapes.find((s) => s.kind === 'line');
  const shapeByName = Object.fromEntries(provinceShapes.map((s) => [s.name, s]));

  function geoBBox(w, s, e, n) {
    const pts = [albers(w, s), albers(w, n), albers(e, s), albers(e, n)];
    return [
      Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
      Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))
    ];
  }

  // 主视图取景：中国大陆 + 海南岛（南海诸岛用附图）
  const frame = geoBBox(73.4, 17.6, 135.3, 53.8);

  /* ------------------------------------------------------------
     Canvas 基础
     ------------------------------------------------------------ */
  const canvas = $('#map');
  let ctx = canvas.getContext('2d');
  const ctxMain = ctx;
  // 静态层离屏缓存：鼠标在省份间移动时只贴图 + 叠高亮，不重画 34 个省和全部标签
  const staticCanvas = document.createElement('canvas');
  const ctxStatic = staticCanvas.getContext('2d');
  let cachedKey = '';
  let edgeCanvas = null;
  const pickCanvas = document.createElement('canvas');
  const pickCtx = pickCanvas.getContext('2d', { willReadFrequently: true });
  const tip = $('#tooltip');
  const wrap = $('#mapwrap');

  let W = 1, H = 1, DPR = 1, baseS = 1, cx = 0, cy = 0;
  let dirty = true, pickDirty = true, raf = 0, anim = null;

  // 前庭敏感用户：把入场与飞行都变成瞬间到位
  const motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = () => !!(motionMQ && motionMQ.matches);
  // 系统「减少动态效果」开关在页面开着时也能生效：停下来之后再恢复，需要重新起绘制循环
  if (motionMQ && motionMQ.addEventListener) {
    motionMQ.addEventListener('change', () => { raf = 0; requestDraw(); });
  }

  function computeBase() {
    const bw = landBBox[2] - landBBox[0], bh = landBBox[3] - landBBox[1];
    baseS = Math.min((W * 0.94) / bw, (H * 0.9) / bh);
    cx = (landBBox[0] + landBBox[2]) / 2;
    cy = (landBBox[1] + landBBox[3]) / 2;
  }

  function ensureEdgeCanvas() {
    const w = Math.max(1, Math.round(W * DPR));
    const h = Math.max(1, Math.round(H * DPR));
    if (!edgeCanvas) edgeCanvas = document.createElement('canvas');
    if (edgeCanvas.width !== w || edgeCanvas.height !== h) {
      edgeCanvas.width = w;
      edgeCanvas.height = h;
    }
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    staticCanvas.width = canvas.width; staticCanvas.height = canvas.height;
    ensureEdgeCanvas();
    pickCanvas.width = canvas.width; pickCanvas.height = canvas.height;
    cachedKey = '';
    computeBase();
    pickDirty = true;
    requestDraw();
    layoutProfile();
  }

  const sx = (x) => (x - cx) * baseS * state.view.k + W / 2 + state.view.tx;
  const sy = (y) => (y - cy) * baseS * state.view.k + H / 2 + state.view.ty;

  function applyWorld(ctx2) {
    ctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx2.translate(W / 2 + state.view.tx, H / 2 + state.view.ty);
    ctx2.scale(baseS * state.view.k, baseS * state.view.k);
    ctx2.translate(-cx, -cy);
  }

  function requestDraw() {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(t) {
    raf = 0;
    if (anim) {
      const p = clamp((t - anim.t0) / anim.ms, 0, 1);
      const e = easeOut(p);
      state.view.k = anim.from.k + (anim.to.k - anim.from.k) * e;
      state.view.tx = anim.from.tx + (anim.to.tx - anim.from.tx) * e;
      state.view.ty = anim.from.ty + (anim.to.ty - anim.from.ty) * e;
      pickDirty = true; dirty = true;
      if (p >= 1) anim = null;
    }
    if (state.reveal < 1) {
      // 按时间推进，而不是按帧数：120Hz 屏幕上原来的写法会快一倍，无 vblank 时还会卡住
      state.reveal = clamp((t - state.revealT0) / 620, 0, 1);
      dirty = true;
    }
    if (motionOn()) dirty = true;
    if (dirty) draw();
    if (dirty || anim || state.reveal < 1 || motionOn()) raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------
     颜色
     ------------------------------------------------------------ */
  const MUNI = new Set(['北京市', '天津市', '上海市', '重庆市']);
  function capWord(p) { return p.capital === '—' ? '驻地' : (MUNI.has(p.name) ? '驻地' : '省会'); }
  function capLabel(p) { return p.capital === '—' ? C.regions[p.region].desc : capWord(p) + ' ' + p.capital; }

  function provColor(p) {
    if (state.tab === 'quiz') return TH.quizFill;
    const a = (x) => Math.min(x * TH.fillBoost, 0.94);
    if (state.fill === 'step') return hexA(tone(STEP[p.step].color), a(0.78));
    if (state.fill === 'climate') return hexA(tone(CLIM[p.climate].color), a(0.72));
    if (state.fill === 'crop') {
      const c = CROP_BY_ID[p.crop];
      return hexA(tone(c ? c.color : '#8a8f93'), a(0.76));
    }
    return hexA(tone(C.regions[p.region].color), a(0.72));
  }
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ------------------------------------------------------------
     主绘制
     ------------------------------------------------------------ */
  function paintScene() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 海面 / 背景
    const g = ctx.createRadialGradient(W * 0.46, H * 0.38, 0, W * 0.46, H * 0.38, Math.max(W, H) * 0.8);
    g.addColorStop(0, TH.sea0);
    g.addColorStop(0.62, TH.sea1);
    g.addColorStop(1, TH.sea2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawGraticule();
    drawSeaLabels();

    applyWorld(ctx);
    ctx.lineJoin = 'round';
    const reveal = easeOut(state.reveal);

    // 省份填充
    for (let i = 0; i < provinceShapes.length; i++) {
      const s = provinceShapes[i];
      const p = PROV_BY_NAME[s.name];
      if (!p) continue;
      const dim = state.dimOthers && state.dimOthers !== p[dimKey()] ? 0.18 : 1;
      const cc = state.highlightClimate && state.highlightClimate !== p.climate ? 0.16
        : (state.highlightCrop && !((CROP_BY_ID[state.highlightCrop] || {}).provinces || []).includes(p.name) ? 0.14 : 1);
      const hd = hiMatch(p) ? 1 : 0.12;
      const isHover = state.hover === s.name;
      ctx.globalAlpha = reveal * Math.min(dim, cc, hd) * (isHover ? 1 : 0.98);
      ctx.fillStyle = provColor(p);
      ctx.fill(s.path, 'evenodd');
    }
    ctx.globalAlpha = reveal;

    drawHillshade();

    // 省界：细线，缩小时不与外边界抢眼
    const kk = baseS * state.view.k;
    // 省界：先垫一道暗色衬边，再压一道亮线。只有亮线时，浅色主题的白线压在浅色填充上几乎看不见。
    const bw = clamp(1.15 / Math.sqrt(state.view.k), 0.7, 1.45) / kk;
    ctx.strokeStyle = TH.coastShadow;
    ctx.lineWidth = bw * 1.5;
    for (const s of provinceShapes) ctx.stroke(s.path);
    ctx.strokeStyle = TH.coastLight;
    ctx.lineWidth = bw;
    for (const s of provinceShapes) ctx.stroke(s.path);

    // 外边界（国界与海岸）：加粗 + 外侧投影，与内部省界拉开层级
    drawOuterEdge();
    applyWorld(ctx);

    drawStepsBoundary();
    drawLines();
    drawRivers();
    drawMountains();
    drawSelection();
    drawIsotherms();
    drawBubbles();
    drawInfra();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawLabels();
    drawIsoLabels();
    drawInset();
    drawVignette();
    drawScale();
  }

  // 场景签名：只有它变化才需要重画静态层（省份悬浮 state.hover 故意不在其中）
  function sceneKey() {
    return [
      W, H, DPR, state.view.k.toFixed(5), state.view.tx.toFixed(2), state.view.ty.toFixed(2),
      state.tab, state.theme, state.fill, JSON.stringify(state.layers),
      state.dimOthers || '', state.highlightClimate || '', state.highlightCrop || '', JSON.stringify(state.hi || ''), state.selected || '',
      state.selectedRiver || '', state.selectedMountain || '',
      state.hoverMountain || '', state.hoverRiver || '',
      state.hoverInfra || '', JSON.stringify(state.selectedInfra || ''),
      state.iso || '', state.bubble || '', state.railYear == null ? 'max' : state.railYear,
      state.forceLabelsUntil > performance.now() ? 1 : 0,
      state.quiz && state.quiz.active ? 1 : 0
    ].join('|');
  }

  function draw() {
    dirty = false;
    // 入场扫光期间每帧都在变，直接全量画，不进缓存
    if (state.reveal < 1) {
      ctx = ctxMain;
      paintScene();
      return;
    }
    const key = sceneKey();
    if (key !== cachedKey) {
      const prev = ctx;
      ctx = ctxStatic;
      try {
        paintScene();
        cachedKey = key;
      } finally {
        ctx = prev;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticCanvas, 0, 0);
    drawHoverGlow();
    drawProfileMarker();
    drawMotion();
  }

  /* ------------------------------------------------------------
     动态层：河流流向、季风箭头（画在缓存好的静态层之上）
     ------------------------------------------------------------ */
  function motionOn() {
    if (reducedMotion()) return false;
    if (state.tab === 'water') return true;
    if (state.tab === 'climate') return !!state.layers.monsoon;
    return false;
  }

  const MONSOON = [
    { pts: [[121.5, 21.0], [118.0, 25.5], [114.5, 30.0], [111.0, 34.0], [107.5, 38.0], [104.0, 41.5]], cold: false },
    { pts: [[96.5, 17.5], [99.5, 22.0], [103.0, 26.5], [106.5, 31.0], [110.0, 35.0]], cold: false },
    { pts: [[92.0, 49.5], [98.0, 45.0], [104.0, 40.5], [110.0, 36.0], [116.0, 31.5], [121.0, 28.0]], cold: true }
  ].map((m) => {
    const p2 = new Path2D();
    m.pts.forEach(([lon, lat], i) => {
      const [x, y] = albers(lon, lat);
      if (i) p2.lineTo(x, y); else p2.moveTo(x, y);
    });
    const a = albers(...m.pts[m.pts.length - 2]);
    const b = albers(...m.pts[m.pts.length - 1]);
    return { p: p2, cold: m.cold, end: b, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  });

  function drawMotion() {
    if (!motionOn()) return;
    const t = performance.now();
    const k = baseS * state.view.k;
    const prev = ctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    applyWorld(ctx);
    ctx.save();
    ctx.lineCap = 'round';
    if (state.tab === 'water') {
      // 河流：一小段亮色沿河道往下游跑
      ctx.strokeStyle = TH.riverActive;
      ctx.lineWidth = 1.05 / k;
      ctx.setLineDash([2.4 / k, 9 / k]);
      ctx.lineDashOffset = -((t / 26) % (10000 / k));
      for (const r of riverPaths) ctx.stroke(r.p);
    } else {
      // 季风：暖色 = 夏季风，冷色 = 冬季风
      for (const m of MONSOON) {
        const s = m.cold ? TH.monsoonCold : TH.monsoonWarm;
        ctx.strokeStyle = s;
        ctx.fillStyle = s;
        ctx.lineWidth = 1.5 / k;
        ctx.setLineDash([9 / k, 7 / k]);
        ctx.lineDashOffset = -((t / 55) % (1600 / k)) * (m.cold ? -1 : 1);
        ctx.stroke(m.p);
        // 箭头
        const size = 5.2 / k;
        const [ex, ey] = m.end;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - size * Math.cos(m.ang - 0.42), ey - size * Math.sin(m.ang - 0.42));
        ctx.lineTo(ex - size * Math.cos(m.ang + 0.42), ey - size * Math.sin(m.ang + 0.42));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    ctx = prev;
  }

  // 悬浮高亮单独画在最上层，避免为了换一个省份把整张地图重绘
  function drawHoverGlow() {
    if (!state.hover || state.tab === 'quiz') return;
    const s = shapeByName[state.hover];
    if (!s) return;
    applyWorld(ctx);
    const k = baseS * state.view.k;
    ctx.save();
    // TH.sel 是 rgba() 字面量，不能走 hexA —— 那样会算出 NaN 颜色、整段静默不画
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = TH.sel;
    ctx.fill(s.path, 'evenodd');
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = TH.sel;
    ctx.lineWidth = 1.2 / k;
    ctx.stroke(s.path);
    ctx.restore();
  }

  function drawOuterEdge() {
    if (!edgeCanvas || state.noEdge) return;
    const ectx = edgeCanvas.getContext('2d');
    ectx.setTransform(1, 0, 0, 1, 0, 0);
    ectx.clearRect(0, 0, edgeCanvas.width, edgeCanvas.height);
    ectx.setTransform(DPR, 0, 0, DPR, 0, 0);
    applyWorld(ectx);
    ectx.lineJoin = 'round';
    ectx.strokeStyle = TH.coastShadow;
    ectx.lineWidth = 6 / (baseS * state.view.k);
    for (const s of provinceShapes) ectx.stroke(s.path);
    // 挖掉陆地内部：只剩外侧那一半描边，形成海岸/国界的投影
    ectx.globalCompositeOperation = 'destination-out';
    for (const s of provinceShapes) ectx.fill(s.path, 'evenodd');
    ectx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = clamp(state.view.k < 0.9 ? 0.9 : 0.75, 0, 1);
    ctx.drawImage(edgeCanvas, 0, 0);
    ctx.restore();
  }

  function linkProfileFromMap(read) {
    if (!read || state.tab !== 'landform' || !pw) return;
    if (Math.abs(read.lat - 30) > 1.8) {
      if (profHover && profHover.mirror) { profHover = null; drawProfile(); }
      return;
    }
    let best = null, bd = Infinity;
    for (const pt of C.profile) {
      const d = Math.abs(pt[0] - read.lon);
      if (d < bd) { bd = d; best = pt; }
    }
    if (!best || bd > 1.2) return;
    if (profHover === best) return;
    profHover = best;
    profHover.mirror = true;
    drawProfile();
    if (state.profileLon != null && state.profileLon === best[0]) return;
    const dl = $('#dockTitle');
    if (dl) dl.innerHTML = `${best[2] ? esc(best[2]) + ' · ' : ''}${best[0].toFixed(1)}°E · 海拔 ${fmt(best[1])} m`;
  }

  function drawProfileMarker() {
    if (state.profileLon == null || state.tab !== 'landform') return;
    const [wx, wy] = albers(state.profileLon, 30);
    const x = sx(wx), y = sy(wy);
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.setLineDash([3, 4]);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = TH.sel;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = TH.sel;
    ctx.fill();
    ctx.font = '10px ' + FONT_SANS;
    ctx.fillStyle = TH.provText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(state.profileLon.toFixed(1) + '°E', Math.min(x + 6, W - 46), 10);
    ctx.restore();
  }

  function dimKey() { return 'region'; }

  function hiMatch(p) {
    const h = state.hi;
    if (!h) return true;
    if (h.kind === 'region') return p.region === h.key;
    if (h.kind === 'step') return String(p.step) === h.key;
    if (h.kind === 'climate') return p.climate === h.key;
    if (h.kind === 'crop') return p.crop === h.key;
    return true;
  }

  function drawGraticule() {
    ctx.save();
    ctx.strokeStyle = TH.grid;
    ctx.lineWidth = 1;
    for (let lon = 70; lon <= 140; lon += 10) {
      ctx.beginPath();
      for (let lat = 15; lat <= 56; lat += 2) {
        const [x, y] = albers(lon, lat);
        const px = sx(x), py = sy(y);
        if (lat === 15) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    for (let lat = 20; lat <= 50; lat += 10) {
      ctx.beginPath();
      for (let lon = 72; lon <= 136; lon += 2) {
        const [x, y] = albers(lon, lat);
        const px = sx(x), py = sy(y);
        if (lon === 72) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // 经纬度刻度
    ctx.fillStyle = TH.gridText;
    ctx.font = '9px ' + FONT_MONO;
    if (state.view.k < 2.4) {
      for (let lat = 20; lat <= 50; lat += 10) {
        const [x, y] = albers(112, lat);
        const px = sx(x), py = sy(y);
        if (px > 40 && px < W - 20 && py > 20 && py < H - 20) {
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(lat + '°N', W - 12, py);
        }
      }
      for (let lon = 80; lon <= 130; lon += 10) {
        const [x, y] = albers(lon, 20.4);
        const px = sx(x), py = sy(y);
        if (px > 40 && px < W - 40 && py > 30 && py < H - 30) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(lon + '°E', px, H - 18);
        }
      }
    }
    ctx.restore();
  }

  const SEA = [['渤海', 119.6, 38.9], ['黄海', 123.6, 34.6], ['东海', 125.2, 28.6]];
  function drawSeaLabels() {
    if (state.view.k > 2.6) return;
    ctx.save();
    ctx.fillStyle = TH.seaText;
    ctx.font = 'italic 12px ' + FONT_DISPLAY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [name, lon, lat] of SEA) {
      const [x, y] = albers(lon, lat);
      const px = sx(x), py = sy(y);
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawStepsBoundary() {
    if (state.tab === 'quiz' || state.tab === 'water') return;
    if (state.tab !== 'landform' && state.fill !== 'step') return;
    ctx.save();
    ctx.strokeStyle = TH.stepLine;
    ctx.lineWidth = 1.2 / (baseS * state.view.k);
    ctx.setLineDash([6 / (baseS * state.view.k), 5 / (baseS * state.view.k)]);
    for (const seg of STEP_LINES) {
      ctx.beginPath();
      seg.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  const STEP_LINES = [
    [[74.5, 36.8], [78, 36.4], [82, 36.2], [86, 36.3], [90, 36.6], [94, 37.2], [97, 38.2], [99, 38.0], [101, 36.2], [101.5, 34.0], [101, 31.5], [100, 29.0], [99, 27.0], [98.5, 25.8]],
    [[121.8, 53.2], [120.8, 50.5], [119.4, 47.5], [117.8, 44.5], [116.0, 41.5], [114.0, 38.5], [112.8, 35.8], [111.2, 33.2], [110.2, 31.2], [110.0, 29.0], [110.4, 27.0], [110.0, 25.8]]
  ];

  function drawLines() {
    if (state.tab === 'quiz') return;
    const showQin = state.layers.lines || state.tab === 'climate' || state.fill === 'climate';
    const showHu = state.layers.lines && state.tab !== 'water';
    const showAgri = state.tab === 'agri';
    ctx.save();
    ctx.lineWidth = 1.4 / (baseS * state.view.k);
    ctx.setLineDash([7 / (baseS * state.view.k), 5 / (baseS * state.view.k)]);
    if (showQin) {
      ctx.strokeStyle = TH.qin;
      ctx.beginPath();
      C.lines.qinling.path.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    if (showAgri && C.agriLine) {
      ctx.strokeStyle = TH.agri || TH.hu;
      ctx.beginPath();
      C.agriLine.path.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    if (showHu) {
      ctx.strokeStyle = TH.hu;
      ctx.beginPath();
      C.lines.hu.path.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  function riverPath(r) {
    const path = new Path2D();
    r.path.forEach(([lon, lat], i) => {
      const [x, y] = albers(lon, lat);
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    });
    return path;
  }
  const riverPaths = C.rivers.map((r) => ({ ...r, p: riverPath(r) }));

  function drawRivers() {
    if (!state.layers.rivers && state.tab !== 'water') return;
    if (state.tab === 'quiz') return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of riverPaths) {
      const active = state.selectedRiver === r.name || state.hoverRiver === r.name;
      const k = baseS * state.view.k;
      ctx.beginPath();
      ctx.strokeStyle = TH.riverCasing;
      ctx.lineWidth = (r.width + 2.4) / k;
      ctx.stroke(r.p);
      ctx.strokeStyle = hexA(r.color, active ? 1 : 0.78);
      ctx.lineWidth = (active ? r.width + 1.2 : r.width) / k;
      ctx.stroke(r.p);
      if (active) {
        ctx.save();
        ctx.strokeStyle = TH.riverActive;
        ctx.lineWidth = 0.9 / k;
        ctx.setLineDash([2 / k, 8 / k]);
        ctx.lineDashOffset = -(performance.now() / 42) % 1000;
        ctx.stroke(r.p);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawMountains() {
    if (!state.layers.mountains && state.tab !== 'landform') return;
    if (state.tab === 'quiz') return;
    const k = state.view.k;
    for (const m of C.mountains) {
      const [x, y] = albers(m.coord[0], m.coord[1]);
      const px = sx(x), py = sy(y);
      if (px < -30 || px > W + 30 || py < -30 || py > H + 30) continue;
      const active = state.hoverMountain === m.name || state.selectedMountain === m.name;
      const size = active ? 6.2 : 4.6;
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.95, size * 0.7);
      ctx.lineTo(-size * 0.95, size * 0.7);
      ctx.closePath();
      ctx.fillStyle = active ? TH.mtnActive : TH.mtn;
      ctx.shadowColor = TH.mtnShadow;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawSelection() {
    if (!state.selected) return;
    const s = shapeByName[state.selected];
    if (!s) return;
    ctx.save();
    const k = baseS * state.view.k;
    ctx.strokeStyle = TH.sel;
    ctx.lineWidth = 2.2 / k;
    ctx.shadowColor = TH.selGlow;
    ctx.shadowBlur = 14 / k;
    ctx.stroke(s.path);
    ctx.restore();
  }

  /* ---------------- 标签 ---------------- */
  const FONT_SANS = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';
  const FONT_DISPLAY = '"Songti SC","Noto Serif SC",serif';
  const FONT_MONO = '"SF Mono",ui-monospace,monospace';
  const LABEL_OFFSET = {
    北京市: [2, -18], 天津市: [26, 8], 上海市: [30, -2], 香港特别行政区: [26, 14],
    澳门特别行政区: [-24, 18], 江苏省: [8, -12], 浙江省: [14, 10], 宁夏回族自治区: [-6, -6],
    海南省: [0, 12], 台湾省: [0, 0], 河北省: [-4, 6], 安徽省: [0, 2]
  };
  let labelRects = [];
  const DEBUG = { labels: [], draws: 0, attempts: 0, rejects: 0, err: null };

  /* ------------------------------------------------------------
     等温线：站点气温 → 海拔订正 → 反距离插值 → 等值线追踪
     ------------------------------------------------------------ */
  let CMP_PAIR = null;   // 'A|B' 形式的对比对，只用于深链接
  const ISO_CACHE = {};
  const FIELD = { lon0: 72, lat0: 16, step: 0.5, nx: 129, ny: 77 };
  let isoLabels = [];

  const isPrecip = (kind) => kind === 'ppt';

  function isoField(month) {
    if (ISO_CACHE[month]) return ISO_CACHE[month];
    const ppt = isPrecip(month);
    // 气温先按海拔还原到海平面（再插值、再减回）；降水不做高程订正（站点稀疏，订正反而放大噪声）
    const st = (ppt ? (C.precipStations || []) : (C.stations || [])).map((s) => {
      if (ppt) return { lon: s.lon, lat: s.lat, t: s.mm };
      const z = elevAt(s.lon, s.lat);
      return { lon: s.lon, lat: s.lat, t: (month === 'jan' ? s.jan : s.jul) + 0.0065 * (z || 0) };
    });
    const { lon0, lat0, step, nx, ny } = FIELD;
    const vals = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const lat = lat0 + j * step;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      for (let i = 0; i < nx; i++) {
        const lon = lon0 + i * step;
        let wsum = 0, vsum = 0;
        for (let n = 0; n < st.length; n++) {
          const s = st[n];
          const dx = (lon - s.lon) * cosLat, dy = lat - s.lat;
          const d2 = dx * dx + dy * dy + 2e-3;
          const w = 1 / (d2 * Math.sqrt(d2));
          wsum += w; vsum += w * s.t;
        }
        if (ppt) { vals[j * nx + i] = vsum / wsum; continue; }
        const z = elevAt(lon, lat);
        vals[j * nx + i] = vsum / wsum - 0.0065 * (z === null ? 0 : z);
      }
    }
    ISO_CACHE[month] = { nx, ny, lon0, lat0, step, vals };
    return ISO_CACHE[month];
  }

  function isoJoin(segs) {
    const key = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);
    const map = new Map();
    segs.forEach((sg, i) => {
      for (const p of sg) {
        const k2 = key(p);
        if (!map.has(k2)) map.set(k2, []);
        map.get(k2).push(i);
      }
    });
    const used = new Uint8Array(segs.length);
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const pts = [segs[i][0], segs[i][1]];
      const extend = (atEnd) => {
        for (let guard = 0; guard < 4000; guard++) {
          const tip = atEnd ? pts[pts.length - 1] : pts[0];
          const cand = map.get(key(tip)) || [];
          let hit = -1, flip = false;
          for (const ci of cand) {
            if (used[ci]) continue;
            hit = ci;
            flip = key(segs[ci][0]) === key(tip);
            break;
          }
          if (hit < 0) return;
          used[hit] = 1;
          const sg = segs[hit];
          const next = flip ? sg[1] : sg[0];
          if (atEnd) pts.push(next); else pts.unshift(next);
        }
      };
      extend(true); extend(false);
      if (pts.length >= 3) lines.push(pts);
    }
    return lines;
  }

  function isoLines(month) {
    const ck = 'lines:' + month;
    if (ISO_CACHE[ck]) return ISO_CACHE[ck];
    const f = isoField(month);
    const levels = isPrecip(month) ? (C.precipLevels || []) : ((C.isoLevels && C.isoLevels[month]) || []);
    const { nx, ny, lon0, lat0, step, vals } = f;
    const at = (i, j) => vals[j * nx + i];
    const byLevel = levels.map(() => []);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
        const lo = Math.min(v0, v1, v2, v3), hi = Math.max(v0, v1, v2, v3);
        const x0 = lon0 + i * step, x1 = x0 + step;
        const y0 = lat0 + j * step, y1 = y0 + step;
        for (let li = 0; li < levels.length; li++) {
          const lv = levels[li];
          if (lv < lo || lv > hi) continue;
          const pts = [];
          const edge = (a, b, ax, ay, bx, by) => {
            if ((a - lv) * (b - lv) <= 0 && a !== b) {
              const t = (lv - a) / (b - a);
              pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
            }
          };
          edge(v0, v1, x0, y0, x1, y0);
          edge(v1, v2, x1, y0, x1, y1);
          edge(v2, v3, x1, y1, x0, y1);
          edge(v3, v0, x0, y1, x0, y0);
          if (pts.length >= 2) {
            byLevel[li].push([pts[0], pts[1]]);
            if (pts.length === 4) byLevel[li].push([pts[2], pts[3]]);
          }
        }
      }
    }
    const out = levels.map((v, li) => ({ v, lines: isoJoin(byLevel[li]) }));
    ISO_CACHE[ck] = out;
    return out;
  }

  // Chaikin 平滑一次：0.5° 网格直接连线会有明显折角
  function smoothLine(pts) {
    if (pts.length < 6) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function drawIsotherms() {
    if (!state.iso) { isoLabels = []; return; }
    const k = baseS * state.view.k;   // 世界单位 → 像素
    const data = isoLines(state.iso);
    isoLabels = [];
    ctx.save();
    ctx.clip(LAND_PATH);            // 站点都在陆地，海上不画，免得画出无依据的线
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const lvl of data) {
      if (!lvl.lines.length) continue;
      const ppt = isPrecip(state.iso);
      // 降水线里 400 mm（半湿润/半干旱分界）与 800 mm（湿润分界）最关键，画粗一点
      const major = ppt ? (lvl.v === 400 || lvl.v === 800) : lvl.v === 0;
      ctx.strokeStyle = ppt ? TH.isoWet : lvl.v === 0 ? TH.isoZero : lvl.v < 0 ? TH.isoCold : TH.isoWarm;
      ctx.lineWidth = (major ? 1.9 : 1.15) / k;
      ctx.globalAlpha = major ? 0.95 : 0.8;
      let best = null;
      for (const raw of lvl.lines) {
        const pts = smoothLine(raw);
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const [wx, wy] = albers(pts[i][0], pts[i][1]);
          if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        if (!best || raw.length > best.length) best = raw;
      }
      if (best && best.length > 14) {
        const cands = [0.5, 0.34, 0.66, 0.22, 0.78].map((f) => {
          const q = best[Math.floor(best.length * f)];
          const [wx, wy] = albers(q[0], q[1]);
          return { x: sx(wx), y: sy(wy) };
        });
        isoLabels.push({ v: lvl.v, zero: major, cands, x: cands[0].x, y: cands[0].y });
      }
    }
    ctx.restore();
  }

  function isoLabelFits(box) {
    const pad = 3;
    for (const r of DEBUG.labels) {
      if (box.x - pad < r.x + r.w + pad && box.x + box.w + pad > r.x - pad
        && box.y - pad < r.y + r.h + pad && box.y + box.h + pad > r.y - pad) return false;
    }
    for (const r of isoLabels) {
      if (!r.placed || !r.box) continue;
      const q = r.box;
      if (box.x < q.x + q.w + pad && box.x + box.w + pad > q.x && box.y < q.y + q.h + pad && box.y + box.h + pad > q.y) return false;
    }
    return true;
  }

  function drawIsoLabels() {
    if (!state.iso || !isoLabels.length) return;
    const ppt = isPrecip(state.iso);
    const fmt = (v) => (ppt ? String(v) + ' mm' : (v < 0 ? '−' + Math.abs(v) : String(v)) + '℃');
    for (const l of isoLabels) {
      const txt = fmt(l.v);
      const w = ppt ? 44 : (l.zero ? 30 : 26), h = 12;
      for (const c of (l.cands || [{ x: l.x, y: l.y }])) {
        const box = { x: c.x - w / 2, y: c.y - h / 2, w, h };
        if (!isoLabelFits(box)) continue;
        drawText(txt, c.x, c.y, {
          font: (l.zero ? '600 11px ' : '10px ') + FONT_SANS,
          color: ppt ? TH.isoWet : l.zero ? TH.isoZero : l.v < 0 ? TH.isoCold : TH.isoWarm,
          align: 'center', base: 'middle', halo: true
        });
        l.placed = true; l.box = box;
        break;
      }
    }
  }

  /* 气泡图：人口 / 面积 */
  function drawBubbles() {
    if (!state.bubble) return;
    const k = baseS * state.view.k;   // 世界单位 → 像素
    const key = state.bubble === 'pop' ? 'pop' : 'area';
    let max = 1;
    for (const p of C.provinces) max = Math.max(max, p[key] || 0);
    const R = Math.min(W, H) * 0.075;
    ctx.save();
    for (const p of C.provinces) {
      const v = p[key] || 0;
      if (!v) continue;
      const r = Math.sqrt(v / max) * R;
      const [wx, wy] = albers(p.capCoord[0], p.capCoord[1]);
      ctx.beginPath();
      ctx.arc(wx, wy, r / k, 0, Math.PI * 2);
      ctx.fillStyle = TH.bubble;
      ctx.globalAlpha = 0.14;
      ctx.fill();
      ctx.globalAlpha = 0.62;
      ctx.strokeStyle = TH.bubble;
      ctx.lineWidth = 1.1 / k;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLabels() {
    labelRects = [];
    DEBUG.labels = [];
    DEBUG.attempts = 0;
    DEBUG.rejects = 0;
    DEBUG.draws++;
    const k = state.view.k;
    const quizHide = state.tab === 'quiz' && performance.now() > state.forceLabelsUntil;
    const showProv = state.layers.labels && !quizHide;
    const showCap = state.layers.capitals;
    const showMtn = state.layers.mountains || state.tab === 'landform';
    const showRiver = state.layers.rivers || state.tab === 'water';

    // 线与阶梯名先画，占住位置，省名再避让
    if (state.tab === 'climate' || state.layers.lines) {
      labelLine(C.lines.qinling, '秦岭—淮河线', TH.qinText, 0.62);
    }
    if (state.layers.lines && state.tab !== 'water') {
      labelLine(C.lines.hu, '胡焕庸线', TH.huText, 0.42);
    }
    if (state.tab === 'landform' || state.fill === 'step') {
      stepLabels();
    }

    // 省会
    if (showCap) {
      ctx.font = '10px ' + FONT_SANS;
      for (const p of C.provinces) {
        if (p.capital === '—') continue;
        const [x, y] = albers(p.capCoord[0], p.capCoord[1]);
        const px = sx(x), py = sy(y);
        if (px < 0 || px > W || py < 0 || py > H) continue;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = TH.capDot;
        ctx.fill();
        ctx.strokeStyle = TH.capDotEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (k >= 1.45 || state.selected === p.name) {
          drawText(p.capital, px + 6, py + 0.5, {
            font: '10px ' + FONT_SANS, color: TH.capText, align: 'left', base: 'middle'
          });
        }
      }
    }

    // 河流名
    if (showRiver) {
      ctx.font = '11px ' + FONT_DISPLAY;
      for (const r of riverPaths) {
        const mid = r.path[Math.floor(r.path.length * 0.5)];
        const [x, y] = albers(mid[0], mid[1]);
        const px = sx(x), py = sy(y);
        if (px < 0 || px > W || py < 0 || py > H) continue;
        const active = state.selectedRiver === r.name;
        if (!active && k < 1.35) continue;
        drawText(r.name, px + 8, py - 6, {
          font: (active ? '600 12px ' : '11px ') + FONT_DISPLAY,
          color: active ? TH.riverTextActive : TH.riverText,
          align: 'left', base: 'middle', halo: true, id: 'river'
        });
      }
    }

    // 山脉名
    if (showMtn) {
      for (const m of C.mountains) {
        const [x, y] = albers(m.coord[0], m.coord[1]);
        const px = sx(x), py = sy(y);
        if (px < 0 || px > W || py < 0 || py > H) continue;
        const active = state.hoverMountain === m.name || state.selectedMountain === m.name;
        if (!active && !m.major && k < 1.7) continue;
        drawText(m.name, px + 7, py + 9, {
          font: (active ? '600 11px ' : '10px ') + FONT_SANS,
          color: active ? TH.mtnTextActive : TH.mtnText,
          align: 'left', base: 'middle', halo: true, id: 'mtn'
        });
      }
    }

    // 省份名
    if (showProv) {
      const list = provinceShapes
        .map((s) => ({ s, p: PROV_BY_NAME[s.name] }))
        .filter((o) => o.p)
        .sort((a, b) => (b.p.area || 0) - (a.p.area || 0));
      for (const { s, p } of list) {
        const px = sx(s.centroid[0]), py = sy(s.centroid[1]);
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        const [ox, oy] = LABEL_OFFSET[s.name] || [0, 0];
        const isSel = state.selected === s.name;
        const small = (p.area || 0) < 0.3;
        if (small && k < 1.7 && !isSel) continue;
        // 分级显示：缩得越小，只保留面积大的省名，避免挤成一片
        const lod = k >= 1.3 ? 0 : (k >= 0.9 ? 1.5 : 8);
        if (!isSel && (p.area || 0) < lod) continue;
        drawText(p.label, px + ox, py + oy, {
          font: (isSel ? '600 ' : '') + (k >= 1.5 ? '13px ' : '12px ') + FONT_SANS,
          color: isSel ? TH.provTextActive : TH.provText,
          align: 'center', base: 'middle', halo: true, id: 'prov',
          leader: ox || oy ? [px, py] : null
        });
      }
    }

    // 主要城市（省会之外）
    if (state.layers.cities) {
      for (const c of (C.cities || [])) {
        const [x, y] = albers(c.coord[0], c.coord[1]);
        const px = sx(x), py = sy(y);
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, Math.PI * 2);
        ctx.fillStyle = TH.cityDot || TH.capDot;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        drawText(c.name, px + 4.5, py + 0.5, {
          font: '9.5px ' + FONT_SANS, color: TH.cityText || TH.capText, align: 'left', base: 'middle', halo: true
        });
      }
    }

    // 交通 / 能源：港口、枢纽、基地（画在省名之后，自动避让）
    drawInfraLabels();
  }


  function labelLine(line, text, color, t) {
    const idx = clamp(Math.floor(line.path.length * t), 1, line.path.length - 1);
    const [lon, lat] = line.path[idx];
    const [x, y] = albers(lon, lat);
    drawText(text, sx(x) + 8, sy(y) + 10, {
      font: '10px ' + FONT_SANS, color, align: 'left', base: 'middle', halo: true, id: 'line'
    });
  }

  function stepLabels() {
    const items = [[1, 88.0, 33.5], [2, 106.0, 38.6], [3, 118.0, 33.0]];
    for (const [id, lon, lat] of items) {
      const [x, y] = albers(lon, lat);
      drawText(STEP[id].name, sx(x), sy(y), {
        font: '10px ' + FONT_SANS,
        color: TH.stepText,
        align: 'center', base: 'middle', halo: true, id: 'step'
      });
    }
  }

  function drawText(text, x, y, o) {
    DEBUG.attempts++;
    if (!Number.isFinite(x) || !Number.isFinite(y)) DEBUG.rejects++;
    ctx.save();
    ctx.font = o.font;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'middle';
    const w = ctx.measureText(text).width;
    const pad = 3;
    let x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
    const rect = { x: x0 - pad, y: y - 8, w: w + pad * 2, h: 16 };
    if (o.id !== 'line' && o.id !== 'step' && o.id !== 'river') {
      // 留 1px 间隙：贴边也当作重叠，标签不会挤在一起
      const M = 1;
      for (const r of labelRects) {
        if (!(rect.x + rect.w + M < r.x || rect.x > r.x + r.w + M || rect.y + rect.h + M < r.y || rect.y > r.y + r.h + M)) {
          DEBUG.rejects++;
          ctx.restore();
          return false;
        }
      }
    }
    labelRects.push(rect);
    if (DEBUG.labels.length < 200) DEBUG.labels.push({ t: text, id: o.id || '', x: +rect.x.toFixed(2), y: +rect.y.toFixed(2), w: +rect.w.toFixed(2), h: +rect.h.toFixed(2) });
    if (o.leader) {
      ctx.strokeStyle = TH.leader;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.leader[0], o.leader[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    if (o.halo) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = TH.halo;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = o.color;
    ctx.fillText(text, x, y);
    ctx.restore();
    return true;
  }

  /* ---------------- 南海诸岛附图 ---------------- */
  const INSET = { w: 132, h: 156, pad: 18 };
  function drawInset() {
    const w = INSET.w, h = INSET.h;
    const x0 = W - INSET.pad - w, y0 = H - INSET.pad - h;
    if (W < 420) return;
    ctx.save();
    ctx.fillStyle = TH.insetBg;
    roundRect(ctx, x0, y0, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = TH.insetEdge;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    roundRect(ctx, x0, y0, w, h, 8);
    ctx.clip();
    // 以 104–124E, 3–24N 拟合
    const bb = geoBBox(104, 3, 124, 24);
    const s = Math.min((w - 12) / (bb[2] - bb[0]), (h - 12) / (bb[3] - bb[1]));
    const ox = x0 + w / 2 - ((bb[0] + bb[2]) / 2) * s;
    const oy = y0 + h / 2 - ((bb[1] + bb[3]) / 2) * s;
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    // 岛屿与海岸
    for (const s2 of provinceShapes) {
      ctx.fillStyle = TH.insetLand;
      ctx.fill(s2.path, 'evenodd');
      ctx.strokeStyle = TH.insetLandEdge;
      ctx.lineWidth = 0.6 / s;
      ctx.stroke(s2.path);
    }
    if (nineDash) {
      ctx.strokeStyle = TH.insetDash;
      ctx.lineWidth = 1.5 / s;
      ctx.setLineDash([5 / s, 4 / s]);
      ctx.stroke(nineDash.path);
      ctx.setLineDash([]);
    }
    ctx.restore();

    ctx.fillStyle = TH.insetText;
    ctx.font = '9px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('南海诸岛', x0 + w / 2, y0 - 4);
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, TH.vignette);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function legendItems() {
    if (state.fill === 'step') return C.steps.map((s) => ({ name: s.name, color: s.color }));
    if (state.fill === 'crop') return CROPS.map((c) => ({ name: c.name, color: c.color }));
    if (state.fill === 'climate') return C.climates.map((c) => ({ name: c.name, color: c.color }));
    return REGION_ORDER.map((r) => ({ name: r, color: C.regions[r].color }));
  }

  function exportPng() {
    const src = canvas;
    if (!src.width) return;
    const OW = 1600, PAD = 64, HEAD = 104, FOOT = 112;
    const mw = OW - PAD * 2;
    const mh = Math.round(mw * (src.height / src.width));
    const OH = HEAD + mh + FOOT;
    const out = document.createElement('canvas');
    out.width = OW;
    out.height = OH;
    const c = out.getContext('2d');
    const night = state.theme === 'night';
    const paper = state.theme === 'paper';
    c.fillStyle = night ? '#0a1017' : (paper ? '#f7f1e6' : '#eef2f6');
    c.fillRect(0, 0, OW, OH);
    const ink = night ? 'rgba(236,225,203,0.92)' : 'rgba(26,34,44,0.9)';
    const sub = night ? 'rgba(236,225,203,0.55)' : 'rgba(26,34,44,0.55)';

    c.textBaseline = 'alphabetic';
    c.fillStyle = ink;
    c.font = '600 34px ' + FONT_DISPLAY;
    c.fillText('中国地理图谱', PAD, 66);
    c.font = '15px ' + FONT_SANS;
    c.fillStyle = sub;
    c.textAlign = 'right';
    c.fillText(`${TAB_NAME[state.tab] || '地图'} · ${new Date().toLocaleDateString('zh-CN')}`, OW - PAD, 62);
    c.textAlign = 'left';

    c.drawImage(src, PAD, HEAD - 8, mw, mh);
    c.strokeStyle = night ? 'rgba(236,225,203,0.16)' : 'rgba(26,34,44,0.14)';
    c.lineWidth = 1;
    c.strokeRect(PAD - 0.5, HEAD - 8.5, mw + 1, mh + 1);

    let x = PAD;
    const ly = HEAD + mh + 34;
    c.font = '13px ' + FONT_SANS;
    for (const it of legendItems()) {
      c.fillStyle = swatch(it.color);
      roundRect(c, x, ly - 10, 12, 12, 3);
      c.fill();
      c.fillStyle = ink;
      c.fillText(it.name, x + 18, ly);
      x += 18 + c.measureText(it.name).width + 20;
      if (x > OW - PAD - 90) break;
    }

    c.font = '12.5px ' + FONT_SANS;
    c.fillStyle = sub;
    c.fillText('数据：阿里云 DataV 行政边界 · 第七次全国人口普查 · ETOPO1 海拔', PAD, ly + 30);
    c.textAlign = 'right';
    c.fillText('szluyu99.github.io/china-geo', OW - PAD, ly + 30);
    c.textAlign = 'left';

    const name = `china-geo-${state.tab}-${new Date().toISOString().slice(0, 10)}.png`;
    out.toBlob((b) => {
      if (!b) return;
      if (window.__DBG) window.__DBG.lastExport = { w: OH && out.width, h: out.height, bytes: b.size };
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const btn = $('#exportPng');
      if (btn) {
        const old = btn.innerHTML;
        btn.innerHTML = '✓';
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      }
    }, 'image/png');
  }

  function drawScale() {
    const [x1] = albers(105, 35);
    const [x2] = albers(106, 35);
    const pxPerDeg = Math.abs(sx(x2) - sx(x1));
    const kmPerPx = (111.32 * Math.cos(35 * RAD)) / pxPerDeg;
    const targets = [100, 200, 500, 1000, 2000];
    let pick = 500, best = Infinity;
    for (const t of targets) {
      const px = t / kmPerPx;
      if (px >= 56 && px <= 130 && Math.abs(px - 88) < best) { best = Math.abs(px - 88); pick = t; }
    }
    const bar = $('#scalebar');
    bar.querySelector('span').style.width = Math.round(pick / kmPerPx) + 'px';
    bar.querySelector('b').textContent = pick + ' km';
  }

  /* ------------------------------------------------------------
     命中测试
     ------------------------------------------------------------ */
  function buildPick() {
    pickCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pickCtx.clearRect(0, 0, W, H);
    pickCtx.translate(W / 2 + state.view.tx, H / 2 + state.view.ty);
    pickCtx.scale(baseS * state.view.k, baseS * state.view.k);
    pickCtx.translate(-cx, -cy);
    for (let i = 0; i < provinceShapes.length; i++) {
      const id = i + 1;
      pickCtx.fillStyle = `rgb(${id & 255},${(id >> 8) & 255},0)`;
      pickCtx.fill(provinceShapes[i].path, 'evenodd');
    }
    pickDirty = false;
  }

  function provinceAt(clientX, clientY) {
    if (pickDirty) buildPick();
    const r = canvas.getBoundingClientRect();
    const px = Math.round((clientX - r.left) * DPR);
    const py = Math.round((clientY - r.top) * DPR);
    if (px < 0 || py < 0 || px >= pickCanvas.width || py >= pickCanvas.height) return null;
    const d = pickCtx.getImageData(px, py, 1, 1).data;
    const id = d[0] + (d[1] << 8);
    if (!id) return null;
    return provinceShapes[id - 1].name;
  }

  // 小省（京津沪港澳）面积太小，给一个 12px 的吸附半径
  const TINY = () => provinceShapes
    .map((s) => ({ s, p: PROV_BY_NAME[s.name] }))
    .filter((o) => o.p && o.p.area < 2)
    .map((o) => ({ name: o.s.name, x: sx(o.s.centroid[0]), y: sy(o.s.centroid[1]) }));

  function tinyAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    let best = null, bd = 12;
    for (const t of TINY()) {
      const d = Math.hypot(t.x - px, t.y - py);
      if (d < bd) { bd = d; best = t.name; }
    }
    return best;
  }

  function cityAt(px, py) {
    if (!state.layers.cities) return null;
    let best = null, bd = 9;
    for (const c of (C.cities || [])) {
      const [x, y] = albers(c.coord[0], c.coord[1]);
      const d = Math.hypot(sx(x) - px, sy(y) - py);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function overlayAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    if (state.layers.mountains || state.tab === 'landform') {
      for (const m of C.mountains) {
        const [x, y] = albers(m.coord[0], m.coord[1]);
        if (Math.hypot(px - sx(x), py - sy(y)) < 11) return { type: 'mountain', item: m };
      }
    }
    if (state.layers.rivers || state.tab === 'water') {
      for (const rv of C.rivers) {
        for (let i = 1; i < rv.path.length; i++) {
          const [ax, ay] = albers(rv.path[i - 1][0], rv.path[i - 1][1]);
          const [bx, by] = albers(rv.path[i][0], rv.path[i][1]);
          if (distToSegment(px, py, sx(ax), sy(ay), sx(bx), sy(by)) < 7) return { type: 'river', item: rv };
        }
      }
    }
    return null;
  }

/* ------------------------------------------------------------
     交通与能源
     两张图都只画「走向」：铁路是城市之间的连线，能源通道是起讫之间的示意路径。
     数据在 content.js，手工整理，不表示里程与运营状态。
     ------------------------------------------------------------ */
  const RAIL_LINES = C.railLines || [];
  const RAIL_HUBS = C.railHubs || [];
  const PORTS = C.ports || [];
  const RAIL_KIND = C.railKind || {};
  const E_BASES = C.energyBases || [];
  const E_TYPE = C.energyType || {};
  const E_ROUTES = C.energyRoutes || [];
  const CH_KIND = C.channelKind || {};

  function infraPix(lon, lat) {
    const [wx, wy] = albers(lon, lat);
    return [sx(wx), sy(wy)];
  }

  /* 图层是否可见：tab 决定「这张图画什么」，layer 决定「画不画」 */
  // 时间轴：当前选中的年份（默认最新一年）
  function railOpenYear() {
    const H = C.railHistory || [];
    if (!H.length) return 9999;
    const i = state.railYear == null ? H.length - 1 : Math.max(0, Math.min(H.length - 1, state.railYear));
    return H[i].year;
  }

  function infraOn(kind) {
    if (state.tab === 'transport') return kind === 'rail' ? !!state.layers.rail
      : kind === 'ports' ? !!state.layers.ports : !!state.layers.hubs;
    if (state.tab === 'energy') return kind === 'bases' ? !!state.layers.bases : !!state.layers.channels;
    return false;
  }

  function infraDim(kind, key) {
    const hi = state.hi;
    if (!hi) return 1;
    if (hi.kind !== kind) return 1;
    return hi.key === key ? 1 : 0.14;
  }

  function drawInfra() {
    if (state.tab === 'transport') {
      if (state.layers.rail) drawRailLines();
      if (state.layers.ports) drawPorts();
      if (state.layers.hubs) drawHubs();
    } else if (state.tab === 'energy') {
      if (state.layers.bases) drawBases();
      if (state.layers.channels) drawChannels();
    }
  }

  function railWidth(l) {
    const hi = state.hoverInfra === 'rail:' + l.name
      || (state.selectedInfra && state.selectedInfra.kind === 'rail' && state.selectedInfra.name === l.name);
    return hi ? 2.9 : (l.kind === 'hsd' ? 2.1 : 1.2);
  }

  function drawRailLines() {
    const k = baseS * state.view.k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const l of RAIL_LINES) {
      const kind = RAIL_KIND[l.kind] || { color: '#999' };
      const w = railWidth(l);
      // 还没通车的线画得很淡：时间轴拖到早年能看出路网在长
      const a = infraDim('railkind', l.kind) * (l.kind === 'hsd' ? 0.96 : 0.72)
        * (l.open && l.open > railOpenYear() ? 0.16 : 1);
      ctx.beginPath();
      l.path.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.globalAlpha = 0.7 * a;
      ctx.strokeStyle = TH.coastShadow;
      ctx.lineWidth = (w + 1.5) / k;
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeStyle = kind.color;
      ctx.lineWidth = w / k;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPorts() {
    const k = baseS * state.view.k;
    const r = 2.6 / k;
    for (const p of PORTS) {
      const [x, y] = albers(p.lon, p.lat);
      const a = infraDim('port', p.name);
      const hi = state.hoverInfra === 'port:' + p.name;
      ctx.globalAlpha = a;
      ctx.fillStyle = TH.coastShadow;
      ctx.fillRect(x - r - 0.8 / k, y - r - 0.8 / k, (r + 0.8 / k) * 2, (r + 0.8 / k) * 2);
      ctx.fillStyle = hi ? '#ffffff' : '#8fc3d4';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawHubs() {
    const k = baseS * state.view.k;
    for (const h of RAIL_HUBS) {
      const [x, y] = albers(h.lon, h.lat);
      const a = infraDim('hub', h.name);
      const hi = state.hoverInfra === 'hub:' + h.name;
      const rr = (hi ? 6.2 : 4.8) / k;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = hexA('#0b1016', 0.55);
      ctx.fill();
      ctx.lineWidth = 1.6 / k;
      ctx.strokeStyle = '#e3ac55';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 1.5 / k, 0, Math.PI * 2);
      ctx.fillStyle = '#f0d8a8';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBases() {
    const k = baseS * state.view.k;
    for (const b of E_BASES) {
      const t = E_TYPE[b.type] || { color: '#999', name: b.type };
      const [x, y] = albers(b.lon, b.lat);
      const hi = state.hoverInfra === 'base:' + b.name
        || (state.selectedInfra && state.selectedInfra.kind === 'base' && state.selectedInfra.name === b.name);
      const rr = (hi ? 6.0 : 4.4) / k;
      ctx.globalAlpha = infraDim('etype', b.type) * (hi ? 1 : 0.92);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.lineWidth = 1.1 / k;
      ctx.strokeStyle = TH.coastShadow;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawChannels() {
    const k = baseS * state.view.k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([6 / k, 5 / k]);
    for (const r of E_ROUTES) {
      const kind = CH_KIND[r.kind] || { color: '#aaa' };
      const a = infraDim('echkind', r.kind) * 0.9;
      ctx.beginPath();
      r.path.forEach(([lon, lat], i) => {
        const [x, y] = albers(lon, lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = kind.color;
      ctx.globalAlpha = 0.2 * a;
      ctx.lineWidth = 5 / k;
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.7 / k;
      ctx.stroke();
      // 末端箭头：把「送电/送气」的方向画出来
      const n = r.path.length;
      const [x1, y1] = albers(r.path[n - 2][0], r.path[n - 2][1]);
      const [x2, y2] = albers(r.path[n - 1][0], r.path[n - 1][1]);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const s = 7 / k;
      ctx.setLineDash([]);
      ctx.globalAlpha = a;
      ctx.fillStyle = kind.color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - s * Math.cos(ang - 0.4), y2 - s * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - s * Math.cos(ang + 0.4), y2 - s * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash([6 / k, 5 / k]);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /* 站点标签：港口 / 枢纽 / 能源基地，跟在省名之后画，自动避让 */
  function drawInfraLabels() {
    const k = baseS * state.view.k;
    if (state.tab === 'transport') {
      if (state.layers.ports) {
        for (const p of PORTS) {
          const [x, y] = infraPix(p.lon, p.lat);
          drawText(p.name, x + 6, y + 3, {
            font: '9.5px ' + FONT_SANS, color: TH.capText, align: 'left', base: 'middle', halo: true, id: 'port'
          });
        }
      }
      if (state.layers.hubs) {
        for (const h of RAIL_HUBS) {
          const [x, y] = infraPix(h.lon, h.lat);
          drawText(h.name, x + 8, y - 7, {
            font: '10.5px ' + FONT_SANS, color: TH.hubText || TH.capText, align: 'left', base: 'middle', halo: true, id: 'hub'
          });
        }
      }
    } else if (state.tab === 'energy') {
      if (state.layers.bases) {
        for (const b of E_BASES) {
          const [x, y] = infraPix(b.lon, b.lat);
          const t = E_TYPE[b.type] || { name: '' };
          drawText(b.name, x + 6, y - 6, {
            font: '9.5px ' + FONT_SANS, color: TH.capText, align: 'left', base: 'middle', halo: true, id: 'base'
          });
          if (k > 0 && state.layers.labels) {
            // 类型只在放大时补一行，避免缩小时糊成一片
            if (state.view.k >= 1.6) drawText(t.name, x + 6, y + 5, {
              font: '8.5px ' + FONT_SANS, color: TH.seaText, align: 'left', base: 'middle', halo: true, id: 'base'
            });
          }
        }
      }
    }
  }

  /* 命中：优先级 基地 > 港口 > 枢纽，半径 11px */
  function infraAt(px, py) {
    if (state.tab === 'energy' && state.layers.bases) {
      let best = null, bd = 1e9;
      for (const b of E_BASES) {
        const [x, y] = infraPix(b.lon, b.lat);
        const d = Math.hypot(x - px, y - py);
        if (d < 11 && d < bd) { bd = d; best = { kind: 'base', item: b }; }
      }
      if (best) return best;
    }
    if (state.tab === 'transport') {
      if (state.layers.ports) {
        let best = null, bd = 1e9;
        for (const p of PORTS) {
          const [x, y] = infraPix(p.lon, p.lat);
          const d = Math.hypot(x - px, y - py);
          if (d < 11 && d < bd) { bd = d; best = { kind: 'port', item: p }; }
        }
        if (best) return best;
      }
      if (state.layers.hubs) {
        let best = null, bd = 1e9;
        for (const h of RAIL_HUBS) {
          const [x, y] = infraPix(h.lon, h.lat);
          const d = Math.hypot(x - px, y - py);
          if (d < 11 && d < bd) { bd = d; best = { kind: 'hub', item: h }; }
        }
        if (best) return best;
      }
      if (state.layers.rail) {
        // 铁路线：取路径上离鼠标最近的采样点
        let best = null, bd = 9;
        for (const l of RAIL_LINES) {
          const k = baseS * state.view.k;
          for (let i = 1; i < l.path.length; i++) {
            const [x1, y1] = infraPix(l.path[i - 1][0], l.path[i - 1][1]);
            const [x2, y2] = infraPix(l.path[i][0], l.path[i][1]);
            const dx = x2 - x1, dy = y2 - y1;
            const len2 = dx * dx + dy * dy;
            let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
            t = Math.max(0, Math.min(1, t));
            const d = Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
            if (d < bd) { bd = d; best = { kind: 'rail', item: l }; }
          }
          void k;
        }
        if (best) return best;
      }
    }
    if (state.tab === 'energy' && state.layers.channels) {
      let best = null, bd = 8;
      for (const r of E_ROUTES) {
        for (let i = 1; i < r.path.length; i++) {
          const [x1, y1] = infraPix(r.path[i - 1][0], r.path[i - 1][1]);
          const [x2, y2] = infraPix(r.path[i][0], r.path[i][1]);
          const dx = x2 - x1, dy = y2 - y1;
          const len2 = dx * dx + dy * dy;
          let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
          if (d < bd) { bd = d; best = { kind: 'channel', item: r }; }
        }
      }
      if (best) return best;
    }
    return null;
  }  /* ------------------------------------------------------------
     视图控制
     ------------------------------------------------------------ */
  function setView(v, animateMs = 0) {
    if (reducedMotion()) animateMs = 0;
    if (animateMs) {
      anim = { t0: performance.now(), ms: animateMs, from: { ...state.view }, to: v };
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      state.view = { ...v };
      pickDirty = true;
      requestDraw();
    }
  }

  function resetView() {
    setView({ k: 1, tx: 0, ty: 0 }, 420);
  }

  function zoomAt(px, py, factor, ms = 220) {
    const v = state.view;
    const k = clamp(v.k * factor, 1, 9);
    const wx = (px - W / 2 - v.tx) / (baseS * v.k) + cx;
    const wy = (py - H / 2 - v.ty) / (baseS * v.k) + cy;
    setView({ k, tx: px - W / 2 - (wx - cx) * baseS * k, ty: py - H / 2 - (wy - cy) * baseS * k }, ms);
  }

  function fitBBox(bbox, pad = 0.72, maxK = 7) {
    const bw = Math.max(1e-6, bbox[2] - bbox[0]);
    const bh = Math.max(1e-6, bbox[3] - bbox[1]);
    const k = clamp(Math.min((W * pad) / (bw * baseS), (H * pad) / (bh * baseS)), 1, maxK);
    return {
      k,
      tx: -((bbox[0] + bbox[2]) / 2 - cx) * baseS * k,
      ty: -((bbox[1] + bbox[3]) / 2 - cy) * baseS * k
    };
  }

  function focusProvince(name, ms = 520) {
    const s = shapeByName[name];
    if (!s) return;
    const bbox = name === '海南省' ? geoBBox(108.4, 18.0, 111.2, 20.3) : s.bbox;
    setView(fitBBox(bbox, 0.62, 6), ms);
  }

  function focusCoords(lon, lat, k = 2.4, ms = 520) {
    const [x, y] = albers(lon, lat);
    setView({ k, tx: -(x - cx) * baseS * k, ty: -(y - cy) * baseS * k }, ms);
  }

  /* ------------------------------------------------------------
     交互
     ------------------------------------------------------------ */
  let pointer = { down: false, moved: false, x: 0, y: 0, sx: 0, sy: 0 };

  // 双指缩放：Pointer Events 只有一个 pointer 时会当成拖拽，这里单独记一份
  const touches = new Map();
  let pinch = null;
  const midOf = () => {
    const [a, b] = [...touches.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinch = midOf();
      pointer.down = false;
      canvas.classList.remove('is-dragging');
      anim = null;
      return;
    }
    if (e.button !== 0) return;
    pointer = { down: true, moved: false, x: e.clientX, y: e.clientY, sx: state.view.tx, sy: state.view.ty };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件或已释放的指针 */ }
    anim = null;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || touches.has(e.pointerId)) {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      else if (touches.size < 2) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch && touches.size >= 2) {
      const now = midOf();
      const r = canvas.getBoundingClientRect();
      if (pinch.d > 0 && now.d > 0) {
        zoomAt(now.x - r.left, now.y - r.top, now.d / pinch.d, 0);
        // 双指整体移动时顺便平移，手感更顺
        state.view.tx += now.x - pinch.x;
        state.view.ty += now.y - pinch.y;
        pickDirty = true;
        requestDraw();
      }
      pinch = now;
      tip.classList.remove('is-on');
      return;
    }
    if (pointer.down) {
      const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        pointer.moved = true;
        canvas.classList.add('is-dragging');
      }
      if (pointer.moved) {
        state.view.tx = pointer.sx + dx;
        state.view.ty = pointer.sy + dy;
        pickDirty = true;
        requestDraw();
        tip.classList.remove('is-on');
        return;
      }
    }
    hoverAt(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    const wasDown = pointer.down;
    pointer.down = false;
    canvas.classList.remove('is-dragging');
    if (!wasDown || pointer.moved) return;
    handleClick(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointercancel', (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    pointer.down = false;
    canvas.classList.remove('is-dragging');
  });

  canvas.addEventListener('pointerleave', () => {
    tip.classList.remove('is-on');
    const ro = $('#readout');
    if (ro) ro.classList.remove('is-on');
    if (state.hover) { state.hover = null; requestDraw(); }
    state.hoverMountain = null;
    state.hoverRiver = null;
    canvas.classList.remove('is-pointing');
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18, 0);
  }, { passive: false });

  const aboutDlg = $('#about');
  if (aboutDlg && aboutDlg.showModal) {
    $('#aboutBtn').onclick = () => aboutDlg.showModal();
    $('#aboutClose').onclick = () => aboutDlg.close();
    aboutDlg.addEventListener('click', (e) => { if (e.target === aboutDlg) aboutDlg.close(); });
    // 「看完整数据口径」：关掉弹窗 → 跳速记页 → 滚到那张卡片并高亮一下
    const jump = $('#aboutJump');
    if (jump) jump.onclick = () => {
      aboutDlg.close();
      setTab('notes');
      requestAnimationFrame(() => {
        const card = $('#kSrc');
        if (!card) return;
        // 卡片可能比一屏还高：直接算 scrollTop 对齐到滚动容器顶部下方 16px，
        // 不用 scrollIntoView（它对「比视口高的元素 + 嵌套滚动容器」会给出负的 top）
        const scroller = card.closest('#knowledge') || document.scrollingElement;
        const go = (smooth) => {
          const cr = card.getBoundingClientRect();
          const nr = scroller.getBoundingClientRect();
          const dy = cr.top - nr.top - 16;
          if (Math.abs(dy) < 2) return;
          scroller.scrollTo({ top: scroller.scrollTop + dy, behavior: smooth ? 'smooth' : 'auto' });
        };
        go(true);
        setTimeout(() => go(true), 320);   // 布局稳定后再校一次，避免字体/图片晚到把位置顶偏
        setTimeout(() => go(false), 780);  // 兜底：强制对齐一次（动画被打断也能到位）
        card.classList.add('is-flash');
        setTimeout(() => card.classList.remove('is-flash'), 1600);
      });
    };
    aboutDlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); aboutDlg.close(); }
    });
  } else if (aboutDlg) {
    $('#aboutBtn').hidden = true;
  }

  $('#zoomIn').onclick = () => zoomAt(W / 2, H / 2, 1.4);
  $('#zoomOut').onclick = () => zoomAt(W / 2, H / 2, 1 / 1.4);
  $('#reset').onclick = () => { resetView(); };

  function hoverAt(clientX, clientY) {
    const ov = overlayAt(clientX, clientY);
    const r = canvas.getBoundingClientRect();
    const ox = clientX - r.left, oy = clientY - r.top;
    const read = readoutAt(ox, oy, r);
    linkProfileFromMap(read);
    if (ov) {
      canvas.classList.add('is-pointing');
      if (ov.type === 'mountain') {
        if (state.hoverMountain !== ov.item.name) {
          state.hoverMountain = ov.item.name; state.hoverRiver = null; state.hover = null;
          requestDraw();
        }
        showTip(ox, oy, ov.item.name, [ov.item.elev, ov.item.trend]);
      } else {
        if (state.hoverRiver !== ov.item.name) {
          state.hoverRiver = ov.item.name; state.hoverMountain = null; state.hover = null;
          requestDraw();
        }
        showTip(ox, oy, ov.item.name, [ov.item.length, ov.item.rank.split(' · ')[0]]);
      }
      return;
    }
    if (state.layers.cities) {
      const c = cityAt(ox, oy);
      if (c) {
        if (state.hoverMountain || state.hoverRiver) { state.hoverMountain = null; state.hoverRiver = null; requestDraw(); }
        canvas.classList.add('is-pointing');
        showTip(ox, oy, c.name, [c.prov, c.note]);
        return;
      }
    }
    // 交通 / 能源：铁路、港口、枢纽、基地、通道
    if (state.tab === 'transport' || state.tab === 'energy') {
      const hit = infraAt(ox, oy);
      if (hit) {
        let sub;
        if (hit.kind === 'rail') {
          const provs = [...new Set(hit.item.path.map((q) => provNameAt(q[0], q[1])).filter(Boolean))];
          sub = [RAIL_KIND[hit.item.kind].name, `经过 ${provs.length} 省区`];
        } else if (hit.kind === 'channel') sub = [CH_KIND[hit.item.kind].name, '跨区通道'];
        else if (hit.kind === 'base') sub = [E_TYPE[hit.item.type].name, infraProvinceOf(hit.item) || '—'];
        else sub = [hit.kind === 'port' ? '沿海港口' : '铁路枢纽', infraProvinceOf(hit.item) || '—'];
        if (state.hoverInfra !== hit.item.name) {
          state.hoverInfra = hit.item.name;
          state.hoverMountain = null; state.hoverRiver = null; state.hover = null;
          requestDraw();
        }
        canvas.classList.add('is-pointing');
        showTip(ox, oy, hit.item.name, sub);
        return;
      }
      if (state.hoverInfra) { state.hoverInfra = null; requestDraw(); }
    }
    const name = provinceAt(clientX, clientY);
    if (state.hoverMountain || state.hoverRiver) {
      state.hoverMountain = null; state.hoverRiver = null; requestDraw();
    }
    if (name !== state.hover) {
      state.hover = name;
      requestDraw();
    }
    canvas.classList.toggle('is-pointing', !!name || state.tab === 'quiz');
    if (!name) { tip.classList.remove('is-on'); return; }
    const p = PROV_BY_NAME[name];
    if (!p) return;
    const extra = state.bubble === 'pop' ? `人口 ${p.pop.toLocaleString('zh-CN')} 万`
      : state.bubble === 'area' ? `面积 ${p.area} 万 km²` : null;
    showTip(ox, oy, p.name, [p.short, capLabel(p), `面积第 ${RANK.area[p.name]} · 人口第 ${RANK.pop[p.name]}`, extra].filter(Boolean));
  }

  function showTip(x, y, name, subs) {
    tip.innerHTML = `<div class="t-name">${esc(name)}</div><div class="t-sub">${subs.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('is-on');
    if (state.tab === 'quiz') tip.classList.remove('is-on');
  }

  /* 鼠标位置读数：经纬度 + 海拔 */
  function readoutAt(px, py, r) {
    const el = $('#readout');
    if (!el) return;
    const v = state.view;
    const wx = (px - W / 2 - v.tx) / (baseS * v.k) + cx;
    const wy = (py - H / 2 - v.ty) / (baseS * v.k) + cy;
    const [lon, lat] = ALBERS.inv(wx, wy);
    const dec = v.k > 2.2 ? 2 : 1;
    const e = elevAt(lon, lat);
    let alt = '';
    if (e == null) {
      alt = '';
    } else if (e < -20 && !provinceAt(r.left + px, r.top + py)) {
      alt = '海域';
    } else {
      const step = Math.abs(e) >= 1000 ? 50 : 10;
      const m = Math.round(e / step) * step;
      alt = m === 0 ? '海拔 < 10 m' : `海拔 ${m < 0 ? '−' + Math.abs(m) : '≈ ' + m} m`;
    }
    el.innerHTML = `<span data-ro="ll">${lon.toFixed(dec)}°E · ${lat.toFixed(dec)}°N</span>${alt ? `<span data-ro="alt">${alt}</span>` : ''}`;
    el.classList.add('is-on');
    return { lon, lat };
  }

  function handleClick(clientX, clientY) {
    // 交通 / 能源：先认铁路、港口、枢纽、基地、通道
    if (state.tab === 'transport' || state.tab === 'energy') {
      const rc0 = canvas.getBoundingClientRect();
      const hit = infraAt(clientX - rc0.left, clientY - rc0.top);
      if (hit) {
        const name = hit.item.name;
        state.selectedInfra = state.selectedInfra && state.selectedInfra.name === name ? null : { kind: hit.kind, name };
        state.selected = null; state.selectedRiver = null; state.selectedMountain = null;
        renderPanel(); requestDraw(); syncURL();
        return;
      }
    }
    const ov = overlayAt(clientX, clientY);
    if (ov && state.tab !== 'quiz') {
      if (ov.type === 'mountain') {
        state.selectedMountain = ov.item.name;
        state.selectedRiver = null;
        state.selected = null;
        renderPanel();
        requestDraw();
        syncURL();
        return;
      }
      if (ov.type === 'river') {
        if (state.tab === 'water' || state.layers.rivers) {
          state.selectedRiver = ov.item.name;
          state.selectedMountain = null;
          state.selected = null;
          renderPanel();
          requestDraw();
          syncURL();
          return;
        }
      }
    }
    const name = tinyAt(clientX, clientY) || provinceAt(clientX, clientY);
    if (!name) {
      if (state.compare) { state.compare = null; syncCompareHint(); requestDraw(); return; }
      if (state.selected || state.selectedRiver || state.selectedMountain || state.selectedInfra) {
        state.selected = null; state.selectedRiver = null; state.selectedMountain = null; state.selectedInfra = null;
        renderPanel(); requestDraw(); syncURL();
      }
      return;
    }
    if (state.tab === 'quiz' && state.quiz && state.quiz.active) {
      answerByProvince(name);
      return;
    }
    // 对比模式：第二个省直接开对比表
    if (state.compare && state.compare !== name && !state.quiz) {
      const a = state.compare;
      state.compare = null;
      syncCompareHint();
      state.selected = name;
      renderPanel(); requestDraw(); syncURL();
      openCompare(a, name);
      return;
    }
    selectProvince(name);
  }

  function selectProvince(name, focus = false) {
    state.selected = name;
    state.selectedRiver = null;
    state.selectedMountain = null;
    $('#emptyHint').classList.add('is-off');
    renderPanel();
    requestDraw();
    syncURL();
    if (focus) focusProvince(name);
    if (!focus && window.innerWidth <= 900) {
      const el = document.querySelector('#panel');
      if (el && el.getBoundingClientRect().top > window.innerHeight - 80) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /* ------------------------------------------------------------
     Panel 渲染
     ------------------------------------------------------------ */
  const panel = $('#panelBody');
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function provinceRanks(p) {
    const dens = (x) => x.pop / x.area;
    const peers = C.provinces.filter((x) => x.region === p.region);
    return {
      area: 1 + C.provinces.filter((x) => x.area > p.area).length,
      pop: 1 + C.provinces.filter((x) => x.pop > p.pop).length,
      density: Math.round(dens(p)),
      densityRank: 1 + C.provinces.filter((x) => dens(x) > dens(p)).length,
      areaRegion: 1 + peers.filter((x) => x.area > p.area).length,
      popRegion: 1 + peers.filter((x) => x.pop > p.pop).length,
      regionSize: peers.length
    };
  }

  // 省轮廓：取面积最大的一圈环，投影后按 96×68 归一化，供面板里的小图使用
  function outlineSvg(p) {
    // 注意：provinceShapes 里的 shape 只有 path/bbox/centroid，没有 polygons；
    // 原始多边形在 GEO.features 里，按名字取。
    const feat = GEO.features.find((f) => f.name === p.name && f.kind !== 'line');
    if (!feat || !feat.polygons) return '';
    let best = null, bestLen = -1;
    for (const poly of feat.polygons) {
      for (const ring of poly) {
        if (ring.length > bestLen) { bestLen = ring.length; best = ring; }
      }
    }
    if (!best) return '';
    const pts = best.map(([lon, lat]) => {
      const [wx, wy] = albers(lon, lat);
      return [wx, -wy]; // SVG 的 y 向下
    });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const W = 96, H = 68, pad = 3;
    const s2 = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
    const ox = (W - (x1 - x0) * s2) / 2, oy = (H - (y1 - y0) * s2) / 2;
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + (x - x0) * s2).toFixed(1)} ${(oy + (y - y0) * s2).toFixed(1)}`).join(' ') + ' Z';
    return `<svg class="prov-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  /* ---------------- 省际对比 ---------------- */
  function syncCompareHint() {
    const el = $('#cmpHint');
    if (!el) return;
    if (state.compare) {
      el.innerHTML = `对比模式：已选 <b>${esc(state.compare)}</b>，再点一个省 <button class="cmp-cancel" data-cmp-cancel>取消</button>`;
      el.classList.add('is-on');
      const b = el.querySelector('[data-cmp-cancel]');
      if (b) b.onclick = () => { state.compare = null; syncCompareHint(); };
    } else {
      el.classList.remove('is-on');
      el.innerHTML = '';
    }
  }

  function startCompare(name) {
    state.compare = name;
    syncCompareHint();
    showTip(window.innerWidth / 2, 96, '对比模式', [state.compare + ' → 再点一个省']);
  }


  /* 省界内的河流 / 山脉：按几何归属统计。
     河流看控制点落在哪个省界内，山脉看点位落在哪个省界内；只有示意精度——
     河道只有几十个控制点，一条河跨省再多几个弯就可能漏，所以文案里说明是「流经」。 */
  let GEO_GROUPS = null;
  const FEAT_BOX = new Map();
  for (const f of GEO.features) {
    if (f.kind === 'line') continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of f.polygons) for (const ring of poly) for (const p of ring) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    FEAT_BOX.set(f.name, [x0, y0, x1, y1]);
  }
  function provNameAt(lon, lat) {
    for (const f of GEO.features) {
      if (f.kind === 'line') continue;
      const b = FEAT_BOX.get(f.name);
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      for (const poly of f.polygons) {
        const ring = poly[0]; // 只测外环，飞地/群岛不参与
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
          if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) return f.name;
      }
    }
    return null;
  }
  function geoGroups() {
    if (GEO_GROUPS) return GEO_GROUPS;
    const rivers = new Map(), mts = new Map();
    for (const r of C.rivers) {
      for (const p of r.path) {
        const n = provNameAt(p[0], p[1]);
        if (!n) continue;
        if (!rivers.has(n)) rivers.set(n, []);
        if (!rivers.get(n).includes(r.name)) rivers.get(n).push(r.name);
      }
    }
    for (const m of C.mountains) {
      if (!m.coord) continue;
      const n = provNameAt(m.coord[0], m.coord[1]);
      if (!n) continue;
      if (!mts.has(n)) mts.set(n, []);
      if (!mts.get(n).includes(m.name)) mts.get(n).push(m.name);
    }
    GEO_GROUPS = { rivers, mts };
    return GEO_GROUPS;
  }
  const provRivers = (name) => (geoGroups().rivers.get(name) || []).join('、') || '—';
  const provMountains = (name) => (geoGroups().mts.get(name) || []).join('、') || '—';

  function openCompare(a, b) {
    const pa = PROV_BY_NAME[a], pb = PROV_BY_NAME[b];
    const dlg = $('#cmp');
    const box = $('#cmpBox');
    if (!dlg || !box || !pa || !pb) return;
    const ra = provinceRanks(pa), rb = provinceRanks(pb);
    const rows = [];
    const row = (label, va, vb, na, nb, barA, barB, fmt) => {
      const mx = Math.max(barA || 0, barB || 0) || 1;
      const cell = (v, n, w, cls) => `<span class="cmp-n">${n}</span><span class="cmp-v">${v}</span>` +
        `<span class="cmp-bar"><span class="cmp-fill ${cls}" style="width:${clamp(w / mx * 100, 1.5, 100)}%"></span></span>`;
      rows.push(`<div class="cmp-row"><div class="cmp-cell">${cell(va, na, barA, 'a')}</div>` +
        `<div class="cmp-lab">${label}</div>` +
        `<div class="cmp-cell is-b">${cell(vb, nb, barB, 'b')}</div></div>`);
    };
    row('面积', pa.area + ' 万 km²', pb.area + ' 万 km²', '全国第 ' + ra.area, '全国第 ' + rb.area, pa.area, pb.area);
    row('常住人口', fmt(pa.pop) + ' 万', fmt(pb.pop) + ' 万', '全国第 ' + ra.pop, '全国第 ' + rb.pop, pa.pop, pb.pop);
    row('人口密度', fmt(ra.density) + ' 人/km²', fmt(rb.density) + ' 人/km²', '全国第 ' + ra.densityRank, '全国第 ' + rb.densityRank, ra.density, rb.density);
    row('面积占国土', (pa.area / 960 * 100).toFixed(2) + '%', (pb.area / 960 * 100).toFixed(2) + '%', '', '', pa.area, pb.area);
    row('人口占全国', (pa.pop / 141178 * 100).toFixed(1) + '%', (pb.pop / 141178 * 100).toFixed(1) + '%', '', '', pa.pop, pb.pop);
    // 水系与山脉：没有可比的数值，就并列展示（差值不是重点）
    const textRow = (label, va, vb) => rows.push(
      `<div class="cmp-row is-text"><div class="cmp-cell"><span class="cmp-n cmp-long">${esc(va)}</span></div>` +
      `<div class="cmp-lab">${label}</div>` +
      `<div class="cmp-cell is-b"><span class="cmp-n cmp-long">${esc(vb)}</span></div></div>`);
    const rvA = provRivers(pa.name), rvB = provRivers(pb.name);
    const mtA = provMountains(pa.name), mtB = provMountains(pb.name);
    // 十年人口变化（2010 六普 → 2020 七普）：有增减也要能一眼看出方向
    const deltaTxt = (pp) => {
      const base = pp.pop2010;
      if (!base) return '—';
      const d = pp.pop - base, pct = (pp.pop / base - 1) * 100;
      const sign = d > 0 ? '+' : (d < 0 ? '−' : '');
      return `${sign}${fmt(Math.abs(d))} 万（${sign}${Math.abs(pct).toFixed(1)}%）`;
    };
    if (pa.pop2010 && pb.pop2010) textRow('人口变化 10 年', deltaTxt(pa), deltaTxt(pb));
    if (rvA !== '—' || rvB !== '—') textRow('主要河流', rvA, rvB);
    if (mtA !== '—' || mtB !== '—') textRow('主要山脉', mtA, mtB);
    const ca = CLIM[pa.climate], cb = CLIM[pb.climate];
    const sa = STEP[pa.step], sb = STEP[pb.step];
    // 倍数必须带方向：谁大就说谁是几倍，不能只报一个比值
    const times = (big, small, bigName, smallName, unit) =>
      `${bigName}的${unit}是${smallName}的 <b>${(big / small).toFixed(2)} 倍</b>`;
    const areaTxt = pa.area >= pb.area
      ? times(pa.area, pb.area, pa.name, pb.name, '面积')
      : times(pb.area, pa.area, pb.name, pa.name, '面积');
    const popTxt = pa.pop >= pb.pop
      ? times(pa.pop, pb.pop, pa.name, pb.name, '人口')
      : times(pb.pop, pa.pop, pb.name, pa.name, '人口');
    box.innerHTML = `
      <div class="cmp-head">
        <div class="cmp-side"><div class="cmp-mark">${esc(pa.short)}</div><div class="cmp-name">${esc(pa.name)}</div>${outlineSvg(pa)}</div>
        <div class="cmp-vs">对比</div>
        <div class="cmp-side is-b"><div class="cmp-mark">${esc(pb.short)}</div><div class="cmp-name">${esc(pb.name)}</div>${outlineSvg(pb)}</div>
      </div>
      <div class="cmp-rows">${rows.join('')}</div>
      <div class="cmp-foot">
        <div class="cmp-line"><span>${esc(pa.name)}</span><b>${sa.name.replace('阶梯','')}</b><span>·</span><span>${esc(ca.name)}</span><span>·</span><span>${esc(pa.crop || '—')}</span></div>
        <div class="cmp-line"><span>${esc(pb.name)}</span><b>${sb.name.replace('阶梯','')}</b><span>·</span><span>${esc(cb.name)}</span><span>·</span><span>${esc(pb.crop || '—')}</span></div>
        <div class="cmp-note">${areaTxt}；${popTxt}。<br/><span class="cmp-caveat">河流按图谱收录的 ${C.rivers.length} 条、山脉按 ${C.mountains.length} 座归属；未收录的支流不列。</span></div>
      </div>
      <button class="cmp-close" data-cmp-close>关闭</button>`;
    CMP_PAIR = a + '|' + b;
    const close = box.querySelector('[data-cmp-close]');
    if (close) close.onclick = () => { CMP_PAIR = null; dlg.close(); syncURL(); };
    if (dlg.showModal) dlg.showModal();
    syncURL();
    // 点遮罩关闭
    dlg.onclick = (e) => { if (e.target === dlg) { CMP_PAIR = null; dlg.close(); syncURL(); } };
  }

  function renderPanel() {
    if (state.tab === 'quiz') return renderQuiz();
    if (state.selected) return renderProvince(state.selected);
    if (state.selectedRiver) return renderRiver(state.selectedRiver);
    if (state.selectedMountain) return renderMountain(state.selectedMountain);
    if (state.tab === 'landform') return renderLandform();
    if (state.tab === 'climate') return renderClimate();
    if (state.tab === 'water') return renderWater();
    if (state.tab === 'agri') return renderAgri();
    if (state.tab === 'transport') return renderTransport();
    if (state.tab === 'energy') return renderEnergy();
    return renderExplore();
  }

  function renderExplore() {
    const counts = REGION_ORDER.map((r) => [r, C.provinces.filter((p) => p.region === r).length]);
    panel.innerHTML = `
      <div class="eyebrow">从这里开始</div>
      <h2>读懂这片土地</h2>
      <p class="lead">从西到东，中国的地势像三级台阶一路降到海面。台阶决定了河流往哪流，河流又决定了城市与人口长在哪里。</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">陆地面积</span><span class="v">960<small>万 km²</small></span></div>
        <div class="stat"><span class="k">省级行政区</span><span class="v">34<small>个</small></span></div>
        <div class="stat"><span class="k">陆上邻国</span><span class="v">14<small>个</small></span></div>
        <div class="stat"><span class="k">大陆海岸线</span><span class="v">1.8<small>万 km</small></span></div>
      </div>
      <div class="rule"></div>
      <h3>七大地理分区</h3>
      <div class="list" id="regionList">
        ${counts.map(([r, n]) => `
          <button class="list-item" data-region="${r}">
            <span class="li-top"><span class="li-dot" style="background:${swatch(C.regions[r].color)}"></span>
              <span class="li-name">${r}</span><span class="li-tag">${n} 个省级</span></span>
            <span class="li-desc">${C.regions[r].desc}</span>
          </button>`).join('')}
      </div>
      <div class="chips" role="group" aria-label="气泡图">
        <span class="chip-label">气泡图</span>
        <button class="chip ${!state.bubble ? 'is-on' : ''}" data-bubble="">关</button>
        <button class="chip ${state.bubble === 'pop' ? 'is-on' : ''}" data-bubble="pop">人口</button>
        <button class="chip ${state.bubble === 'area' ? 'is-on' : ''}" data-bubble="area">面积</button>
      </div>
      <div class="note-box"><b>试试看：</b>点击地图上的省份，或者用左侧搜索框输入「拉萨」「桂」「成都」，看看会发生什么。</div>
      <div class="chips">
        <span class="chip is-accent">点击省份</span>
        <span class="chip">切换着色</span>
        <span class="chip">拖拽缩放</span>
      </div>`;
    panel.querySelectorAll('[data-bubble]').forEach((b) => {
      b.onclick = () => {
        state.bubble = b.dataset.bubble || null;
        savePrefs(); renderPanel(); requestDraw(); syncURL();
      };
    });
    panel.querySelectorAll('[data-region]').forEach((b) => {
      b.onclick = () => {
        const r = b.dataset.region;
        state.dimOthers = state.dimOthers === r ? null : r;
        renderPanel(); requestDraw();
        const bs = C.provinces.filter((p) => p.region === r).map((p) => shapeByName[p.name].bbox);
        setView(fitBBox([Math.min(...bs.map((b2) => b2[0])), Math.min(...bs.map((b2) => b2[1])), Math.max(...bs.map((b2) => b2[2])), Math.max(...bs.map((b2) => b2[3]))], 0.8, 3), 480);
      };
    });
  }

  // 2010 六普 → 2020 七普 的十年人口变化。POP2010 只覆盖 31 个省级行政区（不含港澳台），
  // 所以 pop2010 缺失时返回「—」，不画对比条。
  function popChange(p) {
    const base = p.pop2010;
    if (!base) return { label: '—', note: '缺 2010 数据', cls: 'is-flat', w: 0 };
    const d = p.pop - base, pct = (p.pop / base - 1) * 100;
    const cls = d > 0 ? 'is-up' : (d < 0 ? 'is-down' : 'is-flat');
    const w = Math.min(50, Math.abs(pct) / 25 * 50);
    const sign = d > 0 ? '+' : (d < 0 ? '−' : '');
    return {
      label: `${sign}${fmt(Math.abs(d))} 万 · ${sign}${Math.abs(pct).toFixed(1)}%`,
      note: `2010 年 ${fmt(base)} 万 → 2020 年 ${fmt(p.pop)} 万`,
      cls, w: d === 0 ? 0 : Math.max(2, w)
    };
  }

  function renderProvince(name) {
    const p = PROV_BY_NAME[name];
    if (!p) return renderExplore();
    const rk = provinceRanks(p);
    const region = C.regions[p.region];
    const clim = CLIM[p.climate];
    const step = STEP[p.step];
    const maxArea = 166.49, maxPop = 12601;
    panel.innerHTML = `
      <div class="eyebrow">省级行政区 · ${p.region}</div>
      <div class="province-hero">
        <div class="mark">${esc(p.short)}</div>
        <div class="meta">
          <span class="latin">${p.coord[0].toFixed(1)}°E · ${p.coord[1].toFixed(1)}°N</span>
          <span class="cap">${p.capital === '—' ? '特别行政区' : capWord(p) + ' <b>' + esc(p.capital) + '</b>'}</span>
        </div>
      </div>
      <h2>${esc(p.name)}</h2>
      <div class="prov-shape">${outlineSvg(p)}<span class="sh-cap">正北朝上 · 等比例</span></div>
      <p class="lead">${esc(p.terrain)}</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">面积</span><span class="v">${p.area}<small>万 km²</small></span><span class="r">全国第 ${rk.area} 位</span></div>
        <div class="stat"><span class="k">常住人口</span><span class="v">${fmt(p.pop)}<small>万</small></span><span class="r">全国第 ${rk.pop} 位</span></div>
        <div class="stat"><span class="k">人口密度</span><span class="v">${fmt(rk.density)}<small>人/km²</small></span></div>
        <div class="stat"><span class="k">地势阶梯</span><span class="v" style="font-size:15px">${step.name.replace('阶梯', '')}阶梯</span><span class="r">${step.elev}</span></div>
      </div>
      <div class="bars">
        <div class="bar-row"><span class="lab"><span>面积</span><b>全国第 ${rk.area} · 本区第 ${rk.areaRegion}/${rk.regionSize}</b></span>
          <span class="bar-track"><span class="bar-fill" style="width:${clamp(p.area / maxArea * 100, 1, 100)}%"></span></span>
          <span class="bar-note">${(p.area / 960 * 100).toFixed(2)}% 国土</span></div>
        <div class="bar-row"><span class="lab"><span>人口</span><b>全国第 ${rk.pop} · 本区第 ${rk.popRegion}/${rk.regionSize}</b></span>
          <span class="bar-track"><span class="bar-fill" style="width:${clamp(p.pop / maxPop * 100, 1, 100)}%"></span></span>
          <span class="bar-note">${(p.pop / 141178 * 100).toFixed(1)}% 全国</span></div>
        <div class="bar-row"><span class="lab"><span>人口密度</span><b>全国第 ${rk.densityRank}</b></span>
          <span class="bar-track"><span class="bar-fill" style="width:${clamp(rk.density / 4000 * 100, 1, 100)}%"></span></span>
          <span class="bar-note">${fmt(rk.density)} 人/km²</span></div>
        <div class="bar-row is-delta"><span class="lab"><span>十年人口</span><b>${popChange(p).label}</b></span>
          <span class="bar-track is-zero"><span class="bar-fill ${popChange(p).cls}" style="width:${popChange(p).w}%"></span></span>
          <span class="bar-note">${popChange(p).note}</span></div>
      </div>
      <div class="chips">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
        <span class="chip is-accent">${esc(region.desc)}</span></div>
      <div class="rule"></div>
      <h3>气候与地势</h3>
      <div class="note-box"><b>${clim.name}</b> · ${clim.key}<br/>${clim.plant} · ${clim.farm}</div>
      <div class="btn-row">
        <button class="btn ghost" id="focusProv">在地图上放大这一省</button>
        <button class="btn ghost" id="cmpProv">与另一省对比</button>
      </div>`;
    $('#focusProv').onclick = () => focusProvince(p.name);
    $('#cmpProv').onclick = () => startCompare(p.name);
  }

  function renderLandform() {
    panel.innerHTML = `
      <div class="eyebrow">地势 · 三级阶梯</div>
      <h2>西高东低，三级台阶</h2>
      <p class="lead">第一级阶梯是平均 4000 米以上的青藏高原；第二级降到 1000–2000 米的高原与盆地；第三级是 500 米以下的平原与丘陵，一直延伸到海。</p>
      <div class="list">
        ${C.steps.map((s) => `
          <div class="list-item">
            <span class="li-top"><span class="li-dot" style="background:${swatch(s.color)}"></span>
              <span class="li-name">${s.name}</span><span class="li-tag">${s.elev}</span></span>
            <span class="li-desc">${s.area} · ${s.note}</span>
          </div>`).join('')}
      </div>
      <div class="note-box"><b>为什么重要：</b>西高东低让绝大多数河流自西向东流，阶梯交界处落差大、水能集中；也让夏季海洋水汽可以深入内陆，形成季风气候。</div>
      <div class="rule"></div>
      <h3>主要地形区</h3>
      <div class="list" id="lfList">
        ${C.landforms.map((l) => `
          <button class="list-item" data-lf="${esc(l.name)}">
            <span class="li-top"><span class="li-name">${l.name}</span><span class="li-tag">${l.kind}</span></span>
            <span class="li-desc">${l.stat}</span>
          </button>`).join('')}
      </div>`;
    panel.querySelectorAll('[data-lf]').forEach((b) => {
      b.onclick = () => {
        const l = C.landforms.find((x) => x.name === b.dataset.lf);
        state.focusLandform = l.name;
        focusCoords(l.coord[0], l.coord[1], 3.1);
        panel.querySelectorAll('[data-lf]').forEach((x) => x.classList.toggle('is-on', x === b));
        showTipInline(l);
      };
    });
  }

  function showTipInline(l) {
    let box = panel.querySelector('.lf-detail');
    if (!box) {
      box = document.createElement('div');
      box.className = 'note-box lf-detail';
      panel.appendChild(box);
    }
    box.innerHTML = `<b>${esc(l.name)}</b> · ${esc(l.stat)}<br/>${esc(l.fact)}`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }


  /* 等温线 / 等降水量线的读图说明：跟着当前选中的层变 */
  function isoNoteText() {
    if (state.iso === 'ppt') {
      return '<b>年降水量线：</b><b>800 mm</b> 对应水田与旱地，大致就是秦岭—淮河；<b>400 mm</b> 是半湿润与半干旱、也是种植业与畜牧业的分界；<b>200 mm</b> 以内属干旱区；<b>1600 mm</b> 只出现在华南沿海。线越密，说明降水随位置变化越快。';
    }
    if (state.iso === 'jan') {
      return '<b>1 月等温线：</b>0℃ 线大致沿秦岭—淮河，线以南冬季均温在 0℃ 以上；<b>−20℃</b> 线只在黑龙江北部与内蒙古东北角；<b>8℃</b> 线只出现在南岭以南的华南沿海。';
    }
    if (state.iso === 'jul') {
      return '<b>7 月等温线：</b>全国普遍高温，<b>18℃</b> 线大致沿青藏高原东南缘；<b>28℃</b> 线覆盖华南、江南与四川盆地；<b>10℃</b> 线只出现在青藏高原腹地，是夏季最凉的地方。';
    }
    return '<b>等值线怎么读：</b>点上面的「1 月 / 7 月 / 年降水」切换。每两层之间的差是固定的（气温 4℃、降水 200 mm），所以线画得越密，说明这个方向上变化越快。';
  }

  function renderClimate() {
    panel.innerHTML = `
      <div class="eyebrow">气候</div>
      <h2>季风里的中国</h2>
      <p class="lead">海陆热力差异让东亚成为世界上季风最典型的地区。夏季风从海洋带来水汽，冬季风从内陆带来干冷，降水因此从东南向西北递减。</p>
      <div class="list" id="climList">
        ${C.climates.map((c) => `
          <button class="list-item ${state.highlightClimate === c.id ? 'is-on' : ''}" data-clim="${c.id}">
            <span class="li-top"><span class="li-dot" style="background:${swatch(c.color)}"></span>
              <span class="li-name">${c.name}</span><span class="li-tag">${c.key}</span></span>
            <span class="li-desc">${c.where}</span>
          </button>`).join('')}
      </div>
      <div class="note-box"><b>秦岭—淮河线：</b>1 月 0℃ 等温线、800 mm 年等降水量线大致从这里穿过。线以北是暖温带、旱地小麦；线以南是亚热带、水田稻作。</div>
      <div class="note-box"><b>干湿地带：</b>从东南沿海向西北，年降水量由 1600 mm 降到 50 mm 以下，植被依次是森林 → 草原 → 荒漠。</div>
      <div class="note-box"><b>等温线：</b>由 36 个站点气温插值、再按海拔订正得到，能看出青藏高原的闭合低温区与吐鲁番盆地的高温区。</div>
      <div class="note-box iso-note" id="isoNote">${isoNoteText()}</div>
      <div class="chips" role="group" aria-label="等温线">
        <span class="chip-label">等温线</span>
        <button class="chip ${!state.iso ? 'is-on' : ''}" data-iso="">关</button>
        <button class="chip ${state.iso === 'jan' ? 'is-on' : ''}" data-iso="jan">1 月</button>
        <button class="chip ${state.iso === 'jul' ? 'is-on' : ''}" data-iso="jul">7 月</button>
        <button class="chip ${state.iso === 'ppt' ? 'is-on' : ''}" data-iso="ppt">年降水</button>
      </div>
      <div class="note-box"><b>读图提示：</b>地图按「主导气候类型」给省份着色，实际省界内常有过渡，例如陕西南北就横跨两个气候带。</div>`;
    panel.querySelectorAll('[data-iso]').forEach((b) => {
      b.onclick = () => {
        state.iso = b.dataset.iso || null;
        savePrefs(); renderPanel(); requestDraw(); syncURL();
      };
    });
    panel.querySelectorAll('[data-clim]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.clim;
        state.highlightClimate = state.highlightClimate === id ? null : id;
        renderPanel(); requestDraw();
      };
    });
  }

  function renderAgri() {
    const hl = state.highlightCrop;
    const rows = CROPS.map((c) => {
      const n = c.provinces.length;
      return `<button class="list-item ${hl === c.id ? 'is-on' : ''}" data-crop="${c.id}">
        <span class="li-top"><span class="li-dot" style="background:${swatch(c.color)}"></span>
          <span class="li-name">${c.name}</span><span class="li-tag">${c.key}</span></span>
        <span class="li-desc">${c.note}</span>
      </button>`;
    }).join('');
    const active = hl ? CROP_BY_ID[hl] : null;
    panel.innerHTML = `
      <div class="eyebrow">农业</div>
      <h2>种什么，看水土</h2>
      <p class="lead">400 mm 年等降水量线把国土分成两半：以东以南种庄稼，以西以北放牛羊。热量再细分熟制——东北一年一熟，华北两年三熟，长江以南一年两熟到三熟，海南可以一年三熟。</p>
      <div class="list" id="cropList">${rows}</div>
      ${active ? `<div class="note-box"><b>${active.name}的主要产区：</b>${active.provinces.join('、')}。</div>` : ''}
      <div class="note-box"><b>400 mm 线：</b>${C.agriLine.note}</div>
      <div class="note-box"><b>读图提示：</b>地图按「主导作物」给省份着色，实际一省常同时种好几样——比如江苏既产稻米也产小麦，新疆既有棉花也有小麦。</div>`;
    panel.querySelectorAll('[data-crop]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.crop;
        state.highlightCrop = state.highlightCrop === id ? null : id;
        renderPanel(); requestDraw();
      };
    });
  }

  function renderWater() {
    panel.innerHTML = `
      <div class="eyebrow">水系</div>
      <h2>大江东去</h2>
      <p class="lead">受西高东低的地势控制，中国绝大多数河流自西向东注入太平洋。外流区约占国土三分之二，内流区集中在西北干旱区。</p>
      <div class="list" id="riverList">
        ${C.rivers.map((r) => `
          <button class="list-item ${state.selectedRiver === r.name ? 'is-on' : ''}" data-river="${esc(r.name)}">
            <span class="li-top"><span class="li-dot" style="background:${r.color}"></span>
              <span class="li-name">${r.name}</span><span class="li-tag">${r.length}</span></span>
            <span class="li-desc">${r.rank}</span>
          </button>`).join('')}
      </div>
      <div class="note-box"><b>外流区与内流区：</b>分界线大致沿大兴安岭—阴山—贺兰山—祁连山—冈底斯山，与 400 mm 年等降水量线接近。内流河多靠冰雪融水补给，夏季水量最大。</div>
      <div class="rule"></div>
      ${state.selectedRiver ? riverDetailHTML(C.rivers.find((r) => r.name === state.selectedRiver)) : `
        <h3>选一条河</h3><p>点击上方列表或地图上的河流，看它的源头、入海口与沿途省区。</p>`}`;
    panel.querySelectorAll('[data-river]').forEach((b) => {
      b.onclick = () => {
        state.selectedRiver = state.selectedRiver === b.dataset.river ? null : b.dataset.river;
        state.selected = null;
        renderPanel(); requestDraw();
        if (state.selectedRiver) {
          const r = C.rivers.find((x) => x.name === state.selectedRiver);
          const mid = r.path[Math.floor(r.path.length / 2)];
          focusCoords(mid[0], mid[1], 1.35, 520);
        }
      };
    });
  }


  /* 河流纵剖面：从源头到入海口的距离—海拔曲线。
     用海拔网格读数，只为建立「上游落差大、中下游平缓」的直觉，
     所以只给一位有效数字级的精度，不做水量、流域面积这类没数据的推断。 */
  function riverProfile(r) {
    const pts = r.path;
    if (!pts || pts.length < 3) return { svg: '', km: 0, drop: 0, grad: 0 };
    const rad = Math.PI / 180;
    const hav = (a, b) => {
      const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    };
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
    // 路径只有几十个控制点，逐段直线距离会明显偏短（长江会算成 ~3900 km）。
    // 所以几何用累计距离，展示用的全长优先取数据里写好的真实长度。
    const km = cum[cum.length - 1] || 1;
    const realKm = (() => {
      const m = /(\d[\d,.]*)/.exec(r.length || '');
      const v = m ? parseFloat(m[1].replace(/,/g, '')) : 0;
      return v > km * 1.05 ? v : km;   // 只有明显更长才认为它是真实长度
    })();
    const elev = pts.map((p) => Math.max(0, elevAt(p[0], p[1])));
    const hi = Math.max(...elev), lo = Math.min(...elev);
    const W = 300, H = 92, L = 8, R = 8, T = 10, B = 16;
    const x = (d) => L + (km ? d / km : 0) * (W - L - R);
    const y = (e) => T + (1 - (hi === lo ? 0.5 : (e - lo) / (hi - lo))) * (H - T - B);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(cum[i]).toFixed(1)},${y(elev[i]).toFixed(1)}`).join(' ');
    const area = `${line} L${x(km).toFixed(1)},${(H - B).toFixed(1)} L${L},${(H - B).toFixed(1)} Z`;
    const dots = [];
    for (let i = 0; i < pts.length - 1; i += Math.max(1, Math.floor(pts.length / 9))) {
      dots.push(`<circle cx="${x(cum[i]).toFixed(1)}" cy="${y(elev[i]).toFixed(1)}" r="1.6"><title>距源头约 ${Math.round(cum[i])} km · 海拔约 ${Math.round(elev[i])} m</title></circle>`);
    }
    const src = `<text x="${L}" y="${(H - 3).toFixed(0)}" class="rp-t">源头</text>`;
    const mid = `<text x="${(W / 2).toFixed(0)}" y="${(H - 3).toFixed(0)}" class="rp-t" text-anchor="middle">${Math.round(realKm / 2)} km</text>`;
    const mout = `<text x="${W - R}" y="${(H - 3).toFixed(0)}" class="rp-t" text-anchor="end">入海口</text>`;
    const drop = Math.round(hi), grad = realKm ? (drop / realKm) : 0;
    const svg = `<svg class="rp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
      aria-label="${esc(r.name)}纵剖面：全长约 ${Math.round(realKm)} 公里，落差约 ${drop} 米">
      <path d="${area}" class="rp-area"></path>
      <path d="${line}" class="rp-line"></path>
      ${dots.join('')}
      <circle cx="${L}" cy="${y(elev[0]).toFixed(1)}" r="2.4" class="rp-end"></circle>
      <circle cx="${x(km).toFixed(1)}" cy="${y(elev[elev.length - 1]).toFixed(1)}" r="2.4" class="rp-end"></circle>
      ${src}${mid}${mout}
      <text x="${W - R}" y="${(T - 2).toFixed(0)}" class="rp-t" text-anchor="end">海拔 ${hi} m</text>
    </svg>
    <p class="rp-note">纵剖面由 0.25° 高程网格采样：全长约 <b>${Math.round(realKm)} km</b>，源头至入海落差约 <b>${drop} m</b>，平均坡降约 <b>${grad.toFixed(2)}‰</b>。坡度数字越小，说明河道越平缓——这也是航运与水电落差的直观来源。</p>`;
    return { svg, km, drop, grad };
  }

  function riverDetailHTML(r) {
    if (!r) return '';
    return `
      <h3>${r.name} <span style="font-family:var(--font-mono);font-size:9px;color:var(--dim);letter-spacing:.14em">${r.en.toUpperCase()}</span></h3>
      <div class="stat-grid">
        <div class="stat"><span class="k">长度</span><span class="v" style="font-size:15px">${r.length}</span></div>
        <div class="stat"><span class="k">地位</span><span class="v" style="font-size:12px;line-height:1.5">${r.rank}</span></div>
      </div>
      <p><b style="color:var(--ink-soft)">源头</b>　${r.source}<br/><b style="color:var(--ink-soft)">注入</b>　${r.mouth}<br/><b style="color:var(--ink-soft)">流经</b>　${r.through}</p>
      ${riverProfile(r).svg}
      <div class="note-box">${r.note}</div>`;
  }

  function renderRiver(name) {
    const r = C.rivers.find((x) => x.name === name);
    if (!r) return renderWater();
    panel.innerHTML = `
      <div class="eyebrow">河流 · ${r.rank}</div>
      <h2>${r.name}</h2>
      ${riverDetailHTML(r)}
      <button class="btn ghost" id="backWater">← 返回水系列表</button>`;
    $('#backWater').onclick = () => { state.selectedRiver = null; renderPanel(); };
  }

  function renderMountain(name) {
    const m = C.mountains.find((x) => x.name === name);
    panel.innerHTML = `
      <div class="eyebrow">山脉</div>
      <h2>${esc(m.name)}</h2>
      <div class="stat-grid">
        <div class="stat"><span class="k">海拔</span><span class="v" style="font-size:15px">${m.elev}</span></div>
        <div class="stat"><span class="k">走向</span><span class="v" style="font-size:15px">${m.trend}</span></div>
      </div>
      <div class="note-box">${esc(m.note)}</div>
      <button class="btn ghost" id="backTab">← 返回</button>`;
    $('#backTab').onclick = () => { state.selectedMountain = null; renderPanel(); requestDraw(); };
  }

  /* ------------------------------------------------------------
     闯关
     ------------------------------------------------------------ */
  const quizModes = [
    ['mix', '混合闯关'], ['province', '地图找省份'],
    ['capital', '省会配对'], ['fact', '地理常识']
  ];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  /* 错题本：答错的题记到本地，可以只考这些 */
  const WRONG_KEY = 'cn-geo:wrong:v1';
  const MAX_WRONG = 60;
  function wrongAll() {
    try {
      const raw = localStorage.getItem(WRONG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => x && x.k) : [];
    } catch (e) { return []; }
  }
  function wrongSave(list) {
    try { localStorage.setItem(WRONG_KEY, JSON.stringify(list.slice(0, MAX_WRONG))); } catch (e) {}
  }
  function wrongAdd(q) {
    if (!q || !q.key) return;
    const list = wrongAll();
    const i = list.findIndex((x) => x.k === q.key);
    const rec = {
      k: q.key, type: q.type, prompt: q.prompt, answer: q.answer || '',
      options: q.options ? [...q.options] : null, why: q.why || '',
      meta: q.meta || '', name: q.name || '',
      misses: i >= 0 ? (list[i].misses || 1) + 1 : 1, ts: Date.now()
    };
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    wrongSave(list);
  }
  function wrongClear(key) {
    const list = wrongAll();
    const i = list.findIndex((x) => x.k === key);
    if (i < 0) return false;
    list.splice(i, 1);
    wrongSave(list);
    return true;
  }
  function wrongCount() { return wrongAll().length; }
  function wrongQuestions() {
    return wrongAll().map((r) => (r.type === 'click'
      ? { type: 'click', key: r.k, name: r.name, label: (PROV_BY_NAME[r.name] || {}).label || '', prompt: `在地图上找到：${r.name}` }
      : { type: 'choice', key: r.k, prompt: r.prompt, answer: r.answer, options: shuffle(r.options && r.options.length ? r.options : [r.answer]), meta: r.meta || '错题', why: r.why || '', name: r.name }));
  }

  function buildQuiz(mode) {
    const qs = [];
    const provs = shuffle(C.provinces.filter((p) => p.pop > 0));
    const clickQs = provs.slice(0, 10).map((p) => ({ type: 'click', key: 'click:' + p.name, name: p.name, label: p.label, prompt: `在地图上找到：${p.name}` }));
    const capQs = shuffle(C.provinces.filter((p) => p.capital !== '—')).slice(0, 10).map((p) => {
      const others = shuffle(C.provinces.filter((x) => x.capital !== '—' && x.capital !== p.capital)).slice(0, 3);
      const options = shuffle([p.capital, ...others.map((o) => o.capital)]);
      return { type: 'choice', key: 'cap:' + p.name, prompt: `${p.name} 的${MUNI.has(p.name) ? '驻地' : '省会'}是？`, answer: p.capital, options, meta: '省会配对', name: p.name };
    });
    const factQs = shuffle(C.facts).slice(0, 10).map((f) => {
      const options = shuffle([f.a, ...f.options]);
      return { type: 'choice', key: 'fact:' + f.q, prompt: f.q, answer: f.a, options, meta: f.tag, why: f.why || '' };
    });
    if (mode === 'wrong') return wrongQuestions();
    if (mode === 'province') return clickQs;
    if (mode === 'capital') return capQs;
    if (mode === 'fact') return factQs;
    return shuffle([...shuffle(clickQs).slice(0, 4), ...shuffle(capQs).slice(0, 3), ...factQs.slice(0, 3)]);
  }

  function startQuiz(mode) {
    if (mode === 'wrong' && !wrongCount()) return;
    state.quiz = {
      mode, qs: buildQuiz(mode).slice(0, 10), i: 0, score: 0,
      answers: [], answered: false, picked: null, startAt: Date.now(), active: true
    };
    state.quizMarks = {};
    state.selected = null;
    state.layers.labels = false;
    state.fill = 'region';
    syncControls();
    renderQuiz();
    requestDraw();
  }

  function currentQ() {
    const q = state.quiz;
    return q && q.qs[q.i];
  }

  function renderQuiz() {
    const q = state.quiz;
    const wn = wrongCount();
    if (!q) {
      panel.innerHTML = `
        <div class="eyebrow">闯关 · 检验一下</div>
        <h2>十道题，走一遍中国</h2>
        <p class="lead">四种玩法：在地图上找省份、给省份配省会、答地理常识，或者混合来一轮。满分 10 分。</p>
        <div class="quiz-mode" id="modePick">
          ${quizModes.map(([m, label]) => `<button data-mode="${m}">${label}</button>`).join('')}
        </div>
        <div class="note-box">找省份时地图会隐藏名称。答错会立刻标出正确位置，答错的题会自动进「错题本」，答对一次就划掉。</div>
        ${wn ? `<div class="quiz-mode" id="wrongPick">
          <button data-mode="wrong">只考错题 · ${wn}</button>
          <button id="clearWrong" class="flat">清空</button>
        </div>` : ''}
        <div class="stat-grid">
          <div class="stat"><span class="k">题型</span><span class="v" style="font-size:14px">点击 / 选择</span></div>
          <div class="stat"><span class="k">题量</span><span class="v">10<small>题</small></span></div>
          <div class="stat"><span class="k">错题本</span><span class="v">${wn}<small>题</small></span></div>
        </div>`;
      panel.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => startQuiz(b.dataset.mode); });
      const cw = $('#clearWrong');
      if (cw) cw.onclick = () => { wrongSave([]); renderQuiz(); };
      return;
    }

    if (!q.active) return renderQuizResult();
    const cur = currentQ();
    const dots = q.qs.map((_, i) => {
      const a = q.answers[i];
      const cls = a ? (a.ok ? 'ok' : 'bad') : (i === q.i ? 'now' : '');
      return `<i class="${cls}"></i>`;
    }).join('');

    if (!cur) return renderQuizResult();

    panel.innerHTML = `
      <div class="quiz">
        <div class="quiz-top">
          <div class="eyebrow" style="margin:0">第 ${q.i + 1} / ${q.qs.length} 题 · 得分 ${q.score}</div>
          <div class="quiz-dots">${dots}</div>
        </div>
        <div class="quiz-q"><small>${cur.type === 'click' ? '点击地图作答' : '选择一个答案'}</small>${esc(cur.prompt)}</div>
        ${cur.type === 'choice' ? `
          <div class="quiz-opts">
            ${cur.options.map((o, i) => {
              const cls = q.answered ? (o === cur.answer ? 'ok' : (o === q.picked ? 'bad' : '')) : '';
              return `<button data-opt="${esc(o)}" class="${cls}" ${q.answered ? 'disabled' : ''}><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</button>`;
            }).join('')}
          </div>` : `
          <div class="note-box" style="border-left-color:rgba(95,182,217,.6)">在右侧地图上点击你认为正确的省份。${q.answered ? '' : '看不清？可以点下面的提示。'}</div>
          ${!q.answered ? '<button class="btn ghost" id="hintBtn">显示省份名称 3 秒</button>' : ''}`}
        <div class="feedback ${q.answered ? (q.lastOk ? 'ok' : 'bad') : ''}">${q.feedback || ''}</div>
        ${q.answered ? '<button class="btn" id="nextBtn">下一题 →</button>' : '<button class="btn ghost" id="skipBtn">跳过这题</button>'}
        <div class="rule"></div>
        <p style="font-size:10.5px">计时 ${elapsedText(q)} · 答错不扣分，但会记入错题回顾。</p>
      </div>`;

    panel.querySelectorAll('[data-opt]').forEach((b) => {
      b.onclick = () => answerByOption(b.dataset.opt, b);
    });
    const nb = $('#nextBtn'); if (nb) nb.onclick = nextQuestion;
    const sb = $('#skipBtn'); if (sb) sb.onclick = () => answerByProvince(null, true);
    const hb = $('#hintBtn'); if (hb) hb.onclick = () => {
      state.forceLabelsUntil = performance.now() + 3000;
      state.layers.labels = true;
      requestDraw();
      setTimeout(() => { if (state.tab === 'quiz') { state.layers.labels = false; requestDraw(); } }, 3000);
    };
  }

  function elapsedText(q) {
    const s = Math.max(0, Math.round(((q.endAt || Date.now()) - q.startAt) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function answerByOption(opt, btn) {
    const q = state.quiz;
    if (!q || q.answered) return;
    const cur = currentQ();
    const ok = opt === cur.answer;
    q.answered = true;
    q.lastOk = ok;
    q.picked = opt;
    if (ok) q.score++;
    if (ok) wrongClear(cur.key); else wrongAdd(cur);
    q.answers[q.i] = { ok, q: cur, picked: opt };
    q.feedback = (ok ? '答对了。' : `正确答案是「${cur.answer}」。`) + (cur.why ? ' ' + cur.why : '');
    if (btn) {
      btn.classList.add(ok ? 'ok' : 'bad');
      panel.querySelectorAll('[data-opt]').forEach((b) => {
        b.disabled = true;
        if (b.dataset.opt === cur.answer) b.classList.add('ok');
      });
    }
    state.quizMarks = {};
    renderQuiz();
    requestDraw();
  }

  function answerByProvince(name, skip = false) {
    const q = state.quiz;
    if (!q || q.answered) return;
    const cur = currentQ();
    if (cur.type !== 'click') return;
    const ok = name === cur.name;
    q.answered = true;
    q.lastOk = ok;
    q.picked = skip ? '__skip' : name;
    if (ok) q.score++;
    if (ok) wrongClear(cur.key); else wrongAdd(cur);
    q.answers[q.i] = { ok, q: cur, picked: name };
    q.feedback = ok ? '找对了。' : skip ? `正确答案是「${cur.name}」，已在地图上标出。` : `这里是「${PROV_BY_NAME[name] ? PROV_BY_NAME[name].name : name}」，正确答案是「${cur.name}」。`;
    state.quizMarks = { correct: cur.name, wrong: ok || skip ? null : name };
    q.timer = setTimeout(() => { if (state.quiz === q && q.answered) nextQuestion(); }, 1800);
    renderQuiz();
    requestDraw();
  }

  function nextQuestion() {
    const q = state.quiz;
    if (!q) return;
    if (q.timer) { clearTimeout(q.timer); q.timer = null; }
    if (q.i >= q.qs.length - 1) {
      q.active = false;
      q.endAt = Date.now();
      state.quizMarks = {};
      renderQuizResult();
      requestDraw();
      return;
    }
    q.i++;
    q.answered = false;
    q.picked = null;
    q.feedback = '';
    state.quizMarks = {};
    renderQuiz();
    requestDraw();
  }

  function renderQuizResult() {
    const q = state.quiz;
    const total = q.qs.length;
    const right = q.answers.filter(Boolean).filter((a) => a.ok).length;
    const pct = Math.round((right / total) * 100);
    const grade = pct >= 90 ? '地理达人' : pct >= 70 ? '底子不错' : pct >= 50 ? '还差一点' : '继续加油';
    const wrong = q.answers.filter(Boolean).filter((a) => !a.ok);
    panel.innerHTML = `
      <div class="eyebrow">闯关结果</div>
      <h2>${grade}</h2>
      <div class="score-big">${right}<small> / ${total}</small></div>
      <p>正确率 ${pct}% · 用时 ${elapsedText(q)}</p>
      <div class="bars">
        <div class="bar-row"><span class="lab"><span>正确率</span><b>${pct}%</b></span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,rgba(95,191,163,.5),var(--jade))"></span></span></div>
      </div>
      ${wrong.length ? `<div class="rule"></div><h3>错题回顾</h3><div class="review">
        ${wrong.map((a) => `<div class="r-item"><b>${esc(a.q.type === 'click' ? a.q.name : a.q.prompt)}</b><br/>
          ${a.q.type === 'click' ? '在地图上找它的位置' : '正确答案：' + esc(a.q.answer)}
          ${a.q.why ? `<small class="why">${esc(a.q.why)}</small>` : ''}</div>`).join('')}
      </div>` : '<div class="note-box">全对。可以试试「地图找省份」模式，把名称藏起来再来一轮。</div>'}
      ${wrongCount() ? `<div class="note-box">错题本已攒下 <b>${wrongCount()}</b> 题，答对一次就会划掉。</div>` : ''}
      <div class="quiz-mode" style="margin-top:6px">
        <button id="again">再玩一次</button>
        ${wrongCount() ? '<button id="reviewWrong">复习错题</button>' : ''}
        <button id="switchMode">换个模式</button>
      </div>`;
    $('#again').onclick = () => startQuiz(q.mode);
    const rw = $('#reviewWrong'); if (rw) rw.onclick = () => startQuiz('wrong');
    $('#switchMode').onclick = () => { state.quiz = null; renderQuiz(); };
  }

/* ------------------------------------------------------------
     交通 / 能源 右侧面板
     ------------------------------------------------------------ */

  function infraProvinceOf(item) {
    return provNameAt(item.lon, item.lat);
  }

  function infraDetailHTML() {
    const si = state.selectedInfra;
    if (!si) return '';
    const it = infraSelectedItem();
    if (!it) return '';
    if (si.kind === 'rail') {
      const kind = RAIL_KIND[it.kind] || { name: '铁路' };
      const provs = [...new Set(it.path.map((p) => provNameAt(p[0], p[1])).filter(Boolean))];
      const kn = RAIL_HUBS.filter((h) => it.path.some((p) => Math.hypot(p[0] - h.lon, p[1] - h.lat) < 0.6));
      return `<div class="note-box">
        <b>${esc(it.name)}</b>　<span class="chip">${esc(kind.name)}</span>
        <div class="infra-meta">经过 ${provs.length} 个省级行政区：${provs.map(esc).join('、')}</div>
        <div>${esc(it.note)}</div>
        ${kn.length ? `<div class="infra-meta">沿线主要枢纽：${kn.map((h) => esc(h.name)).join('、')}</div>` : ''}
        <div class="infra-hint">线位只示意「经过哪些城市」，不代表里程、车次与运营状态。</div>
      </div>`;
    }
    if (si.kind === 'port') {
      return `<div class="note-box">
        <b>${esc(it.name)}</b>　<span class="chip">沿海港口</span>
        <div class="infra-meta">所在：${esc(infraProvinceOf(it) || '—')}　${it.lon.toFixed(2)}°E · ${it.lat.toFixed(2)}°N</div>
        <div>${esc(it.note)}</div>
      </div>`;
    }
    if (si.kind === 'hub') {
      return `<div class="note-box">
        <b>${esc(it.name)}</b>　<span class="chip">铁路枢纽</span>
        <div class="infra-meta">所在：${esc(infraProvinceOf(it) || '—')}</div>
        <div>${esc(it.note)}</div>
      </div>`;
    }
    if (si.kind === 'base') {
      const t = E_TYPE[it.type] || { name: it.type };
      return `<div class="note-box">
        <b>${esc(it.name)}</b>　<span class="chip">${esc(t.name)}</span>
        <div class="infra-meta">所在：${esc(infraProvinceOf(it) || '—')}　${it.lon.toFixed(2)}°E · ${it.lat.toFixed(2)}°N</div>
        <div>${esc(it.note)}</div>
      </div>`;
    }
    const k = CH_KIND[it.kind] || { name: '能源通道' };
    return `<div class="note-box">
      <b>${esc(it.name)}</b>　<span class="chip">${esc(k.name)}</span>
      <div>${esc(it.note)}</div>
      <div class="infra-hint">通道画的是起讫与大致路径，不表示长度与输量。</div>
    </div>`;
  }

  // 高铁里程时间轴：11 个关键年份的累计曲线 + 年份滑块
  const RTW = 320, RTHT = 96, RTPL = 26, RTPR = 8, RTPT = 12, RTPB = 18;
  const RT_X = (i, n) => RTPL + i * (RTW - RTPL - RTPR) / Math.max(1, n - 1);
  const RT_Y = (v, max) => RTHT - RTPB - (v / max) * (RTHT - RTPT - RTPB);
  const rtIdx = () => {
    const H = C.railHistory || [];
    if (!H.length) return 0;
    return state.railYear == null ? H.length - 1 : Math.max(0, Math.min(H.length - 1, state.railYear));
  };

  function railTimeHTML() {
    const H = C.railHistory || [];
    if (H.length < 3) return '';
    const cur = rtIdx();
    const max = Math.max(H[H.length - 1].hsr, 0.01);
    const n = H.length;
    const pts = H.map((d, i) => [RT_X(i, n), RT_Y(d.hsr, max)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[n - 1][0].toFixed(1)},${RTHT - RTPB} L${pts[0][0].toFixed(1)},${RTHT - RTPB} Z`;
    const dots = pts.map((p, i) => {
      const on = i <= cur;
      return `<circle class="rt-dot${i === cur ? ' is-on' : ''}${on ? ' is-past' : ''}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === cur ? 3.4 : 2.2}" data-ry="${i}"/>`;
    }).join('');
    const years = [0, Math.round((n - 1) / 3), Math.round((n - 1) * 2 / 3), n - 1]
      .filter((v, i, a) => a.indexOf(v) === i);
    const xl = years.map((i) => `<text class="rt-t" x="${RT_X(i, n).toFixed(1)}" y="${RTHT - 6}" text-anchor="middle">${H[i].year}</text>`).join('');
    const d = H[cur];
    const first = H[0];
    const span = d.year - first.year;
    const per = span > 0 ? (d.hsr - first.hsr) / span : 0;
    const ratio = first.hsr > 0 ? d.hsr / first.hsr : 0;
    return `<div class="rt" id="railTime">
      <h3>高铁里程，2008 → 2024</h3>
      <div class="rt-sub">营业里程（万公里，年底数），按关键年份取点</div>
      <svg class="rt-chart" viewBox="0 0 ${RTW} ${RTHT}" width="100%" height="${RTHT}" role="img"
        aria-label="全国高铁营业里程从 2008 年的 ${first.hsr} 万公里增长到 ${H[n - 1].hsr} 万公里">
        <path class="rt-area" d="${area}"></path>
        <path class="rt-line" d="${line}"></path>
        <line class="rt-axis" x1="${RTPL}" y1="${RTHT - RTPB}" x2="${RTW - RTPR}" y2="${RTHT - RTPB}"></line>
        ${dots}${xl}
      </svg>
      <input class="rt-slider" type="range" min="0" max="${n - 1}" step="1" value="${cur}"
        style="--rt-p:${(cur / Math.max(1, n - 1) * 100).toFixed(1)}%"
        aria-label="选择年份看高铁里程与当时已通车的线路" />
      <div class="rt-read">${rtReadHTML(cur)}</div>
      <div class="rt-note">把滑块往左拖：地图上没有通车的高铁线会变淡，能直接看出路网一年年长出来。</div>
    </div>`;
  }

  function rtReadHTML(i) {
    const H = C.railHistory || [];
    if (!H.length) return '';
    const d = H[Math.max(0, Math.min(H.length - 1, i))];
    const first = H[0];
    const span = d.year - first.year;
    const per = span > 0 ? (d.hsr - first.hsr) / span : 0;
    const ratio = first.hsr > 0 ? d.hsr / first.hsr : 0;
    return `<b>${d.year} 年底</b> ${d.hsr.toFixed(2)} 万公里 · 是 2008 年的 ${ratio.toFixed(0)} 倍 · 占铁路营业里程 ${(d.hsr / d.total * 100).toFixed(1)}%`
      + (span > 0 ? `<span class="rt-per">2008–${d.year} 年均新增 ${per.toFixed(2)} 万公里</span>` : '')
      + `<span class="rt-note-line">${esc(d.note)}</span>`;
  }

  function rtSync() {
    const H = C.railHistory || [];
    if (!H.length) return;
    const cur = rtIdx();
    const box = document.getElementById('railTime');
    if (!box) return;
    const rd = box.querySelector('.rt-read');
    if (rd) rd.innerHTML = rtReadHTML(cur);
    box.querySelectorAll('.rt-dot').forEach((c) => {
      const i = +c.dataset.ry;
      c.classList.toggle('is-on', i === cur);
      c.classList.toggle('is-past', i <= cur);
    });
    const sl = box.querySelector('.rt-slider');
    if (sl) {
      if (+sl.value !== cur) sl.value = cur;
      const pct = (cur / Math.max(1, H.length - 1)) * 100;
      sl.style.setProperty('--rt-p', pct.toFixed(1) + '%');
    }
  }

  function renderTransport() {
    const k = baseS * state.view.k;
    const hsd = RAIL_LINES.filter((l) => l.kind === 'hsd').length;
    const conv = RAIL_LINES.length - hsd;
    panel.innerHTML = `
      <div class="eyebrow">交通</div>
      <h2>铁路与港口</h2>
      <p class="lead">路网和港口几乎是人口与地形的复写：东部密、西部疏；沿海一串大港，把工厂和海外市场连在一起。</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">铁路营业里程</span><span class="v">16<small>万 km 量级</small></span></div>
        <div class="stat"><span class="k">高速铁路</span><span class="v">4.6<small>万 km 量级</small></span></div>
        <div class="stat"><span class="k">本图铁路</span><span class="v">${RAIL_LINES.length}<small>条（高铁 ${hsd} · 普速 ${conv}）</small></span></div>
        <div class="stat"><span class="k">沿海大港</span><span class="v">${PORTS.length}<small>个</small></span></div>
      </div>
      ${railTimeHTML()}
      <div class="rule"></div>
      <h3>三条规律</h3>
      <div class="note-box">
        <b>东密西疏</b>：路网密度跟着人口密度走。胡焕庸线以东集中了全国九成以上的人口，铁路也最密；青藏高原只有青藏线一条干线。<br/>
        <b>枢纽都是十字</b>：郑州（京广×陇海）、武汉（京广×沿江）、徐州（陇海×京沪）、兰州（陇海×兰新）——两条大干线交叉的地方就是枢纽。<br/>
        <b>港口连着腹地</b>：上海、宁波舟山靠长江与沪昆；连云港是陇海线的出海口；秦皇岛守着大秦铁路——港口背后总有一条把货送到海边的铁路。
      </div>
      <div class="rule"></div>
      <h3>铁路干线（${RAIL_LINES.length} 条）</h3>
      <div class="list" id="railList">
        ${RAIL_LINES.map((l) => {
          const kind = RAIL_KIND[l.kind] || { name: '' };
          const on = state.selectedInfra && state.selectedInfra.kind === 'rail' && state.selectedInfra.name === l.name;
          return `<button class="list-item ${on ? 'is-on' : ''}" data-rail="${esc(l.name)}">
            <span class="li-top"><span class="li-dot" style="background:${kind.color}"></span>
              <span class="li-name">${esc(l.name)}</span><span class="li-tag">${esc(kind.name)}</span></span>
            <span class="li-desc">${esc(l.note)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="rule"></div>
      <h3>沿海港口（${PORTS.length} 个）</h3>
      <div class="list" id="portList">
        ${PORTS.map((p) => {
          const on = state.selectedInfra && state.selectedInfra.kind === 'port' && state.selectedInfra.name === p.name;
          return `<button class="list-item ${on ? 'is-on' : ''}" data-port="${esc(p.name)}">
            <span class="li-top"><span class="li-dot" style="background:#8fc3d4"></span>
              <span class="li-name">${esc(p.name)}</span><span class="li-tag">${esc(infraProvinceOf(p) || '')}</span></span>
            <span class="li-desc">${esc(p.note)}</span>
          </button>`;
        }).join('')}
      </div>
      ${infraDetailHTML()}
      <div class="note-box"><b>为什么港口都在北边？</b>不是的——大连、天津、青岛在渤海与黄海，上海往南还有宁波舟山、厦门、深圳、湛江。港口的位置取决于「背后有没有大河或铁路把货送过来」，而不只是纬度。</div>
      <p class="panel-foot">铁路里程与港口吞吐量为公开的量级说法；本图只画走向与位置，不作为运营依据。</p>`;

    const rtsl = panel.querySelector('.rt-slider');
    if (rtsl) rtsl.oninput = () => {
      state.railYear = +rtsl.value;
      rtSync();
      requestDraw();
    };

    panel.querySelectorAll('[data-rail]').forEach((b) => {
      b.onclick = () => {
        const name = b.dataset.rail;
        state.selectedInfra = state.selectedInfra && state.selectedInfra.kind === 'rail' && state.selectedInfra.name === name
          ? null : { kind: 'rail', name };
        state.selected = null; state.selectedRiver = null; state.selectedMountain = null;
        renderPanel(); requestDraw(); syncURL();
      };
    });
    panel.querySelectorAll('[data-port]').forEach((b) => {
      b.onclick = () => {
        const name = b.dataset.port;
        state.selectedInfra = state.selectedInfra && state.selectedInfra.kind === 'port' && state.selectedInfra.name === name
          ? null : { kind: 'port', name };
        state.selected = null;
        renderPanel(); requestDraw(); syncURL();
      };
    });
    void k;
  }

  function renderEnergy() {
    const types = Object.keys(E_TYPE);
    const count = (t) => E_BASES.filter((b) => b.type === t).length;
    const active = state.hi && state.hi.kind === 'etype' ? state.hi.key : null;
    panel.innerHTML = `
      <div class="eyebrow">能源</div>
      <h2>能源从哪里来</h2>
      <p class="lead">资源在西北与西南，消费在东南沿海。于是有了三条方向相反的巨流：北煤南运、西电东送、西气东输。</p>
      <div class="stat-grid">
        <div class="stat"><span class="k">煤炭占能源消费</span><span class="v">55<small>% 左右</small></span></div>
        <div class="stat"><span class="k">非化石能源</span><span class="v">≈20<small>%</small></span></div>
        <div class="stat"><span class="k">本图基地</span><span class="v">${E_BASES.length}<small>个</small></span></div>
        <div class="stat"><span class="k">跨区通道</span><span class="v">${E_ROUTES.length}<small>条</small></span></div>
      </div>
      <div class="rule"></div>
      <h3>点类型只看这一类</h3>
      <div class="chips infra-chips">
        ${types.map((t) => `<button class="chip ${active === t ? 'is-on' : ''}" data-etype="${t}">
          <i style="background:${E_TYPE[t].color}"></i>${esc(E_TYPE[t].name)} ${count(t)}</button>`).join('')}
        ${active ? '<button class="chip" data-etype="">全部</button>' : ''}
      </div>
      <div class="rule"></div>
      <h3>主要基地（${E_BASES.length} 个）</h3>
      <div class="list" id="baseList">
        ${E_BASES.filter((b) => !active || b.type === active).map((b) => {
          const t = E_TYPE[b.type] || { name: '', color: '#999' };
          const on = state.selectedInfra && state.selectedInfra.kind === 'base' && state.selectedInfra.name === b.name;
          return `<button class="list-item ${on ? 'is-on' : ''}" data-base="${esc(b.name)}">
            <span class="li-top"><span class="li-dot" style="background:${t.color}"></span>
              <span class="li-name">${esc(b.name)}</span><span class="li-tag">${esc(t.name)}</span></span>
            <span class="li-desc">${esc(b.note)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="rule"></div>
      <h3>跨区通道（${E_ROUTES.length} 条）</h3>
      <div class="list" id="routeList">
        ${E_ROUTES.map((r) => {
          const k = CH_KIND[r.kind] || { name: '', color: '#aaa' };
          const on = state.selectedInfra && state.selectedInfra.kind === 'channel' && state.selectedInfra.name === r.name;
          return `<button class="list-item ${on ? 'is-on' : ''}" data-route="${esc(r.name)}">
            <span class="li-top"><span class="li-dot" style="background:${k.color}"></span>
              <span class="li-name">${esc(r.name)}</span><span class="li-tag">${esc(k.name)}</span></span>
            <span class="li-desc">${esc(r.note)}</span>
          </button>`;
        }).join('')}
      </div>
      ${infraDetailHTML()}
      <div class="note-box"><b>为什么能源要「搬家」？</b>煤、油、气、水、风、光都集中在中西部与北部，工业和人口却在东南。输电、输气、运煤三条通道一起，才把西部的资源变成东部的电力与暖气。</div>
      <p class="panel-foot">占比为公开资料的量级说法；基地位置取所在城市，只表示大致方位，不作为选址依据。</p>`;

    panel.querySelectorAll('[data-etype]').forEach((b) => {
      b.onclick = () => {
        const t = b.dataset.etype || null;
        state.hi = t ? { kind: 'etype', key: t } : null;
        renderLegend(); renderPanel(); requestDraw();
      };
    });
    panel.querySelectorAll('[data-base]').forEach((b) => {
      b.onclick = () => {
        const name = b.dataset.base;
        state.selectedInfra = state.selectedInfra && state.selectedInfra.kind === 'base' && state.selectedInfra.name === name
          ? null : { kind: 'base', name };
        state.selected = null;
        renderPanel(); requestDraw(); syncURL();
      };
    });
    panel.querySelectorAll('[data-route]').forEach((b) => {
      b.onclick = () => {
        const name = b.dataset.route;
        state.selectedInfra = state.selectedInfra && state.selectedInfra.kind === 'channel' && state.selectedInfra.name === name
          ? null : { kind: 'channel', name };
        state.selected = null;
        renderPanel(); requestDraw(); syncURL();
      };
    });
  }

  function infraSelectedItem() {
    const si = state.selectedInfra;
    if (!si) return null;
    if (si.kind === 'rail') return RAIL_LINES.find((l) => l.name === si.name) || null;
    if (si.kind === 'port') return PORTS.find((l) => l.name === si.name) || null;
    if (si.kind === 'hub') return RAIL_HUBS.find((l) => l.name === si.name) || null;
    if (si.kind === 'base') return E_BASES.find((l) => l.name === si.name) || null;
    return E_ROUTES.find((l) => l.name === si.name) || null;
  }  /* ------------------------------------------------------------
     知识速记
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     速记页的四张示意图：共用一条真实国界轮廓，叠加不同的线
     ------------------------------------------------------------ */
  const FIGS = (() => {
    const W = 300, H = 182, pad = 9;
    const b = landBBox;
    const s = Math.min((W - pad * 2) / (b[2] - b[0]), (H - pad * 2) / (b[3] - b[1]));
    const ox = (W - (b[2] - b[0]) * s) / 2, oy = (H - (b[3] - b[1]) * s) / 2;
    const xy = (lon, lat) => {
      const [wx, wy] = albers(lon, lat);
      return [ox + (wx - b[0]) * s, oy + (wy - b[1]) * s];
    };
    const parts = [];
    for (const f of GEO.features) {
      if (f.kind === 'line') continue;
      for (const poly of f.polygons) {
        for (const ring of poly) {
          // 三沙群岛太远，会把大陆压小，这里只保留 17.2°N 以北
          const pts = ring.filter(([, lat]) => lat >= 17.2);
          if (pts.length < 6) continue;
          const step = Math.max(1, Math.floor(pts.length / 70));
          const seq = [];
          for (let i = 0; i < pts.length; i += step) seq.push(pts[i]);
          const seg = seq
            .map(([lon, lat], i) => {
              const [x, y] = xy(lon, lat);
              return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');
          parts.push(seg + ' Z');
        }
      }
    }
    return { W, H, xy, d: parts.join(' ') };
  })();

  function figLine(pts) {
    return pts
      .map(([lon, lat], i) => {
        const [x, y] = FIGS.xy(lon, lat);
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }
  function figPoint(lon, lat) {
    const [x, y] = FIGS.xy(lon, lat);
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  }
  function figText(text, lon, lat, cls, dy = 0) {
    const p = figPoint(lon, lat);
    return `<text x="${p.x}" y="${p.y + dy}" class="${cls}">${text}</text>`;
  }
  function figTextA(text, lon, lat, cls) {
    const p = figPoint(lon, lat);
    return `<text x="${p.x}" y="${p.y}" class="${cls}" text-anchor="middle">${text}</text>`;
  }

  function knowledgeFigures() {
    const { W, H, d } = FIGS;
    const qin = figLine([[104.6, 34.6], [107.5, 34.1], [110.5, 33.7], [113.5, 33.3], [116.5, 33.0], [119.5, 32.6], [121.6, 32.1]]);
    const huA = figPoint(127.4, 50.2);
    const huB = figPoint(98.5, 25.0);
    const div = figLine([[121.6, 50.0], [119.0, 46.5], [116.0, 43.0], [112.0, 41.0], [107.5, 39.5], [103.0, 37.5], [98.5, 35.5], [94.0, 33.5], [89.0, 32.0], [84.0, 31.0], [80.0, 30.6]]);

    const panel = (title, cap, inner, label) => `
      <figure class="k-fig">
        <div class="kf-title">${title}</div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
          <use href="#cnOut" class="kf-land"/>
          ${inner}
        </svg>
        <figcaption>${cap}</figcaption>
      </figure>`;

    return `<div class="k-figs">
      <svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
        <path id="cnOut" d="${d}"/>
        <marker id="kfArrowWarm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#d8a657"/></marker>
        <marker id="kfArrowCold" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#5fb6d9"/></marker>
      </defs></svg>
      ${panel(
        '秦岭—淮河',
        '一月 0℃ 等温线与 800 mm 年等降水量线几乎重合，把东部切成南北两半。',
        `<path d="${qin}" class="kf-line"/>
         ${figTextA('北方 · 一月 &lt;0℃ · 年降水 &lt;800mm', 109.0, 39.6, 'kf-t')}
         ${figTextA('南方 · 一月 &gt;0℃ · 年降水 &gt;800mm', 111.0, 28.2, 'kf-t')}`,
        '中国南北分界线示意'
      )}
      ${panel(
        '胡焕庸线',
        '黑河到腾冲，一条斜线分出两种中国：东南一半国土住了九成多人。',
        `<path d="M${huA.x} ${huA.y} L${huB.x} ${huB.y}" class="kf-line kf-dash"/>
         <circle cx="${huA.x}" cy="${huA.y}" r="2.2" class="kf-dot"/>
         <circle cx="${huB.x}" cy="${huB.y}" r="2.2" class="kf-dot"/>
         ${figText('黑河', 127.4, 50.2, 'kf-t3', -5)}
         ${figText('腾冲', 98.5, 25.0, 'kf-t3', 9)}
         ${figTextA('东南 94% 人口', 119.0, 42.4, 'kf-t')}
         ${figTextA('43% 国土', 119.0, 39.4, 'kf-t3')}
         ${figTextA('西北 6% 人口', 92.0, 37.4, 'kf-t')}
         ${figTextA('57% 国土', 92.0, 34.4, 'kf-t3')}`,
        '胡焕庸线（黑河—腾冲线）示意'
      )}
      ${panel(
        '季风',
        '夏季风吹向陆地带来降水，冬季风从内陆吹向海洋，干冷少雨。',
        `<path d="${figLine([[121.5, 21.0], [118.0, 25.5], [114.5, 30.0], [111.0, 34.0], [107.5, 38.0], [104.0, 41.5]])}" class="kf-arrow" marker-end="url(#kfArrowWarm)"/>
         <path d="${figLine([[96.5, 17.5], [99.5, 22.0], [103.0, 26.5], [106.5, 31.0], [110.0, 35.0]])}" class="kf-arrow" marker-end="url(#kfArrowWarm)"/>
         <path d="${figLine([[92.0, 49.5], [98.0, 45.0], [104.0, 40.5], [110.0, 36.0], [116.0, 31.5], [121.0, 28.0]])}" class="kf-arrow kf-cold" marker-end="url(#kfArrowCold)"/>
         ${figText('东南季风', 118.0, 27.0, 'kf-t')}
         ${figText('西南季风', 99.0, 24.0, 'kf-t')}
         ${figText('冬季风', 97.0, 47.5, 'kf-t2')}`,
        '中国季风示意'
      )}
      ${panel(
        '内流区与外流区',
        '外流区的河最终进海，内流区的河消失在盆地与沙漠里。',
        `<path d="${div}" class="kf-line kf-dash"/>
         ${figText('内流区', 88.0, 42.0, 'kf-t')}
         ${figText('外流区', 113.0, 42.0, 'kf-t')}
         ${figText('分水界', 96.0, 34.0, 'kf-t3', 0)}`,
        '内流区与外流区分界示意'
      )}
    </div>`;
  }

  function renderKnowledge() {
    const grid = $('#kgrid');
    const stair = `
      <svg viewBox="0 0 360 190" role="img" aria-label="中国地势三级阶梯示意">
        <defs>
          <linearGradient id="st1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d3c4b0"/><stop offset="1" stop-color="#d3c4b0" stop-opacity=".15"/></linearGradient>
          <linearGradient id="st2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8977a"/><stop offset="1" stop-color="#a8977a" stop-opacity=".15"/></linearGradient>
          <linearGradient id="st3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d9270"/><stop offset="1" stop-color="#7d9270" stop-opacity=".15"/></linearGradient>
        </defs>
        <path d="M0 150 L0 40 L120 40 L120 82 L232 82 L232 118 L360 118 L360 150 Z" fill="url(#st1)" opacity=".28"/>
        <path d="M120 82 L232 82 L232 118 L360 118 L360 150 L120 150 Z" fill="url(#st2)" opacity=".28"/>
        <path d="M232 118 L360 118 L360 150 L232 150 Z" fill="url(#st3)" opacity=".32"/>
        <path d="M0 40 L120 40 L120 82 L232 82 L232 118 L360 118 L360 150" fill="none" stroke="var(--gold-2)" stroke-width="1.4"/>
        <text x="10" y="30" fill="#d3c4b0" font-size="10" font-family="Songti SC,serif">第一级 · 4000m+</text>
        <text x="132" y="72" fill="#d3c4b0" font-size="10" font-family="Songti SC,serif">第二级 · 1000–2000m</text>
        <text x="248" y="108" fill="#d3c4b0" font-size="10" font-family="Songti SC,serif">第三级 · &lt;500m</text>
        <text x="4" y="166" fill="#8ba0ad" font-size="9" font-family="PingFang SC,sans-serif">青藏高原</text>
        <text x="150" y="166" fill="#8ba0ad" font-size="9" font-family="PingFang SC,sans-serif">高原与盆地</text>
        <text x="286" y="166" fill="#8ba0ad" font-size="9" font-family="PingFang SC,sans-serif">平原与丘陵</text>
        <path d="M6 178 L40 178" stroke="#8ba0ad" stroke-width="1" stroke-dasharray="2 3"/>
        <text x="46" y="181" fill="#5f7484" font-size="9" font-family="PingFang SC,sans-serif">西</text>
        <text x="330" y="181" fill="#5f7484" font-size="9" font-family="PingFang SC,sans-serif">东</text>
      </svg>`;

    grid.innerHTML = `
      <div class="k-hero" style="grid-column:1/-1">
        <div>
          <h2>把中国地理，压缩成一页</h2>
          <p>先看地势，再记三条分界线，然后认省区，最后去闯关。这张「速记页」把最容易混淆的数字与概念放在一起，随时回来查。</p>
          <div class="k-path"><span>① 地势三级阶梯</span><span>② 三条分界线</span><span>③ 34 个省级</span><span>④ 闯关检验</span></div>
        </div>
        ${stair}
      </div>
      ${knowledgeFigures()}
      ${C.notes.map((n) => noteCard(n)).join('')}`;
  }

  function noteCard(n) {
    const color = { steps: '#d8a657', list: '#5fb6d9', lines: '#7fd4c1', climate: '#9b8fc0', extremes: '#e0c07a', neighbors: '#63a98c', provinces: '#c8974e' }[n.kind] || '#d8a657';
    let body = '';
    if (n.kind === 'steps') {
      body = `<div class="k-steps">
        ${C.steps.map((s, i) => `<div class="k-step" style="--c:${s.color};height:${[96, 60, 34][i]}%"><span>${s.name.replace('阶梯', '')}</span></div>`).join('')}
      </div>
      <div class="k-list">${C.steps.map((s) => `<div class="k-row"><span class="k-name">${s.name}</span><span class="k-desc">${s.elev} · ${s.area}</span></div>`).join('')}</div>`;
    } else if (n.kind === 'list') {
      body = `<div class="k-list">${n.items.map(([a, b]) => `<div class="k-row"><span class="k-name">${a}</span><span class="k-desc">${b}</span></div>`).join('')}</div>`;
    } else if (n.kind === 'lines') {
      body = `<div class="k-list">${n.items.map(([a, b]) => `<div class="k-row"><span class="k-name">${a}</span><span class="k-desc">${b}</span></div>`).join('')}</div>`;
    } else if (n.kind === 'climate') {
      body = `<div class="k-list">${C.climates.map((c) => `<div class="k-row"><span class="k-name" style="color:${c.color}">${c.name}</span><span class="k-desc">${c.key} · ${c.where}</span></div>`).join('')}</div>`;
    } else if (n.kind === 'extremes') {
      body = `<div>${C.extremes.map(([a, b, c]) => `<div class="k-num"><span class="n">${a} · ${b}</span><span class="v">${c}</span></div>`).join('')}</div>`;
    } else if (n.kind === 'neighbors') {
      body = `<div class="k-tags">${C.neighbors.map((x) => `<span>${x}</span>`).join('')}</div><div class="k-lead">${n.lead}</div>`;
    } else if (n.kind === 'provinces') {
      body = `<div class="k-table">${C.provinces.map((p) => `<div><b>${p.label}</b><i>${p.short}${p.capital !== '—' ? ' · ' + p.capital : ''}</i></div>`).join('')}</div>`;
    } else if (n.kind === 'sources') {
      body = `<div class="k-src">
        <table class="k-src-t"><thead><tr><th>项目</th><th>取值</th><th>来源与处理</th></tr></thead>
        <tbody>${C.dataRows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td><code>${esc(b)}</code></td><td>${esc(c)}</td></tr>`).join('')}</tbody></table>
        <div class="k-src-m">${C.dataMethods.map(([t, b]) => `<details><summary>${esc(t)}</summary><p>${esc(b)}</p></details>`).join('')}</div>
        <ul class="k-src-l">${C.dataLimits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`;
    }
    const idAttr = n.kind === 'sources' ? ' id="kSrc"' : '';
    return `<article class="kcard ${n.kind === 'provinces' ? 'span2' : ''}"${idAttr} style="--kc:${color}">
      <h3>${esc(n.title)}</h3>
      ${n.lead && n.kind !== 'neighbors' ? `<div class="k-lead">${esc(n.lead)}</div>` : ''}
      ${body}
    </article>`;
  }

  /* ------------------------------------------------------------
     剖面图
     ------------------------------------------------------------ */
  const profCanvas = $('#profile');
  const pctx = profCanvas.getContext('2d');
  let pw = 1, ph = 1, profHover = null;

  function layoutProfile() {
    if (state.tab !== 'landform') return;
    const r = profCanvas.getBoundingClientRect();
    pw = Math.max(1, r.width); ph = Math.max(1, r.height);
    profCanvas.width = Math.round(pw * DPR);
    profCanvas.height = Math.round(ph * DPR);
    drawProfile();
  }

  const PM = { l: 44, r: 16, t: 12, b: 24 };
  const LON0 = 79, LON1 = 122, EMAX = 5400;

  function px(lon) { return PM.l + ((lon - LON0) / (LON1 - LON0)) * (pw - PM.l - PM.r); }
  function py(e) { return ph - PM.b - (e / EMAX) * (ph - PM.t - PM.b); }

  function drawProfile() {
    if (!pw) return;
    pctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pctx.clearRect(0, 0, pw, ph);

    // 阶梯底色
    const bands = [[LON0, 101.5, C.steps[0].color], [101.5, 110.0, C.steps[1].color], [110.0, LON1, C.steps[2].color]];
    for (const [a, b, c] of bands) {
      pctx.fillStyle = hexA(c, 0.055);
      pctx.fillRect(px(a), PM.t, px(b) - px(a), ph - PM.t - PM.b);
    }
    // 网格
    pctx.strokeStyle = TH.profGrid;
    pctx.fillStyle = TH.profAxis;
    pctx.font = '9px ' + FONT_MONO;
    pctx.textAlign = 'right';
    pctx.textBaseline = 'middle';
    for (let e = 0; e <= 5000; e += 1000) {
      const y = py(e);
      pctx.beginPath(); pctx.moveTo(PM.l, y); pctx.lineTo(pw - PM.r, y); pctx.stroke();
      pctx.fillText(e + '', PM.l - 7, y);
    }
    pctx.save();
    pctx.translate(11, (ph - PM.b + PM.t) / 2);
    pctx.rotate(-Math.PI / 2);
    pctx.textAlign = 'center';
    pctx.fillStyle = TH.profAxis2;
    pctx.fillText('海拔 (m)', 0, 0);
    pctx.restore();

    // 经度
    pctx.textAlign = 'center';
    pctx.textBaseline = 'top';
    for (let lon = 80; lon <= 120; lon += 10) {
      pctx.fillStyle = TH.profAxis3;
      pctx.fillText(lon + '°E', px(lon), ph - PM.b + 6);
    }

    // 山体
    const path = new Path2D();
    path.moveTo(px(C.profile[0][0]), py(0));
    for (const [lon, e] of C.profile) path.lineTo(px(lon), py(e));
    path.lineTo(px(C.profile[C.profile.length - 1][0]), py(0));
    path.closePath();
    const grad = pctx.createLinearGradient(0, py(EMAX), 0, py(0));
    grad.addColorStop(0, TH.profGrad1);
    grad.addColorStop(0.35, TH.profGrad2);
    grad.addColorStop(1, TH.profGrad3);
    pctx.fillStyle = grad;
    pctx.fill(path);
    pctx.strokeStyle = TH.profLine;
    pctx.lineWidth = 1.6;
    pctx.beginPath();
    C.profile.forEach(([lon, e], i) => {
      if (i === 0) pctx.moveTo(px(lon), py(e)); else pctx.lineTo(px(lon), py(e));
    });
    pctx.stroke();

    // 阶梯分界
    pctx.save();
    pctx.setLineDash([4, 4]);
    pctx.strokeStyle = TH.profCross;
    pctx.lineWidth = 1;
    for (const lon of [101.5, 110.0]) {
      pctx.beginPath(); pctx.moveTo(px(lon), PM.t); pctx.lineTo(px(lon), ph - PM.b); pctx.stroke();
    }
    pctx.restore();

    // 标注点
    pctx.font = '10px ' + FONT_SANS;
    let lastLabelX = -99;
    for (const [lon, e, name] of C.profile) {
      if (!name) continue;
      const x = px(lon), y = py(e);
      pctx.beginPath();
      pctx.arc(x, y, 2.2, 0, Math.PI * 2);
      pctx.fillStyle = TH.profDot;
      pctx.fill();
      if (x - lastLabelX < 54) continue;
      lastLabelX = x;
      pctx.textAlign = lon > 116 ? 'right' : 'center';
      pctx.textBaseline = 'bottom';
      pctx.fillStyle = TH.profLabel;
      pctx.fillText(name, lon > 116 ? x - 4 : x, y - 7);
      if (lon > 100 && e > 3000) {
        pctx.fillStyle = TH.profAxis4;
        pctx.fillText(Math.round(e) + 'm', x, y + 13);
        pctx.textBaseline = 'bottom';
      }
    }

    // hover
    if (profHover) {
      const [lon] = profHover;
      const x = px(lon);
      pctx.strokeStyle = TH.profHover;
      pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(x, PM.t); pctx.lineTo(x, ph - PM.b); pctx.stroke();
      pctx.beginPath(); pctx.arc(x, py(profHover[1]), 3.2, 0, Math.PI * 2);
      pctx.fillStyle = TH.profDot2; pctx.fill();
    }
  }

  profCanvas.addEventListener('pointermove', (e) => {
    const r = profCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const lon = LON0 + ((x - PM.l) / (pw - PM.l - PM.r)) * (LON1 - LON0);
    let best = null, bd = Infinity;
    for (const pt of C.profile) {
      const d = Math.abs(pt[0] - lon);
      if (d < bd) { bd = d; best = pt; }
    }
    profHover = best;
    state.profileLon = best ? best[0] : null;
    drawProfile();
    requestDraw();
    if (best) {
      const tip2 = $('#dockTitle');
      $("#dockTitle").innerHTML = `${best[2] ? esc(best[2]) + ' · ' : ''}${best[0].toFixed(1)}°E · 海拔 ${fmt(best[1])} m`;
    }
  });
  profCanvas.addEventListener('pointerleave', () => {
    profHover = null;
    state.profileLon = null;
    $('#dockTitle').textContent = '沿北纬 30° 的地形剖面';
    drawProfile();
    requestDraw();
  });

  /* ------------------------------------------------------------
     控件与 Tab
     ------------------------------------------------------------ */
  const TAB_PRESET = {
    explore: { fill: 'region', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false }, pill: ['地理分区', '34 个省级行政区'], tip: '点击省份看它的地形、气候与家底；左侧可以切换着色方式。' },
    landform: { fill: 'step', layers: { labels: true, capitals: false, cities: false, mountains: true, rivers: false, lines: false, monsoon: true, hill: true }, pill: ['西高东低', '三级阶梯'], tip: '虚线是阶梯分界线：昆仑山—祁连山—横断山，大兴安岭—太行山—巫山—雪峰山。' },
    climate: { fill: 'climate', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false }, pill: ['五个气候类型', '季风气候显著'], tip: '按主导气候类型着色；点右侧类型可以高亮对应省份。' },
    agri: { fill: 'crop', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: true, lines: false, monsoon: true, hill: false }, pill: ['农业分区', '400 mm 线与熟制'], tip: '按主导作物给省份着色；400 mm 年等降水量线以西，种植业让位于草原畜牧。' },
    water: { fill: 'region', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: true, lines: false, monsoon: true, hill: false }, pill: ['外流区为主', '自西向东'], tip: '河流大多自西向东注入太平洋，这是地势决定的。点河流看详细资料。' },
    quiz: { fill: 'region', layers: { labels: false, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false }, pill: ['点击作答', '满分 10 分'], tip: '找省份题会隐藏名称。答错会标出正确位置。' },
    transport: { fill: 'region', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: false, hill: false, rail: true, ports: true, hubs: true }, pill: ['东密西疏', '路网与港口'], tip: '彩色的线是铁路干线，方块是沿海港口，同心圆是铁路枢纽。点线或列表看详情。' },
    energy: { fill: 'region', layers: { labels: true, capitals: false, cities: false, mountains: false, rivers: false, lines: false, monsoon: false, hill: false, bases: true, channels: true }, pill: ['资源在西', '消费在东'], tip: '圆点是能源基地，虚线带箭头的是跨区通道。点右侧类型只看一类。' },
    notes: { fill: 'region', layers: { labels: true, capitals: false, mountains: false, rivers: false, lines: false, monsoon: true, hill: false }, pill: [], tip: '' }
  };

  function setTab(tab) {
    const prevTab = state.tab;
    state.tab = tab;
    document.body.dataset.tab = tab;
    $$('#tabs .tab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const preset = TAB_PRESET[tab];
    state.fill = preset.fill;
    if (!state.layersTouched) {
      // 用户没动过图层：按这个视图的推荐配置来
      state.layers = { ...preset.layers };
    } else if (tab === 'quiz') {
      // 闯关要藏省名；离开时恢复用户自己勾的那份
      if (prevTab !== 'quiz') state.preQuizLayers = { ...state.layers };
      state.layers = { ...state.layers, labels: false, capitals: false };
    } else if (prevTab === 'quiz' && state.preQuizLayers) {
      state.layers = { ...state.preQuizLayers };
      state.preQuizLayers = null;
    }
    // 新图层键（交通/能源）在旧的本地配置里没有：按本视图的 preset 补默认值
    for (const kk of ['rail', 'ports', 'hubs', 'bases', 'channels']) {
      if (state.layers[kk] === undefined && preset.layers[kk] !== undefined) state.layers[kk] = preset.layers[kk];
    }
    state.highlightClimate = null;
    state.highlightCrop = null;
    state.hi = null;
    state.profileLon = null;
    state.dimOthers = null;
    state.selected = null;
    state.selectedRiver = null;
    state.selectedMountain = null;
    state.selectedInfra = null;
    state.hoverInfra = null;
    state.hover = null;
    state.quizMarks = {};
    if (tab !== 'quiz' && state.quiz) state.quiz = null;

    const isNotes = tab === 'notes';
    $('#stage').classList.toggle('is-hidden', isNotes);
    $('#knowledge').hidden = !isNotes;
    $('#rail').style.display = isNotes ? 'none' : '';
    if (isNotes) {
      $('#knowledge').scrollTop = 0;
      syncURL();
      return;
    }

    // dock
    $('#dock').hidden = tab !== 'landform';
    if (tab === 'landform') {
      $('#dockTitle').textContent = '沿北纬 30° 的地形剖面';
      $('#dockLegend').innerHTML = C.steps.map((s) => `<i style="--c:${swatch(s.color)}">${s.name.replace('阶梯', '')}</i>`).join('');
      setTimeout(layoutProfile, 30);
    }

    // pills
    $('#mapPills').innerHTML = (preset.pill || []).map((p, i) => `<span class="pill">${i === 0 ? '<b>' + esc(p) + '</b>' : esc(p)}</span>`).join('');
    $('#railTip').textContent = preset.tip;
    $('#emptyHint').classList.toggle('is-off', tab !== 'explore');
    syncControls();
    renderPanel();
    requestDraw();
    if (tab === 'quiz') { state.quiz = null; renderQuiz(); }
  }

  function syncControls() {
    $$('#fillModes button').forEach((b) => b.classList.toggle('is-on', b.dataset.fill === state.fill));
    $$('#layerList input').forEach((i) => { i.checked = !!state.layers[i.dataset.layer]; });
    renderLegend();
  }

  function renderLegend() {
    const box = $('#legend');
    const note = $('#legendNote');
    const count = (fn) => C.provinces.filter(fn).length;
    const row = (kind, key, color, name, extra) => {
      const hi = state.hi;
      const on = hi && hi.kind === kind && hi.key === key;
      const off = hi && !on;
      return `<div class="legend-row is-clickable${off ? ' is-off' : ''}${on ? ' is-on' : ''}" role="button" tabindex="0" data-hi="${kind}:${key}"><span class="sw" style="background:${swatch(color)}"></span>${name}<small>${extra}</small></div>`;
    };
    if (state.tab === 'quiz') {
      note.textContent = '作答';
      box.innerHTML = `<div class="legend-row"><span class="sw" style="background:${swatch(C.regions['华东'].color)}"></span>点击省份作答</div>`;
      return;
    }
    if (state.fill === 'step') {
      note.textContent = '地势';
      box.innerHTML = C.steps.map((s) => row('step', String(s.id), s.color, s.name, `${s.elev} · ${count((p) => p.step === s.id)}省`)).join('');
      bindLegend();
      return;
    }
    if (state.fill === 'crop') {
      note.textContent = '主导作物';
      box.innerHTML = CROPS.map((c) => row('crop', c.id, c.color, c.name, `${count((p) => p.crop === c.id)} 省`)).join('');
      bindLegend();
      return;
    }
    if (state.fill === 'climate') {
      note.textContent = '气候';
      box.innerHTML = C.climates.map((c) => row('climate', c.id, c.color, c.name, `${count((p) => p.climate === c.id)} 省`)).join('');
      bindLegend();
      return;
    }
    if (state.tab === 'transport') {
      note.textContent = '交通';
      const nHsd = RAIL_LINES.filter((l) => l.kind === 'hsd').length;
      box.innerHTML = [
        row('railkind', 'hsd', RAIL_KIND.hsd.color, '高速铁路', `${nHsd} 条`),
        row('railkind', 'conv', RAIL_KIND.conv.color, '普速干线', `${RAIL_LINES.length - nHsd} 条`),
        `<div class="legend-row"><span class="sw" style="background:${swatch('#8fc3d4')}"></span>沿海港口<small>${PORTS.length} 个</small></div>`,
        `<div class="legend-row"><span class="sw sw-ring"></span>铁路枢纽<small>${RAIL_HUBS.length} 个</small></div>`
      ].join('');
      bindLegend();
      return;
    }
    if (state.tab === 'energy') {
      note.textContent = '能源';
      box.innerHTML = Object.keys(E_TYPE).map((t) =>
        row('etype', t, E_TYPE[t].color, E_TYPE[t].name,
          `${E_BASES.filter((b) => b.type === t).length} 个基地`)).join('')
        + Object.keys(CH_KIND).map((k2) => row('echkind', k2, CH_KIND[k2].color, CH_KIND[k2].name, ''))
        .join('');
      bindLegend();
      return;
    }
    note.textContent = '七大区';
    box.innerHTML = REGION_ORDER.map((r) => row('region', r, C.regions[r].color, r, `${count((p) => p.region === r)}`)).join('');
    bindLegend();
  }

  function bindLegend() {
    $$('#legend .legend-row[data-hi]').forEach((el) => {
      const raw = el.dataset.hi;
      const i = raw.indexOf(':');
      const kind = raw.slice(0, i), key = raw.slice(i + 1);
      const toggle = () => {
        const on = state.hi && state.hi.kind === kind && state.hi.key === key;
        state.hi = on ? null : { kind, key };
        state.dimOthers = null;
        state.highlightClimate = null;
        state.highlightCrop = null;
        renderLegend();
        requestDraw();
      };
      el.onclick = toggle;
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      };
    });
  }

  $$('#fillModes button').forEach((b) => {
    b.onclick = () => {
      state.fill = b.dataset.fill;
      syncControls();
      requestDraw();
    };
  });

  $$('#layerList input').forEach((i) => {
    i.onchange = () => {
      state.layers[i.dataset.layer] = i.checked;
      // 手动改过图层后，切视图 / 用查找都不再把它还原成推荐配置
      state.layersTouched = true;
      savePrefs();
      requestDraw();
    };
  });

  $$('#themer button').forEach((b) => {
    b.onclick = () => applyTheme(b.dataset.theme);
  });

  const exportBtn = $('#exportPng');
  if (exportBtn) exportBtn.onclick = exportPng;
  const printBtn = $('#printBtn');
  if (printBtn) printBtn.onclick = () => window.print();

  // 搜索
  const search = $('#search');
  const results = $('#searchResults');
  function doSearch() {
    const q = search.value.trim();
    if (!q) { results.innerHTML = ''; results.hidden = true; return; }
    const hits = [];
    for (const p of C.provinces) {
      const ql = q.toLowerCase();
      const pyWords = (p.py || '').split(' ');
      const pyHit = ql.length >= 2 && (pyWords.some((w) => w.startsWith(ql)) || (ql.length >= 3 && pyWords.some((w) => w.includes(ql))));
      if (p.name.includes(q) || p.label.includes(q) || p.short === q || (p.capital !== '—' && p.capital.includes(q)) || pyHit) {
        hits.push({ kind: '省份', name: p.name, sub: `${p.short} · ${p.capital}`, act: () => { setTab('explore'); selectProvince(p.name, true); } });
      }
    }
    for (const r of C.rivers) {
      if (r.name.includes(q) || (r.alias || '').includes(q)) {
        hits.push({ kind: '河流', name: r.name, sub: `${r.rank} · ${r.length}`, act: () => { setTab('water'); state.selectedRiver = r.name; state.selected = null; renderPanel(); const mid = r.path[Math.floor(r.path.length / 2)]; focusCoords(mid[0], mid[1], 2.1); } });
      }
    }
    for (const m of C.mountains) {
      if (m.name.includes(q)) {
        hits.push({ kind: '山脉', name: m.name, sub: m.elev, act: () => { setTab('landform'); state.selectedMountain = m.name; state.selected = null; renderPanel(); focusCoords(m.coord[0], m.coord[1], 2.4); } });
      }
    }
    const top = hits.slice(0, 8);
    results.hidden = false;
    if (!top.length) { results.innerHTML = '<div class="empty">没有找到，试试「新疆」「长江」「秦岭」「乌鲁木齐」</div>'; return; }
    results.innerHTML = '';
    for (const h of top) {
      const b = document.createElement('button');
      b.innerHTML = `<span class="sr-k">${h.kind}</span>${esc(h.name)}<span class="sr-s">${esc(h.sub)}</span>`;
      b.onclick = () => { search.value = ''; results.innerHTML = ''; results.hidden = true; h.act(); };
      results.appendChild(b);
    }
  }
  search.addEventListener('input', doSearch);
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = results.querySelector('button'); if (f) f.click(); } });

  /* ------------------------------------------------------------
     五步导览
     ------------------------------------------------------------ */
  const TOUR_KEY = 'cn-geo:tour:v1';
  const TOUR = [
    {
      title: '先看三级阶梯',
      body: '中国地势西高东低，像三级台阶：青藏高原平均 4000 米以上，中部高原盆地 1000–2000 米，东部平原丘陵 500 米以下。<b>大江大河都顺着这个坡度向东流。</b>',
      run() { setTab('landform'); resetView(); }
    },
    {
      title: '400 mm 线：种庄稼还是放牛羊',
      body: '这条虚线大致沿大兴安岭—张家口—兰州—拉萨。<b>线以东以南降水多，种庄稼；以西以北干旱，以放牧为主。</b>新疆的棉田、内蒙古的草原，就分在线的两侧。',
      run() { setTab('agri'); resetView(); }
    },
    {
      title: '季风把雨带到这里',
      body: '夏季风从太平洋、印度洋吹来，降水由东南沿海向西北内陆递减。<b>秦岭—淮河一线</b>既是 1 月 0℃ 等温线，也是南方与北方的分界。',
      run() { setTab('climate'); resetView(); }
    },
    {
      title: '大江东去',
      body: '长江、黄河都发源于青藏高原，自西向东注入太平洋。点图上任意一条河，能看到它的源头、入海口和沿途省区。',
      run() { setTab('water'); resetView(); }
    },
    {
      title: '最后，找到你的省',
      body: '点击地图上的省份，右侧会给出地形、气候、面积、人口与排名。<b>也可以用右上角搜索「四川」，或者直接打拼音「sc」。</b>',
      run() { setTab('explore'); state.layers.labels = true; requestDraw(); }
    }
  ];

  let tourIdx = -1;
  const tourEl = document.createElement('div');
  tourEl.className = 'tour';
  tourEl.setAttribute('role', 'dialog');
  tourEl.setAttribute('aria-label', '五步导览');
  document.body.appendChild(tourEl);

  function tourRender() {
    const st = TOUR[tourIdx];
    tourEl.innerHTML = `
      <div class="tour-head">
        <span class="tour-step">导览 ${tourIdx + 1} / ${TOUR.length}</span>
        <span class="tour-dots">${TOUR.map((_, i) => `<i class="${i <= tourIdx ? 'on' : ''}"></i>`).join('')}</span>
      </div>
      <h4>${st.title}</h4>
      <p>${st.body}</p>
      <div class="tour-actions">
        <button class="tour-btn" data-act="skip">跳过</button>
        <span class="spacer"></span>
        ${tourIdx > 0 ? '<button class="tour-btn" data-act="prev">上一步</button>' : ''}
        <button class="tour-btn primary" data-act="next">${tourIdx === TOUR.length - 1 ? '开始探索' : '下一步'}</button>
      </div>`;
    tourEl.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'skip') return endTour();
        if (a === 'prev') return tourGo(tourIdx - 1);
        if (tourIdx >= TOUR.length - 1) return endTour();
        tourGo(tourIdx + 1);
      };
    });
    tourEl.classList.add('is-on');
  }

  function tourGo(i) {
    tourIdx = Math.max(0, Math.min(TOUR.length - 1, i));
    TOUR[tourIdx].run();
    tourRender();
  }

  function startTour() { tourGo(0); }

  function endTour() {
    tourEl.classList.remove('is-on');
    tourIdx = -1;
    try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) {}
  }

  $('#tourBtn').onclick = () => startTour();

  // 首次来访自动播放（有深链接参数时不打扰）
  const tourBootSearch = location.search;
  setTimeout(() => {
    try {
      if (!tourBootSearch && !localStorage.getItem(TOUR_KEY) && tourIdx < 0) startTour();
    } catch (e) {}
  }, 1200);

  $$('#tabs .tab').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });

  let printTheme = null;
  window.addEventListener('beforeprint', () => {
    if (state.theme === 'night') {
      printTheme = 'night';
      applyTheme('paper', false);
    }
    // 打印版式里地图高度变成 118mm，等版面稳定后按新尺寸重算画布
    setTimeout(() => { resize(); requestDraw(); }, 60);
  });
  window.addEventListener('afterprint', () => {
    if (printTheme) { applyTheme(printTheme, false); printTheme = null; }
  });

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

    if (e.key === 'Escape') {
      if (typing) { t.blur(); return; }
      if (tourIdx >= 0) { endTour(); return; }
      state.selected = null; state.selectedRiver = null; state.selectedMountain = null;
      renderPanel(); requestDraw(); syncURL();
      return;
    }
    if (typing) return;   // 在搜索框里打 +、-、0 不该动地图

    if (e.key === '+' || e.key === '=') { zoomAt(W / 2, H / 2, 1.3); e.preventDefault(); return; }
    if (e.key === '-' || e.key === '_') { zoomAt(W / 2, H / 2, 1 / 1.3); e.preventDefault(); return; }
    if (e.key === '0') { resetView(); e.preventDefault(); return; }

    const stepPan = 90;
    const pan = { ArrowLeft: [stepPan, 0], ArrowRight: [-stepPan, 0], ArrowUp: [0, stepPan], ArrowDown: [0, -stepPan] }[e.key];
    if (pan) {
      // 连续按方向键时，以动画目标为基准累加，否则上一次的位移会被吃掉
      const base = anim && anim.to ? anim.to : state.view;
      setView({ k: base.k, tx: base.tx + pan[0], ty: base.ty + pan[1] }, 140);
      pickDirty = true;
      e.preventDefault();
    }
  });

  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */
  window.__DBG = {
    state, DEBUG, shapes, provinceShapes, albers, frame, INSET,
    inv: (x, y) => ALBERS.inv(x, y), elevAt, wrongAll, readoutAt,
    redraw: () => { cachedKey = ''; requestDraw(); },
    iso: (month) => {
      const m = month || state.iso;
      if (!m) return null;
      const d = isoLines(m);
      return d.map((l) => ({ v: l.v, n: l.lines.length, pts: l.lines.reduce((a, p) => a + p.length, 0), len: l.lines.length ? Math.max(...l.lines.map((p) => p.length)) : 0 }));
    },
    isoLabels: () => isoLabels.slice(),
    isoAt: (month, lon, lat) => {
      const f = isoField(month);
      const fx = (lon - f.lon0) / f.step, fy = (lat - f.lat0) / f.step;
      const i = Math.min(f.nx - 2, Math.max(0, Math.floor(fx))), j = Math.min(f.ny - 2, Math.max(0, Math.floor(fy)));
      const tx = fx - i, ty = fy - j;
      const v = (a, b) => f.vals[b * f.nx + a];
      const top = v(i, j) * (1 - tx) + v(i + 1, j) * tx;
      const bot = v(i, j + 1) * (1 - tx) + v(i + 1, j + 1) * tx;
      return +(top * (1 - ty) + bot * ty).toFixed(1);
    },
    hill: () => {
      const t = hillTexture();
      if (!t) return null;
      const g = t.getContext('2d');
      const d = g.getImageData(0, 0, t.width, t.height).data;
      let nz = 0, sum = 0, max = 0, tot = 0;
      for (let i = 3; i < d.length; i += 4) {
        tot++;
        if (d[i] > 0) { nz++; sum += d[i]; if (d[i] > max) max = d[i]; }
      }
      const idx = hillBandIndex();
      const hist = new Array(HILL_BANDS).fill(0);
      let sea = 0;
      for (const b of idx) { if (b < 0) sea++; else hist[b]++; }
      return { w: t.width, h: t.height, cover: +(nz / tot).toFixed(3), avgA: nz ? +(sum / nz).toFixed(1) : 0, maxA: max, hist, sea };
    },
    metrics: () => ({ W, H, DPR, baseS, cx, cy, wb }),
    screen: (lon, lat) => { const p = albers(lon, lat); return [sx(p[0]), sy(p[1])]; },
    w2s: (wx, wy) => [sx(wx), sy(wy)],
    overlaps() {
      const L = DEBUG.labels; let n = 0; const pairs = [];
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (!(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h)) { n++; if (pairs.length < 12) pairs.push(a.t + '/' + b.t); }
      }
      return { n, pairs };
    }
  };

  resize();

  // 先记下进站时的查询串：下面 syncURL 会重写地址栏，别把深链接参数冲掉
  const bootSearch = location.search;

  // 恢复上次的主题与图层勾选
  const prefs = loadPrefs();
  if (prefs) {
    if (prefs.layersTouched && prefs.layers) {
      state.layersTouched = true;
      state.layers = { ...state.layers, ...prefs.layers };
    }
    state.themePinned = !!prefs.themePinned;
    if (prefs.iso === 'jan' || prefs.iso === 'jul' || prefs.iso === 'ppt') state.iso = prefs.iso;
    if (prefs.bubble === 'pop' || prefs.bubble === 'area') state.bubble = prefs.bubble;
    applyTheme(prefs.theme || 'night', false);
  } else {
    // 头一次打开：跟随系统的浅色/深色偏好，别一上来就压一片黑
    const light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(light ? 'paper' : 'night', false);
  }

  // 系统在页面开着时切深浅色：只要用户没手动选过主题，就跟着变
  if (window.matchMedia) {
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = (e) => { if (!state.themePinned) applyTheme(e.matches ? 'night' : 'paper', false); };
    if (scheme.addEventListener) scheme.addEventListener('change', onScheme);
    else if (scheme.addListener) scheme.addListener(onScheme);
  }

  renderKnowledge();
  setTab('explore');
  readURL(bootSearch);
  // 入场：先扫过一遍（减少动态效果时直接显示，不做扫光）
  if (reducedMotion()) state.reveal = 1;
  else setTimeout(() => { state.revealT0 = performance.now(); requestDraw(); }, 30);
})();
