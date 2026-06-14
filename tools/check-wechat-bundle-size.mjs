#!/usr/bin/env node
/**
 * 检查微信小游戏构建产物首包 / 分包大小
 * 用法: node tools/check-wechat-bundle-size.mjs [build/wechatgame 目录]
 */

import fs from 'fs';
import path from 'path';

const MAIN_PKG_LIMIT = 4 * 1024 * 1024;
const TOTAL_PKG_LIMIT = 20 * 1024 * 1024;

const buildDir = path.resolve(
  process.argv[2] ?? path.join(process.cwd(), 'build', 'wechatgame'),
);

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function walkFiles(dir, list = []) {
  if (!fs.existsSync(dir)) {
    return list;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, list);
    } else {
      list.push({ full, size: stat.size, rel: path.relative(buildDir, full) });
    }
  }
  return list;
}

function sumDir(dir) {
  return walkFiles(dir).reduce((s, f) => s + f.size, 0);
}

if (!fs.existsSync(buildDir)) {
  console.error(`[ERROR] 构建目录不存在: ${buildDir}`);
  console.error('请先在 Cocos 中构建微信小游戏，或传入路径:');
  console.error('  node tools/check-wechat-bundle-size.mjs build/wechatgame');
  process.exit(1);
}

const subpackagesDir = path.join(buildDir, 'subpackages');
const subpackageNames = fs.existsSync(subpackagesDir)
  ? fs.readdirSync(subpackagesDir).filter((n) =>
      fs.statSync(path.join(subpackagesDir, n)).isDirectory(),
    )
  : [];

let mainSize = sumDir(buildDir);
for (const name of subpackageNames) {
  mainSize -= sumDir(path.join(subpackagesDir, name));
}

let subTotal = 0;
console.log('\n=== 微信小游戏包体检查 ===');
console.log(`目录: ${buildDir}\n`);

console.log(`主包: ${formatSize(mainSize)} (限制 < 4 MB) ${mainSize <= MAIN_PKG_LIMIT ? '✅' : '❌ 超限'}`);

for (const name of subpackageNames) {
  const size = sumDir(path.join(subpackagesDir, name));
  subTotal += size;
  console.log(`分包 [${name}]: ${formatSize(size)}`);
}

const total = mainSize + subTotal;
console.log(`\n合计: ${formatSize(total)} (限制 < 20 MB) ${total <= TOTAL_PKG_LIMIT ? '✅' : '❌ 超限'}`);

const allFiles = walkFiles(buildDir)
  .sort((a, b) => b.size - a.size)
  .slice(0, 15);

console.log('\n--- 主包内最大的 15 个文件 ---');
for (const f of allFiles) {
  if (f.rel.startsWith(`subpackages${path.sep}`)) {
    continue;
  }
  console.log(`${formatSize(f.size).padStart(10)}  ${f.rel.replace(/\\/g, '/')}`);
}

console.log('');
process.exit(mainSize <= MAIN_PKG_LIMIT && total <= TOTAL_PKG_LIMIT ? 0 : 1);
