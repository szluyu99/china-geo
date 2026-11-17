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

ok((C.rivers || []).length >= 13, '河流数据不足 13 条');
for (const r of C.rivers || []) {
  ok(Array.isArray(r.path) && r.path.length >= 4, `河流 ${r.name} 的 path 少于 4 个点`);
  ok(r.path.every(([lon, lat]) => lon > 70 && lon < 140 && lat > 15 && lat < 55), `河流 ${r.name} 的坐标越界`);
  ok(/km/.test(r.length || ''), `河流 ${r.name} 缺少长度口径（要含 km，纵剖面用它算坡降）`);
  ok(typeof r.note === 'string' && r.note.length > 12, `河流 ${r.name} 缺说明`);
  // 控制点不得重复相邻（会让纵剖面的 haversine 出现 0 段）
  for (let i = 1; i < r.path.length; i += 1) {
    ok(r.path[i][0] !== r.path[i - 1][0] || r.path[i][1] !== r.path[i - 1][1],
      `河流 ${r.name} 的第 ${i} 个控制点与上一点重合`);
  }
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

// 城市 / 农业 / 拼音
const cities = C.cities || [];
ok(cities.length >= 40, `城市点不足 40 个，实际 ${cities.length}`);
for (const c of cities) {
  ok(!!c.name && !!c.prov, '城市点缺少 name/prov');
  ok(Array.isArray(c.coord) && c.coord[0] > 70 && c.coord[0] < 140 && c.coord[1] > 15 && c.coord[1] < 55, `城市 ${c.name} 的坐标越界`);
  ok(P.some((p) => p.short === c.prov || p.name.startsWith(c.prov)), `城市 ${c.name} 所属省份不存在：${c.prov}`);
}
const crops = C.crops || [];
ok(crops.length === 7, `作物应为 7 种，实际 ${crops.length}`);
for (const c of crops) {
  ok(/^#[0-9a-f]{6}$/i.test(c.color), `作物 ${c.name} 的颜色不是 hex`);
  ok(Array.isArray(c.provinces) && c.provinces.length > 0, `作物 ${c.name} 没有关联省份`);
  for (const n of c.provinces) ok(P.some((p) => p.name === n), `作物 ${c.name} 关联了不存在的省份 ${n}`);
}
for (const p of P) {
  ok(Array.isArray(p.capCoord) && p.capCoord[0] > 70 && p.capCoord[0] < 140, `${p.name} 缺少 capCoord`);
  ok(typeof p.py === 'string' && p.py.length >= 4, `${p.name} 缺少拼音`);
}
ok(C.agriLine && Array.isArray(C.agriLine.path) && C.agriLine.path.length >= 5, 'agriLine 折线缺失');

// 气温站点与等温线
const sts = C.stations || [];
ok(sts.length >= 30, `气温站点太少：${sts.length}`);
for (const st of sts) {
  ok(!!st.name && typeof st.lon === 'number' && typeof st.lat === 'number', `站点字段不全：${JSON.stringify(st)}`);
  ok(st.lon > 73 && st.lon < 136 && st.lat > 17 && st.lat < 54, `站点坐标越界：${st.name}`);
  ok(st.jan > -30 && st.jan < 25, `1 月气温异常：${st.name} ${st.jan}`);
  ok(st.jul > 5 && st.jul < 33, `7 月气温异常：${st.name} ${st.jul}`);
  ok(st.jul > st.jan, `7 月气温不高于 1 月：${st.name}`);
}
for (const m of ['jan', 'jul']) {
  const lv = (C.isoLevels || {})[m];
  ok(Array.isArray(lv) && lv.length >= 4, `等温线取值缺失：${m}`);
  for (let i = 1; i < lv.length; i++) ok(lv[i] > lv[i - 1], `等温线取值未递增：${m}`);
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

// 海拔网格
const EL = {};
try {
  new Function('window', fs.readFileSync(path.join(root, 'assets/elev.js'), 'utf8'))(EL);
} catch (e) {
  fails.push('elev.js 无法执行：' + e.message);
}
const E = EL.CN_ELEV;
if (!E || !E.data) {
  fails.push('elev.js 缺少 CN_ELEV 数据');
} else {
  ok(E.nx * E.ny * 2 === E.data.length, `海拔网格长度不符：${E.data.length} ≠ ${E.nx * E.ny * 2}`);
  const AL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
  let bad = 0;
  for (const ch of E.data) if (AL.indexOf(ch) < 0) bad++;
  ok(bad === 0, `海拔网格有 ${bad} 个非法字符`);
  const at = (lon, lat) => {
    const i = Math.round((lon - E.lon0) / E.step), j = Math.round((lat - E.lat0) / E.step);
    if (i < 0 || j < 0 || i >= E.nx || j >= E.ny) return null;
    const o = (j * E.nx + i) * 2;
    return (AL.indexOf(E.data[o]) * 64 + AL.indexOf(E.data[o + 1]) - 50) * (E.unit || 20);
  };
  const cases = [['北京', 116.4, 39.9, -50, 300], ['拉萨', 91.1, 29.65, 3000, 4800], ['成都', 104.07, 30.57, 300, 900], ['吐鲁番', 89.2, 42.9, -400, 600], ['上海', 121.47, 31.23, -50, 200]];
  for (const [n, lo, la, lo2, hi2] of cases) {
    const v = at(lo, la);
    ok(v !== null && v >= lo2 && v <= hi2, `海拔网格在${n}处异常：${v}（期望 ${lo2}–${hi2}）`);
  }
}

// ---- 降水站点与等值线 ----
{
  const ps = C.precipStations || [];
  ok(ps.length >= 30, `降水站点偏少：${ps.length}（应 ≥30）`);
  for (const st of ps) {
    ok(typeof st.name === 'string' && !!st.name, '降水站点缺 name');
    ok(Number.isFinite(st.lon) && st.lon > 73 && st.lon < 136, `降水站点经度越界：${st.name} ${st.lon}`);
    ok(Number.isFinite(st.lat) && st.lat > 17 && st.lat < 54, `降水站点纬度越界：${st.name} ${st.lat}`);
    ok(Number.isFinite(st.mm) && st.mm > 0, `降水站点缺年降水量：${st.name}`);
  }
  const pl = C.precipLevels || [];
  ok(pl.length === 4 && pl[0] === 200 && pl.includes(400) && pl.includes(800), `降水等值线取值不对：${pl.join(',')}`);
  const mm = ps.map((x) => x.mm);
  ok(Math.min(...mm) < 100, '缺少干旱区降水站（应有 <100mm 的站）');
  ok(Math.max(...mm) > 1600, '缺少强湿润区降水站（应有 >1600mm 的站）');
  // 经度跨度要够，否则等值线画不出全国尺度
  ok(Math.max(...ps.map((x) => x.lon)) - Math.min(...ps.map((x) => x.lon)) > 40, '降水站点经度跨度不足');
}

// 十年人口变化（2010 六普 → 2020 七普）：31 省应有基准值，合计要接近 13.33 亿
const popBase = P.filter((p) => Number.isFinite(p.pop2010));
ok(popBase.length === 31, `应有 31 个省带 2010 年人口，实际 ${popBase.length}（港澳台无六普数据，属正常）`);
const baseSum = popBase.reduce((a, p) => a + p.pop2010, 0);
ok(baseSum > 133000 && baseSum < 133500, `六普 31 省合计应约 13.33 亿（万），实际 ${baseSum.toFixed(2)}`);
ok(P.filter((p) => p.name === '北京市').every((p) => Math.abs(p.pop2010 - 1961.24) < 0.01), '北京市六普人口应为 1961.24 万');
// 有增减也要能算，且极值不能离谱（防止百分比写错放大几百倍）
for (const p of popBase) {
  const pct = (p.pop / p.pop2010 - 1) * 100;
  ok(Number.isFinite(pct) && pct > -30 && pct < 40, `${p.name} 十年人口变化异常：${pct.toFixed(1)}%`);
}
const grow = popBase.filter((p) => p.pop > p.pop2010).length;
ok(grow >= 15 && grow <= 25, `十年人口增长省份数异常：${grow}（31 省中）`);

// 交通：铁路干线、枢纽、港口
const rails = C.railLines || [];
ok(rails.length >= 14, `铁路干线偏少：${rails.length}（应 ≥14）`);
ok(C.railKind && C.railKind.hsd && C.railKind.conv, '铁路类型 railKind 缺 hsd/conv');
for (const l of rails) {
  ok(typeof l.name === 'string' && !!l.name, '铁路缺 name');
  ok(!!C.railKind[l.kind], `铁路类型未知：${l.name} ${l.kind}`);
  ok(Array.isArray(l.path) && l.path.length >= 4, `铁路控制点太少：${l.name}（${(l.path || []).length}，应 ≥4）`);
  for (const pt of l.path) {
    ok(Number.isFinite(pt[0]) && pt[0] > 73 && pt[0] < 136, `铁路经度越界：${l.name} ${pt[0]}`);
    ok(Number.isFinite(pt[1]) && pt[1] > 17 && pt[1] < 54, `铁路纬度越界：${l.name} ${pt[1]}`);
  }
  for (let i = 1; i < l.path.length; i++) {
    ok(l.path[i][0] !== l.path[i - 1][0] || l.path[i][1] !== l.path[i - 1][1], `铁路控制点重复：${l.name} 第 ${i} 段`);
  }
}
const hubs = C.railHubs || [];
ok(hubs.length >= 8, `铁路枢纽偏少：${hubs.length}`);
const ports = C.ports || [];
ok(ports.length >= 10, `沿海港口偏少：${ports.length}`);
for (const p of ports) {
  ok(Number.isFinite(p.lon) && p.lon > 108 && p.lon < 135, `港口经度越界：${p.name} ${p.lon}`);
  ok(Number.isFinite(p.lat) && p.lat > 17 && p.lat < 42, `港口纬度越界：${p.name} ${p.lat}`);
}
const nHsd = rails.filter((l) => l.kind === 'hsd').length;
ok(nHsd >= 8 && nHsd <= 11, `高速铁路条数异常：${nHsd}`);

// 能源：基地与通道
const bases = C.energyBases || [];
ok(bases.length >= 28, `能源基地偏少：${bases.length}（应 ≥28）`);
ok(C.energyType && Object.keys(C.energyType).length >= 6, '能源类型 energyType 应 ≥6 类');
for (const b of bases) {
  ok(!!C.energyType[b.type], `能源类型未知：${b.name} ${b.type}`);
  ok(Number.isFinite(b.lon) && b.lon > 73 && b.lon < 136, `能源基地经度越界：${b.name} ${b.lon}`);
  ok(Number.isFinite(b.lat) && b.lat > 17 && b.lat < 54, `能源基地纬度越界：${b.name} ${b.lat}`);
  ok(typeof b.note === 'string' && b.note.length > 4, `能源基地缺说明：${b.name}`);
}
const routes = C.energyRoutes || [];
ok(routes.length >= 5, `能源通道偏少：${routes.length}`);
ok(C.channelKind && C.channelKind.power && C.channelKind.gas, '通道类型 channelKind 缺 power/gas');
for (const r of routes) {
  ok(!!C.channelKind[r.kind], `通道类型未知：${r.name} ${r.kind}`);
  ok(Array.isArray(r.path) && r.path.length >= 3, `通道控制点太少：${r.name}`);
}
for (const t of Object.keys(C.energyType || {})) {
  ok(bases.some((b) => b.type === t), `能源类型没有实例：${t}`);
}

const kb = (fs.statSync(path.join(root, 'assets/geo.js')).size / 1024).toFixed(0);
if (fails.length) {
  console.error(`✗ 数据体检失败（${fails.length} 项）`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✓ 数据体检通过：${P.length} 省 · 面积 ${areaSum.toFixed(0)} 万km² · 人口 ${popSum} 万 · 六普 ${baseSum.toFixed(0)} 万 · ${facts.length} 道题 · ${(C.rivers || []).length} 条河 · ${(C.mountains || []).length} 座山 · ${(C.railLines || []).length} 条铁路 · ${(C.energyBases || []).length} 个能源基地 · geo ${kb}KB`);
if (warns.length) console.log(`  （提示 ${warns.length} 条：${warns.slice(0, 3).join('；')}${warns.length > 3 ? ' …' : ''}）`);
