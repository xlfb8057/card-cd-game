/**
 * 修复 ItemCardWidget.prefab 关键挂接问题
 */

import fs from 'fs';
import path from 'path';

const PREFAB = path.resolve('assets/prefabs/ui/ItemCardWidget.prefab');
const TAG_SPRITE_UUID = 'e8f1b435-08fc-4dbd-b0ed-a4ffaf30d6f8@f9941';

const p = JSON.parse(fs.readFileSync(PREFAB, 'utf8'));

function idxByName(name) {
  const i = p.findIndex((x) => x._name === name);
  if (i < 0) throw new Error(`Node not found: ${name}`);
  return i;
}

function pushEntry(entry) {
  p.push(entry);
  return p.length - 1;
}

// 1. CdReadyEffect + controller
const cdReadyIdx = idxByName('CdMaxBadge');
p[cdReadyIdx]._name = 'CdReadyEffect';
p[cdReadyIdx]._active = false;

const ctrlIdx = p.findIndex((x) => x.__type__ === '61b0dJvk0VCg7izqPFbcOCD');
if (ctrlIdx < 0) throw new Error('CdMaxPulseController missing');
p[ctrlIdx].node = { __id__: cdReadyIdx };
if (!p[cdReadyIdx]._components.some((c) => c.__id__ === ctrlIdx)) {
  p[cdReadyIdx]._components.push({ __id__: ctrlIdx });
}

// 2. ItemCardWidget
const widgetIdx = p.findIndex((x) => x.__type__?.includes('14810'));
if (widgetIdx < 0) throw new Error('ItemCardWidget missing');
p[widgetIdx].cdReadyEffect = { __id__: cdReadyIdx };
p[widgetIdx].cdReadyEffectCtrl = { __id__: ctrlIdx };
delete p[widgetIdx].cdMaxBadge;
delete p[widgetIdx].cdMaxPulse;

// 3. TagIconStrip — TagContainer + 4 个 TagIcon Sprite
const stripIdx = idxByName('TagIconStrip');
p[stripIdx]._children = [];
p[stripIdx]._lpos = { __type__: 'cc.Vec3', x: 52, y: -52, z: 0 };

const containerIdx = pushEntry({
  __type__: 'cc.Node',
  _name: 'TagContainer',
  _objFlags: 0,
  _parent: { __id__: stripIdx },
  _children: [],
  _active: true,
  _components: [],
  _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
  _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
  _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
  _mobility: 0,
  _layer: 1073741824,
  _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
  _id: '',
});

const containerUtIdx = pushEntry({
  __type__: 'cc.UITransform',
  _name: '',
  node: { __id__: containerIdx },
  _enabled: true,
  _contentSize: { __type__: 'cc.Size', width: 120, height: 24 },
  _anchorPoint: { __type__: 'cc.Vec2', x: 1, y: 0 },
  _id: '',
});
p[containerIdx]._components.push({ __id__: containerUtIdx });

const iconSpriteIdxs = [];
const xs = [0, -26, -52, -78];
for (let i = 0; i < 4; i++) {
  const nodeIdx = pushEntry({
    __type__: 'cc.Node',
    _name: `TagIcon_${i}`,
    _objFlags: 0,
    _parent: { __id__: containerIdx },
    _children: [],
    _active: true,
    _components: [],
    _lpos: { __type__: 'cc.Vec3', x: xs[i], y: 12, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 1073741824,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
  });
  p[containerIdx]._children.push({ __id__: nodeIdx });

  const utIdx = pushEntry({
    __type__: 'cc.UITransform',
    _name: '',
    node: { __id__: nodeIdx },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 24, height: 24 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
  });
  const spIdx = pushEntry({
    __type__: 'cc.Sprite',
    _name: '',
    node: { __id__: nodeIdx },
    _enabled: true,
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    _spriteFrame: {
      __uuid__: TAG_SPRITE_UUID,
      __expectedType__: 'cc.SpriteFrame',
    },
    _type: 0,
    _fillType: 0,
    _sizeMode: 0,
    _id: '',
  });
  p[nodeIdx]._components.push({ __id__: utIdx }, { __id__: spIdx });
  iconSpriteIdxs.push(spIdx);
}

p[stripIdx]._children.push({ __id__: containerIdx });

const stripCompIdx = p.findIndex((x) => x.__type__ === '19e07hD8u1NuY8ad2711OKF');
if (stripCompIdx >= 0) {
  p[stripCompIdx].tagIconContainer = { __id__: containerIdx };
  p[stripCompIdx].tagIcons = iconSpriteIdxs.map((id) => ({ __id__: id }));
  p[stripCompIdx].container = null;
  p[stripCompIdx].fallbackLabel = null;
}

fs.writeFileSync(PREFAB, JSON.stringify(p, null, 2), 'utf8');
console.log('OK patched prefab');
console.log('  cdReadyEffect:', cdReadyIdx, 'ctrl:', ctrlIdx);
console.log('  tagIcons:', iconSpriteIdxs);
