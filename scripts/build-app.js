#!/usr/bin/env node
/* 把 src/*.js 按文件名顺序拼成 assets/app.js。
 * 之所以要这一层：整个应用是**一个 IIFE**，13 个分片共享同一作用域（state / ctx / W / H / TH…），
 * 所以不能改写成 ES module——那样要给每个函数传上下文，回归风险远大于收益。
 * 拼接是逐字节可复现的：只要不改动 src 里的任何字符，产物就与上一版完全一致。
 * 用法：node scripts/build-app.js [--check]
 *   --check 只校验产物是否最新（CI 用），不一致就非零退出。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const outFile = path.join(root, 'assets', 'app.js');

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
if (!files.length) { console.error('✗ src/ 里没有 .js 分片'); process.exit(1); }

const parts = files.map((f) => {
  const code = fs.readFileSync(path.join(srcDir, f), 'utf8');
  if (!code.includes('use strict')) return code; // 分片内容原样拼接
  return code;
});
const out = parts.join('');

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (cur !== out) {
    console.error(`✗ assets/app.js 与 src/ 不一致，请跑 node scripts/build-app.js`);
    process.exit(1);
  }
  console.log(`✓ app.js 与 src/ 一致（${files.length} 个分片，${(out.length / 1024).toFixed(0)} KB）`);
  process.exit(0);
}

fs.writeFileSync(outFile, out);
console.log(`wrote ${path.relative(root, outFile)}（${files.length} 个分片：${files.join(', ')}，${(out.length / 1024).toFixed(0)} KB）`);
