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
