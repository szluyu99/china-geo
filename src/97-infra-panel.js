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
  }