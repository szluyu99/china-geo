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

