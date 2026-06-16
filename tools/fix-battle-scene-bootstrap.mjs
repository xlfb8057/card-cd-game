/**
 * 清理 Battle.scene 重复/错误挂载的 GameBootstrap（不删除数组项，避免 __id__ 错位）
 * 不再清空 BattleSceneView legacy slot 绑定（v4 自动生成 ItemCardWidget）
 */
import fs from 'fs';

const scenePath = 'assets/scene/Battle.scene';
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

const GAME_BOOTSTRAP = 'd21664Nh/hHeaMC3uEYJutN';

function detachComponent(compIndex) {
  const comp = scene[compIndex];
  if (!comp) {
    return false;
  }

  const nodeIndex = comp.node?.__id__;
  if (nodeIndex != null && scene[nodeIndex]?._components) {
    scene[nodeIndex]._components = scene[nodeIndex]._components.filter(
      (c) => c.__id__ !== compIndex,
    );
  }

  comp._enabled = false;
  return true;
}

const bootstrapIndices = [];
for (let i = 0; i < scene.length; i++) {
  if (scene[i]?.__type__ === GAME_BOOTSTRAP) {
    bootstrapIndices.push(i);
  }
}

const canvasIndex = scene.findIndex(
  (n) => n?.__type__ === 'cc.Node' && n._name === 'Canvas',
);
const keptOnCanvas = bootstrapIndices.find(
  (idx) => scene[idx].node?.__id__ === canvasIndex,
);

let removed = 0;
for (const idx of bootstrapIndices) {
  if (idx === keptOnCanvas) {
    continue;
  }
  if (detachComponent(idx)) {
    removed++;
    const nodeName = scene[scene[idx].node?.__id__]?._name ?? '?';
    console.log(`Detached GameBootstrap @${idx} (was on ${nodeName})`);
  }
}

fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2), 'utf8');
console.log(`Done: detached ${removed} extra GameBootstrap (kept @${keptOnCanvas})`);
