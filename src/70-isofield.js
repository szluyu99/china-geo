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

