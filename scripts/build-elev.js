#!/usr/bin/env node
/* 生成 assets/elev.js：0.25° 中国海拔网格（ETOPO1 采样，OpenTopoData） */
const fs = require('fs');
const path = require('path');

const LON0 = 70, LAT0 = 16, STEP = 0.25, LON1 = 136, LAT1 = 56;
const nx = Math.round((LON1 - LON0) / STEP) + 1;
const ny = Math.round((LAT1 - LAT0) / STEP) + 1;
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
const UNIT = 20;        // 每格 20 m
const MIN = -50, MAX = 442; // 对应 -1000 m ~ 8840 m

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(points) {
  const loc = points.map(([lon, lat]) => `${lat},${lon}`).join('|');
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.opentopodata.org/v1/etopo1?locations=${loc}`);
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.status !== 'OK') { await sleep(2000); continue; }
    return j.results.map((r) => (r.elevation == null ? 0 : r.elevation));
  }
  throw new Error('batch failed');
}

(async () => {
  const grid = [];
  for (let j = 0; j < ny; j++) grid.push(new Array(nx).fill(0));
  const batch = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) batch.push([j, i, LON0 + i * STEP, LAT0 + j * STEP]);
  }
  let done = 0;
  for (let p = 0; p < batch.length; p += 100) {
    const chunk = batch.slice(p, p + 100);
    const vals = await fetchBatch(chunk.map((c) => [c[2], c[3]]));
    chunk.forEach((c, k) => { grid[c[0]][c[1]] = vals[k]; });
    done += chunk.length;
    if ((p / 100) % 10 === 0) process.stdout.write(`  ${done}/${batch.length}\r`);
    await sleep(1100);
  }
  // 编码：每点 2 字符，值 = clamp(round(e/20), -50, 442) + 50
  let data = '';
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const e = grid[j][i];
      if (e < min) min = e;
      if (e > max) max = e;
      let v = Math.round(e / UNIT);
      v = Math.max(MIN, Math.min(MAX, v)) + 50;
      data += ALPHA[v >> 6] + ALPHA[v & 63];
    }
  }
  const out = `/* 中国 0.5° 海拔网格（ETOPO1 · OpenTopoData 采样，单位 ${UNIT} m）*/window.CN_ELEV=${JSON.stringify({
    lon0: LON0, lat0: LAT0, step: STEP, nx, ny, unit: UNIT, data
  })};\n`;
  const dest = path.join(__dirname, '..', 'assets', 'elev.js');
  fs.writeFileSync(dest, out);
  console.log(`\nwrote ${dest} (${(out.length / 1024).toFixed(1)} KB) grid ${nx}x${ny} · 原始范围 ${min.toFixed(0)}–${max.toFixed(0)} m`);
})();
