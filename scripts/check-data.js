#!/usr/bin/env node
/**
 * 数据体检：不依赖浏览器，直接加载 assets/*.js 里的 window.CN_CONTENT / window.CN_GEO，
 * 校验省份数量、面积与人口合计、七大区计数、题目答案、图形完整性。
 * 任何一条不满足 → 退出码 1（CI 会因此失败）。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
function load(file) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  new Function('window', code)(sandbox.window);
}

load('assets/content.js');
load('assets/geo.js');

const C = sandbox.window.CN_CONTENT;
const G = sandbox.window.CN_GEO;
const fails = [];
const warns = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

ok(!!C && !!G, 'content.js / geo.js 没有挂到 window 上');

const P = C.provinces || [];
const CLIMATE_IDS = new Set(Array.from(C.climates || []).map((c) => c.id));
ok(P.length === 34, `省级行政区应有 34 个，实际 ${P.length}`);

const REQUIRED = ['name', 'label', 'short', 'capital', 'coord', 'area', 'pop', 'region', 'step', 'climate', 'terrain', 'tags'];
const seen = new Set();
for (const p of P) {
  for (const k of REQUIRED) ok(p[k] !== undefined && p[k] !== null && p[k] !== '', `${p.name || '?'} 缺字段 ${k}`);
  ok(!seen.has(p.name), `省份重复：${p.name}`);
  seen.add(p.name);
  const [lon, lat] = p.coord || [];
  ok(lon > 73 && lon < 136 && lat > 3 && lat < 54, `${p.name} 的 coord 超出中国范围：${p.coord}`);
  ok(p.area > 0 && p.area < 200, `${p.name} 面积异常：${p.area}`);
  ok(p.pop > 0 && p.pop < 13000, `${p.name} 人口异常：${p.pop}`);
  ok(!!C.regions[p.region], `${p.name} 的 region「${p.region}」不在 regions 表里`);
  ok(!!C.steps[p.step - 1], `${p.name} 的 step「${p.step}」不在 steps 表里`);
  ok(CLIMATE_IDS.has(p.climate), `${p.name} 的 climate「${p.climate}」不在 climates 表里`);
}

const areaSum = P.reduce((a, p) => a + p.area, 0);
ok(Math.abs(areaSum - 968) < 30, `面积合计 ${areaSum.toFixed(0)} 万km²，偏离 968 太多`);

const popSum = P.reduce((a, p) => a + p.pop, 0);
ok(Math.abs(popSum - 144148) < 4000, `人口合计 ${popSum} 万，偏离七普 14.4 亿太多`);

const counts = {};
for (const p of P) counts[p.region] = (counts[p.region] || 0) + 1;
const expect = { 华北: 5, 东北: 3, 华东: 8, 华中: 3, 华南: 5, 西南: 5, 西北: 5 };
for (const k of Object.keys(expect)) {
  ok(counts[k] === expect[k], `七大区「${k}」应有 ${expect[k]} 个，实际 ${counts[k] || 0}`);
}

const facts = C.facts || [];
ok(facts.length >= 20, `题库只有 ${facts.length} 题`);
const qSeen = new Set();
for (const [i, f] of facts.entries()) {
  ok(typeof f.q === 'string' && f.q.length > 0, `第 ${i + 1} 题缺题干`);
  ok(Array.isArray(f.options) && f.options.length >= 2, `第 ${i + 1} 题选项不足`);
  ok(typeof f.a === 'string' && f.a.length > 0, `第 ${i + 1} 题缺正确答案字段 a`);
  ok(!f.options.includes(f.a), `第 ${i + 1} 题的答案不该出现在干扰项里`);
  ok(new Set(f.options).size === f.options.length, `第 ${i + 1} 题干扰项有重复`);
  ok(!qSeen.has(f.q), `题目重复：${f.q}`);
  qSeen.add(f.q);
  ok(typeof f.why === 'string' && f.why.length > 8, `第 ${i + 1} 题缺解析（why）`);
}

ok((C.rivers || []).length >= 5, '河流数据不足 5 条');
for (const r of C.rivers || []) {
  ok(Array.isArray(r.path) && r.path.length >= 2, `河流 ${r.name} 的 path 少于 2 个点`);
  ok(r.path.every(([lon, lat]) => lon > 70 && lon < 140 && lat > 15 && lat < 55), `河流 ${r.name} 的坐标越界`);
}
ok((C.mountains || []).length >= 15, '山脉数据不足 15 座');
for (const m of C.mountains || []) {
  const [lon, lat] = m.coord || [];
  ok(lon > 70 && lon < 140 && lat > 15 && lat < 55, `山脉 ${m.name} 的坐标越界`);
}
ok(Array.isArray(C.profile) && C.profile.length >= 60, '剖面采样点不足 60 个');
if (Array.isArray(C.profile)) {
  const lons = C.profile.map((p) => p[0]);
  const asc = lons.every((v, i) => i === 0 || v >= lons[i - 1]);
  const desc = lons.every((v, i) => i === 0 || v <= lons[i - 1]);
  ok(asc || desc, '剖面采样点没有按经度单调排列');
  ok(C.profile.every((p) => p[0] > 70 && p[0] < 140 && p[1] >= 0 && p[1] < 9000), '剖面采样点越界');
}

// 图形：34 个省 + 1 条九段线
const shapes = (G.features || []).filter((f) => f.kind === 'province');
ok(shapes.length === 34, `geo.js 里应有 34 个省级图形，实际 ${shapes.length}`);
for (const p of P) {
  const s = shapes.find((x) => x.name === p.name);
  ok(!!s, `geo.js 缺 ${p.name} 的图形`);
  if (s) ok(Array.isArray(s.polygons) && s.polygons.length > 0, `${p.name} 的图形没有多边形`);
}
const jd = (G.features || []).filter((f) => f.kind === 'line');
ok(jd.length === 1 && jd[0].polygons.length > 0, `geo.js 应有 1 条九段线，实际 ${jd.length}`);

const kb = (fs.statSync(path.join(root, 'assets/geo.js')).size / 1024).toFixed(0);
if (fails.length) {
  console.error(`✗ 数据体检失败（${fails.length} 项）`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✓ 数据体检通过：${P.length} 省 · 面积 ${areaSum.toFixed(0)} 万km² · 人口 ${popSum} 万 · ${facts.length} 道题 · ${(C.rivers || []).length} 条河 · ${(C.mountains || []).length} 座山 · geo ${kb}KB`);
if (warns.length) console.log(`  （提示 ${warns.length} 条：${warns.slice(0, 3).join('；')}${warns.length > 3 ? ' …' : ''}）`);
