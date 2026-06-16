/**
 * 生成装备 UI 最简占位切图（白盒用）
 *
 * 用法（NewProject 目录）:
 *   npm run gen:item-display
 *
 * 输出: assets/resources/textures/item-display/
 * Cocos 首次打开项目后会自动为 PNG 生成 .meta；9-slice 请在编辑器中设 border=12（frame_* / popover_bg）
 */

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(
  __dirname,
  '../assets/resources/textures/item-display',
);

const RARITY_COLORS = {
  frame_common: '#4CAF50',
  frame_rare: '#2196F3',
  frame_epic: '#9C27B0',
  frame_legendary: '#FF9800',
};

const TAG_COLORS = {
  damage: '#E53935',
  dot: '#8E24AA',
  poison: '#7CB342',
  burn: '#FB8C00',
  shield: '#1E88E5',
  heal: '#43A047',
  haste: '#FDD835',
  tool: '#6D4C41',
  food: '#FF7043',
  crit: '#D81B60',
  scaling: '#5E35B1',
  control: '#546E7A',
  freeze: '#00ACC1',
};

function hexToRgba(hex, alpha = 255) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    alpha,
  ];
}

function createPng(width, height) {
  return new PNG({ width, height, filterType: -1 });
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const i = (png.width * y + x) << 2;
  png.data[i] = rgba[0];
  png.data[i + 1] = rgba[1];
  png.data[i + 2] = rgba[2];
  png.data[i + 3] = rgba[3];
}

function fillRect(png, x, y, w, h, rgba) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(png, px, py, rgba);
    }
  }
}

function strokeRect(png, x, y, w, h, rgba, thickness = 2) {
  fillRect(png, x, y, w, thickness, rgba);
  fillRect(png, x, y + h - thickness, w, thickness, rgba);
  fillRect(png, x, y, thickness, h, rgba);
  fillRect(png, x + w - thickness, y, thickness, h, rgba);
}

function drawNineSliceFrame(png, borderColor, inset = 12) {
  const [r, g, b] = hexToRgba(borderColor);
  fillRect(png, 0, 0, png.width, png.height, [r, g, b, 255]);
  fillRect(
    png,
    inset,
    inset,
    png.width - inset * 2,
    png.height - inset * 2,
    [32, 34, 40, 255],
  );
  // 内缘高光
  strokeRect(
    png,
    inset,
    inset,
    png.width - inset * 2,
    png.height - inset * 2,
    [255, 255, 255, 40],
    1,
  );
}

function drawDashedEmptySlot(png) {
  fillRect(png, 0, 0, png.width, png.height, [28, 30, 36, 255]);
  const dash = hexToRgba('#888888');
  for (let i = 0; i < png.width; i++) {
    if (i % 8 < 4) {
      setPixel(png, i, 0, dash);
      setPixel(png, i, png.height - 1, dash);
    }
  }
  for (let j = 0; j < png.height; j++) {
    if (j % 8 < 4) {
      setPixel(png, 0, j, dash);
      setPixel(png, png.width - 1, j, dash);
    }
  }
}

function drawLockedSlot(png) {
  fillRect(png, 0, 0, png.width, png.height, [22, 22, 26, 255]);
  strokeRect(png, 4, 4, png.width - 8, png.height - 8, [68, 68, 72, 255], 3);
  // 简易锁梁
  const c = hexToRgba('#AAAAAA');
  strokeRect(png, 40, 36, 32, 28, c, 4);
  fillRect(png, 46, 52, 20, 24, [22, 22, 26, 255]);
  fillRect(png, 38, 60, 36, 20, c);
}

function drawIconPlaceholder(png) {
  fillRect(png, 0, 0, png.width, png.height, [48, 52, 60, 255]);
  strokeRect(png, 8, 8, png.width - 16, png.height - 16, [90, 96, 108, 255], 2);
  // 问号区域（两矩形模拟）
  fillRect(png, 42, 28, 12, 36, [180, 185, 195, 255]);
  fillRect(png, 40, 68, 16, 12, [180, 185, 195, 255]);
}

