// Convert the DataV China GeoJSON into a compact browser asset.
// - coordinates rounded to 3 decimals (~110 m), duplicate consecutive points removed
// - keeps name, adcode, centroid and the nine-dash line feature
const fs = require('fs');
const src = process.argv[2] || '/tmp/cn_datav.json';
const out = process.argv[3] || __dirname + '/../assets/geo.js';

const raw = JSON.parse(fs.readFileSync(src, 'utf8'));

const round = (n) => Math.round(n * 1000) / 1000;
function simplifyRing(ring) {
  const r = [];
  for (const [x, y] of ring) {
    const px = round(x), py = round(y);
    const last = r[r.length - 1];
    if (last && Math.abs(last[0] - px) < 1e-9 && Math.abs(last[1] - py) < 1e-9) continue;
    r.push([px, py]);
  }
  if (r.length >= 4) {
    const a = r[0], b = r[r.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) r.pop();
  }
  return r.length >= 4 ? r : null;
}

const features = [];
for (const f of raw.features) {
  const p = f.properties || {};
  const isNineDash = p.adcode === '100000_JD' || !p.name;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const outPolys = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      const s = simplifyRing(ring);
      if (s) rings.push(s);
    }
    if (rings.length) outPolys.push(rings);
  }
  const feat = {
    name: isNineDash ? '九段线' : p.name,
    adcode: p.adcode,
    kind: isNineDash ? 'line' : 'province',
    polygons: outPolys,
  };
  if (p.centroid) feat.centroid = [round(p.centroid[0]), round(p.centroid[1])];
  else if (p.center) feat.centroid = [round(p.center[0]), round(p.center[1])];
  features.push(feat);
}

const payload = { features };
const js = 'window.CN_GEO=' + JSON.stringify(payload) + ';\n';
fs.writeFileSync(out, js);
console.log('features', features.length, 'bytes', Buffer.byteLength(js));
