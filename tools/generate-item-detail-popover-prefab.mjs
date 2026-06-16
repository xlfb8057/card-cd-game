/**
 * 生成 ItemDetailPopover.prefab（根节点 + ItemDetailPopover 组件）
 * UI 子节点由 ItemDetailPopover._ensureDefaultUi() 在运行时补全（与 DevGmPanel 同模式）
 *
 * 用法: node tools/generate-item-detail-popover-prefab.mjs
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PREFAB_UUID = 'e3c7a892-1f4d-4b6e-8c9a-0d2e4f6a8b1c';
const SCRIPT_UUID = '931ff255-e7be-4786-94e3-9c4b5aac2497';

const Base64KeyChars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function compressHex(hex, reserved) {
  let i = reserved;
  const head = hex.slice(0, reserved);
  const out = [];
  while (i < hex.length) {
    const h1 = parseInt(hex[i], 16);
    const h2 = parseInt(hex[i + 1], 16);
    const h3 = parseInt(hex[i + 2], 16);
    out.push(Base64KeyChars[(h1 << 2) | (h2 >> 2)]);
    out.push(Base64KeyChars[((h2 & 3) << 4) | h3]);
    i += 3;
  }
  return head + out.join('');
}

function compressUuid(uuid) {
  return compressHex(uuid.replace(/-/g, ''), 5);
}

function randomFileId() {
  return crypto.randomBytes(9).toString('base64url').slice(0, 22);
}

function buildMinimalPrefab(name, scriptUuid, width, height, scriptProps = {}) {
  const scriptType = compressUuid(scriptUuid);
  const entries = [];
  const push = (entry) => {
    entries.push(entry);
    return entries.length - 1;
  };

  const prefabIdx = push({
    __type__: 'cc.Prefab',
    _name: name,
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    data: { __id__: 1 },
    optimizationPolicy: 0,
    persistent: false,
  });

  const rootIdx = push({
    __type__: 'cc.Node',
    _name: name,
    _objFlags: 0,
    __editorExtras__: {},
    _parent: null,
    _children: [],
    _active: true,
    _components: [{ __id__: 2 }, { __id__: 4 }],
    _prefab: { __id__: 6 },
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
  });

  const utIdx = push({
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: rootIdx },
    _enabled: true,
    __prefab: { __id__: 3 },
    _contentSize: { __type__: 'cc.Size', width, height },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
  });

  push({ __type__: 'cc.CompPrefabInfo', fileId: randomFileId() });

  const scriptIdx = push({
    __type__: scriptType,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: rootIdx },
    _enabled: true,
    __prefab: { __id__: 5 },
    ...scriptProps,
    _id: '',
  });

  push({ __type__: 'cc.CompPrefabInfo', fileId: randomFileId() });

  push({
    __type__: 'cc.PrefabInfo',
    root: { __id__: rootIdx },
    asset: { __id__: prefabIdx },
    fileId: randomFileId(),
    instance: null,
    targetOverrides: null,
  });

  return { entries, scriptType, prefabIdx };
}

function writePrefab(relativePath, uuid, name, scriptUuid, width, height, scriptProps) {
  const outPath = path.join(ROOT, relativePath);
  const metaPath = `${outPath}.meta`;
  const { entries, scriptType } = buildMinimalPrefab(
    name,
    scriptUuid,
    width,
    height,
    scriptProps,
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf8');
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        ver: '1.1.50',
        importer: 'prefab',
        imported: true,
        uuid,
        files: ['.json'],
        subMetas: {},
        userData: { syncNodeName: name },
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`  wrote ${relativePath}`);
  console.log(`    uuid=${uuid} scriptType=${scriptType}`);
}

function main() {
  console.log('\n=== 生成 ItemDetailPopover / BuildSynergyPanel 预制体 ===\n');

  writePrefab(
    'assets/prefabs/ui/ItemDetailPopover.prefab',
    PREFAB_UUID,
    'ItemDetailPopover',
    SCRIPT_UUID,
    720,
    1280,
    {
      panelNode: null,
      nameLabel: null,
      rarityLabel: null,
      starLabel: null,
      modLabel: null,
      cdLabel: null,
      priceLabel: null,
      sellPriceLabel: null,
      affinityLabel: null,
      tagsLabel: null,
      effectsLabel: null,
      modEffectsLabel: null,
      mergeHintLabel: null,
      buildPreviewLabel: null,
      buildSynergyBtn: null,
      backdropNode: null,
    },
  );

  writePrefab(
    'assets/prefabs/ui/BuildSynergyPanel.prefab',
    'f1a2b3c4-d5e6-4789-a012-3456789abcde',
    'BuildSynergyPanel',
    'f264377d-4355-4db7-8dca-7df60f8ead94',
    300,
    400,
    {
      panelNode: null,
      titleLabel: null,
      contentLabel: null,
    },
  );

  console.log('\n完成。请在 Cocos 中打开预制体确认脚本引用；运行时 _ensureDefaultUi 会自动补全子节点。\n');
}

main();
