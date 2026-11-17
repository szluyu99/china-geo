  /* ------------------------------------------------------------
     预投影：把 GeoJSON 变成 Path2D（世界坐标 = 投影坐标）
     ------------------------------------------------------------ */
  const shapes = [];
  let wb = { x0: 0, y0: 0, x1: 1, y1: 1 };
  (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of GEO.features) {
      const path = new Path2D();
      let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const poly of f.polygons) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = albers(ring[i][0], ring[i][1]);
            if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
            if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
            if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
          path.closePath();
        }
      }
      shapes.push({
        name: f.name, kind: f.kind, path,
        bbox: [fx0, fy0, fx1, fy1],
        centroid: f.centroid ? albers(f.centroid[0], f.centroid[1]) : [fx0 + (fx1 - fx0) / 2, fy0 + (fy1 - fy0) / 2]
      });
    }
    wb = { x0, y0, x1, y1 };
  })();

  const provinceShapes = shapes.filter((s) => s.kind === 'province');

  // 陆地合成路径：晕渲裁剪用
  const LAND_PATH = new Path2D();
  for (const s of provinceShapes) LAND_PATH.addPath(s.path);

  /* ------------------------------------------------------------
     地形晕渲：0.25° 网格（CN_ELEV）→ 坡度坡向 → 西北光照 → 分档 Path2D
     世界坐标与视图无关，所以顶点投影和分档只算一次，换主题只换颜色
     ------------------------------------------------------------ */
  const HILL = (() => {
    if (!ELEV || !ELEV.data || !ELEV.nx) return null;
    const nx = ELEV.nx, ny = ELEV.ny;
    const z = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = elevRaw(i, j);
    const px = new Float32Array(nx * ny), py = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [wx, wy] = albers(ELEV.lon0 + i * ELEV.step, ELEV.lat0 + j * ELEV.step);
        px[j * nx + i] = wx; py[j * nx + i] = wy;
      }
    }
    return { nx, ny, z, px, py };
  })();

  const HILL_BANDS = 11;
  let hillBandIdx = null, hillTex = null, hillTexTheme = null;

  // 每格按坡度坡向算光照，落到 0..8 档（-1 = 海面，不画）
  function hillBandIndex() {
    if (hillBandIdx || !HILL) return hillBandIdx;
    const { nx, ny, z } = HILL;
    const idx = new Int8Array(nx * ny).fill(-1);
    const dLat = ELEV.step * 110574;
    const dLon = ELEV.step * 111320 * Math.cos(((ELEV.lat0 + (ny * ELEV.step) / 2) * Math.PI) / 180);
    const LX = -0.66, LY = -0.66, LZ = 0.86; // 光从西北上方来（y 轴向南为正）
    const lLen = Math.hypot(LX, LY, LZ);
    const EX = 7; // 垂直夸张
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const k = j * nx + i;
        if (z[k] < -20) continue;
        const dzdx = (z[k + 1] - z[k - 1]) / (2 * dLon);
        const dzdy = (z[k + nx] - z[k - nx]) / (2 * dLat);
        const ux = -dzdx * EX, uy = -dzdy * EX, uz = 1;
        const inv = 1 / Math.hypot(ux, uy, uz);
        const dot = ((ux * LX + uy * LY + uz * LZ) * inv) / lLen;
        // 平地（法线朝上）时 dot = LZ/|L| ≈ 0.665，作为中性档；坡面偏离越多，明暗差越大
        const u = (dot - 0.665) / 0.22;
        let b = 5 + Math.round(u * 5);
        idx[k] = b < 0 ? 0 : b > HILL_BANDS - 1 ? HILL_BANDS - 1 : b;
      }
    }
    hillBandIdx = idx;
    return idx;
  }

  // 把分档画进一张「世界坐标」纹理：只做一次（换主题时重建），之后每帧只是一次贴图
  function hillTexture() {
    const idx = hillBandIndex();
    if (!idx) return null;
    if (hillTex && hillTexTheme === state.theme) return hillTex;
    const { nx, ny, px, py } = HILL;
    const worldW = wb.x1 - wb.x0, worldH = wb.y1 - wb.y0;
    const TEX_W = 1800;
    const scale = TEX_W / worldW;
    const cw = Math.round(TEX_W), ch = Math.round(worldH * scale);
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const buckets = [];
    for (let b = 0; b < HILL_BANDS; b++) buckets.push([]);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const b = idx[j * nx + i];
        if (b < 0) continue;
        const k = j * nx + i;
        const x = (px[k] - wb.x0) * scale;
        const y = (py[k] - wb.y0) * scale;
        const w2 = Math.max(1.2, (px[k + 1] - px[k]) * scale) + 0.6;
        const h2 = Math.max(1.2, (py[k + nx] - py[k]) * scale) + 0.6;
        buckets[b].push(x, y, w2, h2);
      }
    }
    const dark = TH.hillDark || [8, 12, 16];
    const light = TH.hillLight || [220, 230, 240];
    const amp = TH.hillAlpha == null ? 0.8 : TH.hillAlpha;
    for (let b = 0; b < HILL_BANDS; b++) {
      const t = b / (HILL_BANDS - 1);
      const wgt = Math.abs(t - 0.5) * 2; // 中间档（平地）不着色
      if (wgt < 0.04) continue;
      const a = (Math.pow(wgt, 0.95) * amp).toFixed(3);
      const col = t < 0.5 ? dark : light;
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      const arr = buckets[b];
      for (let q = 0; q < arr.length; q += 4) g.fillRect(arr[q], arr[q + 1], arr[q + 2], arr[q + 3]);
    }
    hillTex = c;
    hillTexTheme = state.theme;
    return c;
  }

  function drawHillshade() {
    if (!state.layers.hill) return;
    const tex = hillTexture();
    if (!tex) return;
    ctx.save();
    ctx.clip(LAND_PATH);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, wb.x0, wb.y0, wb.x1 - wb.x0, wb.y1 - wb.y0);
    ctx.restore();
  }


  // 实际陆地外框（海南只取本岛，不含三沙群岛），用于铺满画布
  const landBBox = (() => {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of provinceShapes) {
      const bb = s.name === '海南省' ? geoBBox(108.4, 18.0, 111.2, 20.3) : s.bbox;
      b = [Math.min(b[0], bb[0]), Math.min(b[1], bb[1]), Math.max(b[2], bb[2]), Math.max(b[3], bb[3])];
    }
    return b;
  })();
  const nineDash = shapes.find((s) => s.kind === 'line');
  const shapeByName = Object.fromEntries(provinceShapes.map((s) => [s.name, s]));

  function geoBBox(w, s, e, n) {
    const pts = [albers(w, s), albers(w, n), albers(e, s), albers(e, n)];
    return [
      Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
      Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))
    ];
  }

  // 主视图取景：中国大陆 + 海南岛（南海诸岛用附图）
  const frame = geoBBox(73.4, 17.6, 135.3, 53.8);

