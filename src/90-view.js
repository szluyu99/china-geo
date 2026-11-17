  /* ------------------------------------------------------------
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