function drawCdOverlay(png) {
  fillRect(png, 0, 0, png.width, png.height, [0, 0, 0, 160]);
}

function drawCdMaxBadge(png) {
  fillRect(png, 0, 0, png.width, png.height, hexToRgba('#D32F2F'));
  // 白色 "M" 形简易标记
  fillRect(png, 4, 4, 3, 8, [255, 255, 255, 255]);
  fillRect(png, 10, 4, 3, 8, [255, 255, 255, 255]);
  fillRect(png, 16, 4, 3, 8, [255, 255, 255, 255]);
  fillRect(png, 7, 6, 3, 3, [255, 255, 255, 255]);
  fillRect(png, 13, 6, 3, 3, [255, 255, 255, 255]);
}

function drawSynergyPulse(png) {
  fillRect(png, 0, 0, png.width, png.height, [0, 0, 0, 0]);
  strokeRect(png, 4, 4, png.width - 8, png.height - 8, hexToRgba('#00BCD4', 220), 4);
}

function drawPopoverBg(png, inset = 16) {
  fillRect(png, 0, 0, png.width, png.height, [45, 48, 58, 245]);
  strokeRect(png, 0, 0, png.width, png.height, [100, 108, 128, 255], 2);
  fillRect(
    png,
    inset,
    inset,
    png.width - inset * 2,
    png.height - inset * 2,
    [36, 38, 46, 255],
  );
}

function drawTagIcon(png, color) {
  fillRect(png, 0, 0, png.width, png.height, [0, 0, 0, 0]);
  const c = hexToRgba(color);
  // 圆角方块
  fillRect(png, 2, 2, png.width - 4, png.height - 4, c);
  fillRect(png, 4, 4, png.width - 8, png.height - 8, [
    Math.min(c[0] + 30, 255),
    Math.min(c[1] + 30, 255),
    Math.min(c[2] + 30, 255),
    255,
  ]);
}

function drawModCardBg(png) {
  fillRect(png, 0, 0, png.width, png.height, [38, 42, 52, 255]);
  strokeRect(png, 0, 0, png.width, png.height, [80, 88, 104, 255], 2);
}

function drawModTierBadge(png, _label, color) {
  fillRect(png, 0, 0, png.width, png.height, hexToRgba(color));
  // 简单色条区分层级，文字由 UI Label 显示
  fillRect(png, 2, png.height - 6, png.width - 4, 4, [255, 255, 255, 80]);
}

function writePng(png, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`  wrote ${path.relative(OUT_ROOT, filePath)}`);
}

