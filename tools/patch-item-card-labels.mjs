/**
 * 为 ItemCardWidget.prefab 增加技能名 / CD 倒计时 Label
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFAB = path.resolve(__dirname, '../assets/prefabs/ui/ItemCardWidget.prefab');

const p = JSON.parse(fs.readFileSync(PREFAB, 'utf8'));

function idxByName(name) {
  const i = p.findIndex((x) => x._name === name);
  if (i < 0) {
    throw new Error(`Node not found: ${name}`);
  }
  return i;
}

function pushEntry(entry) {
  p.push(entry);
  return p.length - 1;
}

function addLabelNode(name, parentIdx, lpos, fontSize = 18) {
  const nodeIdx = pushEntry({
    __type__: 'cc.Node',
    _name: name,
    _objFlags: 0,
    _parent: { __id__: parentIdx },
    _children: [],
    _active: true,
    _components: [],
    _lpos: { __type__: 'cc.Vec3', ...lpos, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 1073741824,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
  });

  const utIdx = pushEntry({
    __type__: 'cc.UITransform',
    _name: '',
    node: { __id__: nodeIdx },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 108, height: 28 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
  });

  const labelIdx = pushEntry({
    __type__: 'cc.Label',
    _name: '',
    node: { __id__: nodeIdx },
    _enabled: true,
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    _string: name === 'ItemNameLabel' ? '技能名' : '0.0',
    _horizontalAlign: 1,
    _verticalAlign: 1,
    _actualFontSize: fontSize,
    _fontSize: fontSize,
    _fontFamily: 'Arial',
    _lineHeight: fontSize + 6,
    _overflow: 2,
    _enableWrapText: false,
    _isSystemFontUsed: true,
    _id: '',
  });

  p[nodeIdx]._components.push({ __id__: utIdx }, { __id__: labelIdx });
  if (!p[parentIdx]._children) {
    p[parentIdx]._children = [];
  }
  p[parentIdx]._children.push({ __id__: nodeIdx });

  return { nodeIdx, labelIdx };
}

const rootIdx = idxByName('ItemCardWidget') === -1 ? 1 : idxByName('ItemCardWidget');
const actualRoot = p.findIndex((x) => x.__type__ === 'cc.Node' && x._name === 'ItemCardWidget');
const cardRoot = actualRoot >= 0 ? actualRoot : 1;

let nameLabelIdx = p.findIndex(
  (x) => x.__type__ === 'cc.Label' && p[x.node?.__id__]?._name === 'ItemNameLabel',
);

if (nameLabelIdx < 0) {
  const created = addLabelNode('ItemNameLabel', cardRoot, { x: 0, y: 58 }, 16);
  nameLabelIdx = created.labelIdx;
} else {
  nameLabelIdx = nameLabelIdx;
}

const cdOverlayIdx = idxByName('CdOverlay');
let cdTimeLabelIdx = -1;
for (const childRef of p[cdOverlayIdx]._children ?? []) {
  const child = p[childRef.__id__];
  if (child?._name === 'CdTimeLabel') {
    const comp = child._components?.find((c) => p[c.__id__]?.__type__ === 'cc.Label');
    if (comp) {
      cdTimeLabelIdx = comp.__id__;
    }
  }
}

if (cdTimeLabelIdx < 0) {
  const created = addLabelNode('CdTimeLabel', cdOverlayIdx, { x: 0, y: 0 }, 22);
  cdTimeLabelIdx = created.labelIdx;
  const cdTimeNode = p[p[cdTimeLabelIdx].node.__id__];
  const label = p[cdTimeLabelIdx];
  label._enableOutline = true;
  label._outlineWidth = 2;
  label._outlineColor = { __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 255 };
  cdTimeNode._active = false;
}

const widgetIdx = p.findIndex((x) => x.__type__?.includes('14810'));
if (widgetIdx < 0) {
  throw new Error('ItemCardWidget component missing');
}
p[widgetIdx].nameLabel = { __id__: nameLabelIdx };
p[widgetIdx].cdTimeLabel = { __id__: cdTimeLabelIdx };

// CdOverlayBar layer 与父节点一致
const cdBarNodeIdx = p[cdOverlayIdx]._children?.find((c) => p[c.__id__]?._name === 'CdOverlayBar')?.__id__;
if (cdBarNodeIdx !== undefined) {
  p[cdBarNodeIdx]._layer = p[cdOverlayIdx]._layer;
}

// EmptyBg 默认激活
const emptySlotIdx = idxByName('EmptySlot');
const emptyBgRef = p[emptySlotIdx]._children?.find((c) => p[c.__id__]?._name === 'EmptyBg');
if (emptyBgRef) {
  p[emptyBgRef.__id__]._active = true;
}

// ModLabel 默认随 ModBadge 显示
const modLabelNode = p.find((x) => x._name === 'ModLabel');
if (modLabelNode) {
  modLabelNode._active = true;
}

fs.writeFileSync(PREFAB, JSON.stringify(p, null, 2));
console.log('Patched ItemCardWidget.prefab: ItemNameLabel + CdTimeLabel');
