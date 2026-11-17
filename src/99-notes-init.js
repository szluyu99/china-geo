  /* ------------------------------------------------------------
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
    state.highlightClimate = null;
    state.highlightCrop = null;
    state.hi = null;
    state.profileLon = null;
    state.dimOthers = null;
    state.selected = null;
    state.selectedRiver = null;
    state.selectedMountain = null;
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