function main() {
  console.log('\n=== 生成 item-display 占位切图 ===\n');

  // 品质框 120×120，9-slice inset=12
  for (const [name, color] of Object.entries(RARITY_COLORS)) {
    const png = createPng(120, 120);
    drawNineSliceFrame(png, color, 12);
    writePng(png, path.join(OUT_ROOT, 'frames', `${name}.png`));
  }

  const slotEmpty = createPng(112, 112);
  drawDashedEmptySlot(slotEmpty);
  writePng(slotEmpty, path.join(OUT_ROOT, 'frames', 'slot_empty.png'));

  const slotLocked = createPng(112, 112);
  drawLockedSlot(slotLocked);
  writePng(slotLocked, path.join(OUT_ROOT, 'frames', 'slot_locked.png'));

  const iconPh = createPng(96, 96);
  drawIconPlaceholder(iconPh);
  writePng(iconPh, path.join(OUT_ROOT, 'frames', 'icon_placeholder.png'));

  const itemCardBg = createPng(112, 112);
  fillRect(itemCardBg, 0, 0, 112, 112, [30, 32, 38, 255]);
  writePng(itemCardBg, path.join(OUT_ROOT, 'frames', 'item_card_bg.png'));

  const cdOverlay = createPng(112, 112);
  drawCdOverlay(cdOverlay);
  writePng(cdOverlay, path.join(OUT_ROOT, 'overlays', 'cd_overlay_bar.png'));

  const cdParticle = createPng(16, 16);
  fillRect(cdParticle, 4, 4, 8, 8, [255, 213, 79, 255]);
  writePng(cdParticle, path.join(OUT_ROOT, 'overlays', 'cd_ready_particle.png'));

  const cdMax = createPng(32, 16);
  drawCdMaxBadge(cdMax);
  writePng(cdMax, path.join(OUT_ROOT, 'overlays', 'cd_max_badge.png'));

  const synergy = createPng(128, 128);
  drawSynergyPulse(synergy);
  writePng(synergy, path.join(OUT_ROOT, 'overlays', 'synergy_pulse_frame.png'));

  const popover = createPng(280, 200);
  drawPopoverBg(popover, 16);
  writePng(popover, path.join(OUT_ROOT, 'popover', 'popover_bg.png'));

  const popArrow = createPng(16, 8);
  fillRect(popArrow, 0, 0, 16, 8, [45, 48, 58, 255]);
  writePng(popArrow, path.join(OUT_ROOT, 'popover', 'popover_arrow.png'));

  for (const [tag, color] of Object.entries(TAG_COLORS)) {
    const tagPng = createPng(24, 24);
    drawTagIcon(tagPng, color);
    writePng(tagPng, path.join(OUT_ROOT, 'tags', `tag_${tag}.png`));
  }

  const modBg = createPng(200, 120);
  drawModCardBg(modBg);
  writePng(modBg, path.join(OUT_ROOT, 'mod', 'mod_card_bg.png'));

  for (const [name, color] of [
    ['mod_tier_attribute', '#78909C'],
    ['mod_tier_mechanism', '#5C6BC0'],
    ['mod_tier_archetype', '#FFB300'],
  ]) {
    const tier = createPng(48, 20);
    drawModTierBadge(tier, name, color);
    writePng(tier, path.join(OUT_ROOT, 'mod', `${name}.png`));
  }

  // 装备图标占位（统一灰图，后续替换正式美术）
  const itemsJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../assets/resources/config/items.json'),
      'utf-8',
    ),
  );
  for (const item of itemsJson.items ?? []) {
    const icon = createPng(96, 96);
    const rarityKey = item.rarity ?? 'common';
    const frameColor =
      RARITY_COLORS[`frame_${rarityKey}`] ?? RARITY_COLORS.frame_common;
    fillRect(icon, 0, 0, 96, 96, [40, 42, 48, 255]);
    strokeRect(icon, 4, 4, 88, 88, hexToRgba(frameColor), 3);
    fillRect(icon, 20, 30, 56, 36, hexToRgba(frameColor, 120));
    writePng(
      icon,
      path.join(OUT_ROOT, '..', 'items', `${item.id}.png`),
    );
  }

  console.log('\n完成。请在 Cocos 中为 frame_* / popover_bg 设置 9-slice: inset 12（popover 16）。\n');

  const sliceConfig = {
    note: 'Cocos 编辑器选中图片 → Sprite 组件 → 勾选 Slice → 设置 Border',
    frames: {
      'frames/frame_common.png': { width: 120, height: 120, border: 12 },
      'frames/frame_rare.png': { width: 120, height: 120, border: 12 },
      'frames/frame_epic.png': { width: 120, height: 120, border: 12 },
      'frames/frame_legendary.png': { width: 120, height: 120, border: 12 },
      'popover/popover_bg.png': { width: 280, height: 200, border: 16 },
    },
  };
  fs.writeFileSync(
    path.join(OUT_ROOT, 'slice-config.json'),
    JSON.stringify(sliceConfig, null, 2),
  );
}

main();
