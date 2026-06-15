/**
 * P0 装备系统离线验证（无需 Cocos 编辑器）
 *
 * 用法（在 NewProject 目录）:
 *   npm run verify:p0
 *
 * 验证内容:
 *   1. 配置加载 + v3 字段 normalize
 *   2. 商店池（common 品质 + shopAvailable）
 *   3. 升星公式
 *   4. 战斗主循环（装备触发 / DOT tick / 胜负）
 *   5. 三英雄被动（food / dot / tool CD）
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryConfigLoader, ConfigTable } from '../assets/scripts/core/ConfigTable';
import { EventBus } from '../assets/scripts/core/EventBus';
import { EconomySystem } from '../assets/scripts/systems/EconomySystem';
import { InventorySystem } from '../assets/scripts/systems/InventorySystem';
import { ShopSystem } from '../assets/scripts/systems/ShopSystem';
import { HeroSystem } from '../assets/scripts/systems/HeroSystem';
import { BattleSystem } from '../assets/scripts/systems/BattleSystem';
import { ItemInstance } from '../assets/scripts/models/ItemInstance';
import { Enemy } from '../assets/scripts/models/Enemy';
import { calcStarValue } from '../assets/scripts/utils/StarCalculator';
import { GAME_CONSTANTS } from '../assets/scripts/config/GameConstants';
import { normalizeRarity } from '../assets/scripts/utils/RarityCompat';
import { isShopAvailable } from '../assets/scripts/utils/ShopUtil';

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'assets', 'resources', 'config');

function loadJsonFile(name: string): unknown {
  const filePath = path.join(CONFIG_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`缺少配置文件: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  OK  ${message}`);
}

async function main(): Promise<void> {
  console.log('\n=== P0 装备系统验证（离线 / 无 Cocos）===\n');

  const loader = new MemoryConfigLoader(
    new Map([
      ['config/items', loadJsonFile('items.json')],
      ['config/heroes', loadJsonFile('heroes.json')],
      ['config/enemies', loadJsonFile('enemies.json')],
      ['config/mods', loadJsonFile('mods.json')],
    ]),
  );

  const configTable = new ConfigTable(loader);
  await configTable.loadAll();

  // --- 1. 配置加载 ---
  console.log('[1] 配置加载');
  const allItems = configTable.getAllItems();
  assert(allItems.length >= 15, `装备数量 >= 15（实际 ${allItems.length}）`);

  const spikeTrap = configTable.getItem('spike_trap');
  assert(spikeTrap !== undefined, '能读取 spike_trap');
  assert(spikeTrap!.rarity === 'common', 'spike_trap 品质为 common');
  assert(spikeTrap!.shopAvailable === true, 'spike_trap shopAvailable=true');
  assert(
    spikeTrap!.effects.every((e) => e.starScale !== undefined),
    'spike_trap 每条 effect 有 starScale',
  );
  assert(normalizeRarity('bronze') === 'common', '旧品质 bronze → common');

  const heroes = configTable.getAllHeroes();
  assert(heroes.length === 3, '英雄数量 = 3');
  assert(configTable.getAllMods().length === 15, '改装数量 = 15');

  // --- 2. 商店池 ---
  console.log('\n[2] 商店池（v3: shopAvailable + common/rare/...）');
  const eventBus = new EventBus();
  const economy = new EconomySystem(eventBus);
  const inventory = new InventorySystem(eventBus, configTable, economy);
  const shop = new ShopSystem(eventBus, configTable, economy, inventory, () => 0.42);

  const round1Pool = shop.getPoolByRound(1);
  assert(round1Pool.length > 0, `第1回合商店池非空（${round1Pool.length} 件）`);
  assert(
    round1Pool.every((id) => configTable.getItem(id)?.rarity === 'common'),
    '第1回合仅 common 品质',
  );

  const shopOnlyItems = allItems.filter(isShopAvailable);
  assert(shopOnlyItems.length > 0, 'shopAvailable=true 的装备 > 0');

  shop.openShop(1);
  assert(shop.currentItems.length > 0, 'openShop 后商店有商品');

  // --- 3. 升星公式 ---
  console.log('\n[3] 升星公式');
  const star2Damage = calcStarValue(10, 0.5, 2);
  assert(star2Damage === 15, `2星 damage: 10×(1+0.5)=15（实际 ${star2Damage}）`);
  assert(GAME_CONSTANTS.SHIELD_MAX_RATIO === 2.5, '护盾上限倍率 = 2.5');

  // --- 4. 战斗主循环 ---
  console.log('\n[4] 战斗主循环（装备触发 + DOT）');
  const heroSystem = new HeroSystem(eventBus, configTable);
  heroSystem.loadHeroById('mak');

  const battle = new BattleSystem({
    eventBus,
    configTable,
    heroSystem,
  });

  const enemy = new Enemy({
    configId: 'test_dummy',
    name: '木桩',
    hp: 500,
    attackCD: 999,
    damage: 0,
  });

  const battleItem = new ItemInstance({
    configId: 'spike_trap',
    position: 0,
    baseCD: 0,
    star: 1,
  });

  battle.startBattle([battleItem], enemy, 100, 100);

  let dotTickCount = 0;
  eventBus.on('dot_tick', () => {
    dotTickCount++;
  });

  const dt = 0.1;
  for (let t = 0; t < 12; t += dt) {
    battle.update(dt);
  }

  const state = battle.getState();
  assert(state.enemyHP < 500, `敌人受到伤害（HP ${state.enemyHP}/500）`);
  assert(dotTickCount >= 1, `DOT 至少 tick 1 次（实际 ${dotTickCount} 次）`);
  assert(state.playerHP > 0, '玩家存活');

  // --- 5. 英雄被动 ---
  console.log('\n[5] 英雄被动');

  // 朱尔斯 food ×1.25
  heroSystem.loadHeroById('jules');
  const foodMult = heroSystem.getEffectMultiplier(['food'], 'heal');
  assert(foodMult === 1.25, `朱尔斯 food heal 倍率 = 1.25（实际 ${foodMult}）`);

  // 马克 dot ×1.3
  heroSystem.loadHeroById('mak');
  const dotMult = heroSystem.getEffectMultiplier(['dot'], 'dot');
  assert(Math.abs(dotMult - 1.3) < 0.001, `马克 dot 倍率 = 1.3（实际 ${dotMult}）`);

  // 斯黛拉 tool CD ×0.8
  heroSystem.loadHeroById('stelle');
  const toolCD = heroSystem.getModifiedCD(5.0, ['tool']);
  assert(toolCD === 4, `斯黛拉 tool CD 5×0.8=4（实际 ${toolCD}）`);

  console.log('\n=== 全部 P0 检查通过 ===\n');
  console.log('说明: 此脚本只验证「逻辑层」，不经过 Cocos UI / resources.load。');
  console.log('完整流程请在 Cocos 预览中验证（见 README 或下方说明）。\n');
}

main().catch((err) => {
  console.error('\n验证失败:\n', err);
  process.exit(1);
});
