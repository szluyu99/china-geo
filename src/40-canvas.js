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

