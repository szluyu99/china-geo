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
  }