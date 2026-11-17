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

