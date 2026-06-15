/**
 * P2 装备系统离线验证
 *
 * 用法: npm run verify:p2
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryConfigLoader, ConfigTable } from '../assets/scripts/core/ConfigTable';
import { EventBus } from '../assets/scripts/core/EventBus';
import { HeroSystem } from '../assets/scripts/systems/HeroSystem';
import { BattleSystem } from '../assets/scripts/systems/BattleSystem';
import { ModSystem } from '../assets/scripts/systems/ModSystem';
import { BuffSystem } from '../assets/scripts/systems/BuffSystem';
import { ItemInstance } from '../assets/scripts/models/ItemInstance';
import { Enemy } from '../assets/scripts/models/Enemy';
import { EffectResolver, IEffectBattleContext } from '../assets/scripts/systems/EffectResolver';
import { DotSystem } from '../assets/scripts/systems/DotSystem';
import { GAME_CONSTANTS } from '../assets/scripts/config/GameConstants';

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'assets', 'resources', 'config');

function loadJsonFile(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, name), 'utf-8'));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  OK  ${message}`);
}

async function loadConfig(): Promise<ConfigTable> {
  const loader = new MemoryConfigLoader(
    new Map([
      ['config/items', loadJsonFile('items.json')],
      ['config/heroes', loadJsonFile('heroes.json')],
      ['config/enemies', loadJsonFile('enemies.json')],
      ['config/mods', loadJsonFile('mods.json')],
    ]),
  );
  const table = new ConfigTable(loader);
  await table.loadAll();
  return table;
}

function makeCtx(
  configTable: ConfigTable,
  buffSystem: BuffSystem,
  hooks: Partial<IEffectBattleContext> = {},
): IEffectBattleContext {
  const dotSystem = new DotSystem({
    eventBus: new EventBus(),
    getDotBoostMod: () => 1,
    hasUnlockCap: () => false,
    resolveTarget: () => null,
  });

  return {
    configTable,
    heroSystem: null,
    dotSystem,
    getItems: () => [],
    getEnemyId: () => 'dummy',
    isEnemyAlive: () => true,
    dealDamageToEnemy: () => {},
    getPlayerHP: () => 100,
    getPlayerMaxHP: () => 100,
    getPlayerShield: () => 0,
    setPlayerHP: () => {},
    setPlayerShield: () => {},
    applyHasteToItems: () => {},
    applyEnemyFreeze: () => {},
    getCDBreakMin: () => GAME_CONSTANTS.CD_MIN,
    getDotStacksOnEnemy: () => 0,
    getTagBuffMultiplier: (tags) => buffSystem.getTagMultiplier(tags),
    addTagBuff: (target, mult, dur) => buffSystem.addTagBuff(target, mult, dur),
    rollChance: () => true,
    getLastDamageDealt: () => 0,
    setLastDamageDealt: () => {},
    emitHeal: () => {},
    emitShield: () => {},
    ...hooks,
  };
}

async function main(): Promise<void> {
  console.log('\n=== P2 装备系统验证（离线）===\n');
  const configTable = await loadConfig();

  console.log('[1] buff_multiplier（盛宴装备）');
  const buffSystem = new BuffSystem();
  let healed = 0;

  EffectResolver.resolve(
    configTable.getItem('feast_item')!.effects[0],
    new ItemInstance({ configId: 'feast_item', position: 1, baseCD: 0, star: 1 }),
    configTable.getItem('feast_item')!,
    makeCtx(configTable, buffSystem),
  );

  const chefHat = new ItemInstance({
    configId: 'chef_hat',
    position: 0,
    baseCD: 0,
    star: 1,
  });

  let playerHP = 50;
  EffectResolver.resolve(
    configTable.getItem('chef_hat')!.effects[0],
    chefHat,
    configTable.getItem('chef_hat')!,
    makeCtx(configTable, buffSystem, {
      getItems: () => [chefHat],
      getPlayerHP: () => playerHP,
      getPlayerMaxHP: () => 100,
      setPlayerHP: (hp) => {
        healed = hp - playerHP;
        playerHP = hp;
      },
    }),
  );
  assert(healed === 30, `food×1.5 heal 20→30（实际 +${healed}）`);

  console.log('\n[2] proc_chance（姜饼小屋）');
  const eventBus = new EventBus();
  let triggerCount = 0;
  eventBus.on('item_triggered', () => {
    triggerCount++;
  });

  const hotSauce = new ItemInstance({
    configId: 'hot_sauce',
    position: 1,
    baseCD: 0,
    star: 1,
  });
  const ginger = new ItemInstance({
    configId: 'gingerbread_house',
    position: 0,
    baseCD: 99,
    star: 1,
  });

  const procBattle = new BattleSystem({
    eventBus,
    configTable,
    heroSystem: new HeroSystem(eventBus, configTable),
    rng: () => 0,
  });
  procBattle.startBattle(
    [ginger, hotSauce],
    new Enemy({ configId: 'd', name: '木桩', hp: 500, attackCD: 999, damage: 0 }),
    100,
    100,
  );
  procBattle.triggerItemImmediately(hotSauce);
  procBattle.update(0.01);
  assert(triggerCount >= 2, `姜饼 proc 额外触发（触发次数 ${triggerCount}）`);

  console.log('\n[3] cd_break（永动核心）');
  const tool = new ItemInstance({
    configId: 'pencil_sharpener',
    position: 1,
    baseCD: 0.25,
    star: 1,
  });
  const perpetual = new ItemInstance({
    configId: 'perpetual_core',
    position: 0,
    baseCD: 99,
    star: 1,
  });

  const cdBattle = new BattleSystem({ eventBus: new EventBus(), configTable });
  cdBattle.startBattle(
    [perpetual, tool],
    new Enemy({ configId: 'd', name: '木桩', hp: 500, attackCD: 999, damage: 0 }),
    100,
    100,
  );

  const battleTool = cdBattle.getItems().find((i) => i.configId === 'pencil_sharpener')!;
  battleTool.applyHaste(0.2, GAME_CONSTANTS.CD_BREAK_MIN);
  assert(
    battleTool.currentCD === GAME_CONSTANTS.CD_BREAK_MIN,
    `tool CD 可突破至 ${GAME_CONSTANTS.CD_BREAK_MIN}（实际 ${battleTool.currentCD}）`,
  );

  console.log('\n[4] 改装属性（锋利 +10%）');
  const modSystem = new ModSystem(new EventBus(), configTable);
  const sharpItem = new ItemInstance({
    configId: 'pencil_sharpener',
    position: 0,
    baseCD: 0,
    star: 3,
    mods: ['mod_sharp'],
  });

  let modDamage = 0;
  EffectResolver.resolveAllEffects(
    sharpItem,
    configTable.getItem('pencil_sharpener')!,
    makeCtx(configTable, new BuffSystem(), {
      getItems: () => [sharpItem],
      dealDamageToEnemy: (_s, amount) => {
        modDamage = amount;
      },
    }),
    [],
    modSystem.getModAttributeBonuses(sharpItem),
  );
  assert(modDamage === 33, `3星 damage 30 + 锋利10% = 33（实际 ${modDamage}）`);

  console.log('\n[5] ModSystem 3星解锁');
  const twoStar = new ItemInstance({
    configId: 'barrel',
    position: 0,
    baseCD: 5,
    star: 2,
  });
  assert(!modSystem.equipMod(twoStar, 'mod_sharp', 5), '2星不能装改装');
  const threeStar = new ItemInstance({
    configId: 'barrel',
    position: 0,
    baseCD: 5,
    star: 3,
  });
  assert(modSystem.equipMod(threeStar, 'mod_sharp', 5), '3星可装改装');

  console.log('\n=== 全部 P2 检查通过 ===\n');
}

main().catch((err) => {
  console.error('\n验证失败:\n', err);
  process.exit(1);
});
