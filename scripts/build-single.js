#!/usr/bin/env node
/* 把 index.html + assets/* 打包成一个可单独分发的 HTML 文件 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');

html = html.replace(
  '<link rel="stylesheet" href="assets/styles.css" />',
  // 用函数做替换，避免 $$ / $& 被当成替换模式
  () => '<style>\n' + read('assets/styles.css') + '\n</style>'
);

for (const name of ['geo', 'content', 'app']) {
  html = html.replace(
    `<script src="assets/${name}.js"></script>`,
    () => `<script>\n${read(`assets/${name}.js`)}\n</script>`
  );
}

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'china-geo.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
