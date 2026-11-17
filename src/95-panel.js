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

