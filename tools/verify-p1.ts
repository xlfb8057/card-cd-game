/**
 * P1 装备系统离线验证
 *
 * 用法: npm run verify:p1
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryConfigLoader, ConfigTable } from '../assets/scripts/core/ConfigTable';
import { EventBus } from '../assets/scripts/core/EventBus';
import { HeroSystem } from '../assets/scripts/systems/HeroSystem';
import { BattleSystem } from '../assets/scripts/systems/BattleSystem';
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
  heroSystem: HeroSystem,
  items: ItemInstance[],
  hooks: Partial<IEffectBattleContext> = {},
): IEffectBattleContext {
  const eventBus = new EventBus();
  const dotSystem = new DotSystem({
    eventBus,
    getDotBoostMod: () => 1,
    hasUnlockCap: () =>
      items.some((i) =>
        configTable.getItem(i.configId)?.effects.some((e) => e.type === 'unlock_cap'),
      ),
    resolveTarget: () => null,
  });

  return {
    configTable,
    heroSystem,
    dotSystem,
    getItems: () => items,
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
    getTagBuffMultiplier: () => 1,
    addTagBuff: () => {},
    rollChance: () => false,
    getLastDamageDealt: () => 0,
    setLastDamageDealt: () => {},
    emitHeal: () => {},
    emitShield: () => {},
    ...hooks,
  };
}

function runTicks(battle: BattleSystem, seconds: number, dt = 0.1): void {
  for (let t = 0; t < seconds; t += dt) {
    battle.update(dt);
  }
}

async function main(): Promise<void> {
  console.log('\n=== P1 装备系统验证（离线）===\n');
  const configTable = await loadConfig();
  const eventBus = new EventBus();
  const heroSystem = new HeroSystem(eventBus, configTable);
  heroSystem.loadHeroById('jules');

  // --- 1. crit + damage ---
  console.log('[1] crit + damage（鱼子酱）');
  const caviar = new ItemInstance({
    configId: 'caviar',
    position: 0,
    baseCD: 0,
    star: 1,
  });
  let critDamage = 0;
  let isCrit = false;
  const makForCrit = new HeroSystem(eventBus, configTable);
  makForCrit.loadHeroById('mak');
  EffectResolver.resolveAllEffects(
    caviar,
    configTable.getItem('caviar')!,
    makeCtx(configTable, makForCrit, [caviar], {
      dealDamageToEnemy: (_s, amount, crit) => {
        critDamage = amount;
        isCrit = crit;
      },
    }),
  );
  assert(isCrit, '鱼子酱伤害为暴击');
  assert(critDamage === 40, `damage 20 × crit 2 = 40（实际 ${critDamage}）`);

  // --- 2. scaling item_count ---
  console.log('\n[2] scaling 木桶（item_count）');
  const barrelItems = [
    new ItemInstance({ configId: 'barrel', position: 0, baseCD: 99, star: 1 }),
    new ItemInstance({ configId: 'glasses', position: 1, baseCD: 99, star: 1 }),
    new ItemInstance({ configId: 'soothing_heal', position: 2, baseCD: 99, star: 1 }),
  ];
  let barrelDamage = 0;
  EffectResolver.resolveAllEffects(
    barrelItems[0],
    configTable.getItem('barrel')!,
    makeCtx(configTable, heroSystem, barrelItems, {
      dealDamageToEnemy: (_s, amount) => {
        barrelDamage = amount;
      },
    }),
  );
  assert(barrelDamage === 19, `3件×0.1 → 15×1.3=19（实际 ${barrelDamage}）`);

  // --- 3. scaling dot_stacks ---
  console.log('\n[3] scaling dot_stacks（毒龙之心）');
  const venom = new ItemInstance({
    configId: 'venom_heart',
    position: 0,
    baseCD: 99,
    star: 1,
  });
  const spike = new ItemInstance({
    configId: 'spike_trap',
    position: 1,
    baseCD: 0,
    star: 1,
  });
  let dotApplyValue = 0;
  const captureDot: { value: number } = { value: 0 };
  EffectResolver.resolve(
    configTable.getItem('spike_trap')!.effects[0],
    spike,
    configTable.getItem('spike_trap')!,
    makeCtx(configTable, heroSystem, [venom, spike], {
      getDotStacksOnEnemy: () => 4,
      dotSystem: {
        applyDot: (_t, _type, value) => {
          captureDot.value = value;
        },
        update: () => {},
        getTotalStacks: () => 4,
        clearAllDots: () => {},
      },
    }),
  );
  dotApplyValue = captureDot.value;
  // 4 stacks × 0.05 = 0.2 → 5 × 1.2 = 6
  assert(dotApplyValue === 6, `毒龙 4层×0.05 → dot 5×1.2=6（实际 ${dotApplyValue}）`);

  // --- 4. freeze ---
  console.log('\n[4] freeze（极光穹顶）');
  let freezeDuration = 0;
  const aurora = new ItemInstance({
    configId: 'aurora_dome',
    position: 0,
    baseCD: 0,
    star: 1,
  });
  EffectResolver.resolve(
    configTable.getItem('aurora_dome')!.effects[0],
    aurora,
    configTable.getItem('aurora_dome')!,
    makeCtx(configTable, heroSystem, [aurora], {
      applyEnemyFreeze: (d) => {
        freezeDuration = d;
      },
    }),
  );
  assert(freezeDuration === 2, `1星 freeze 持续2秒（实际 ${freezeDuration}）`);

  const freezeEnemy = new Enemy({
    configId: 'dummy',
    name: '木桩',
    hp: 500,
    attackCD: 2,
    damage: 10,
  });
  const freezeBattle = new BattleSystem({ eventBus: new EventBus(), configTable, heroSystem });
  freezeBattle.startBattle([aurora], freezeEnemy, 100, 100);
  aurora.currentCD = 0;
  freezeBattle.update(0.01);
  const hpBefore = freezeBattle.getState().playerHP;
  runTicks(freezeBattle, 1.5);
  assert(freezeBattle.getState().playerHP === hpBefore, 'freeze 期间敌人未攻击');
  runTicks(freezeBattle, 2.5);
  assert(freezeBattle.getState().playerHP < hpBefore, 'freeze 结束后敌人恢复攻击');

  // --- 5. 主动技能 ---
  console.log('\n[5] 三英雄主动技能');

  const julesHero = new HeroSystem(new EventBus(), configTable);
  julesHero.loadHeroById('jules');
  const julesB = new BattleSystem({
    eventBus: new EventBus(),
    configTable,
    heroSystem: julesHero,
  });
  julesB.startBattle(
    [new ItemInstance({ configId: 'chef_hat', position: 0, baseCD: 99, star: 1 })],
    new Enemy({ configId: 'd', name: '木桩', hp: 500, attackCD: 999, damage: 0 }),
    100,
    100,
  );
  assert(julesB.activateHeroSkill(), '朱尔斯盛宴可释放');
  assert(julesHero.getFoodBoostTimer() === 10, '朱尔斯 food×2 持续10秒');

  const makHero = new HeroSystem(new EventBus(), configTable);
  makHero.loadHeroById('mak');
  const makB = new BattleSystem({
    eventBus: new EventBus(),
    configTable,
    heroSystem: makHero,
  });
  makB.startBattle(
    [],
    new Enemy({ configId: 'd', name: '木桩', hp: 500, attackCD: 999, damage: 0 }),
    100,
    100,
  );
  assert(makB.activateHeroSkill(), '马克肾上腺素可释放');
  assert(makHero.getDotBoostTimer() === 15, '马克 DOT×2 持续15秒');
  assert(makB.getState().playerHP === 85, `马克自伤15% HP=85（实际 ${makB.getState().playerHP}）`);

  const stelleHero = new HeroSystem(new EventBus(), configTable);
  stelleHero.loadHeroById('stelle');
  const tool = new ItemInstance({
    configId: 'pencil_sharpener',
    position: 0,
    baseCD: 5,
    star: 1,
  });
  const stelleB = new BattleSystem({
    eventBus: new EventBus(),
    configTable,
    heroSystem: stelleHero,
  });
  stelleB.startBattle(
    [tool],
    new Enemy({ configId: 'd', name: '木桩', hp: 500, attackCD: 999, damage: 0 }),
    100,
    100,
  );
  assert(stelleB.activateHeroSkill(), '斯黛拉过载可释放');
  assert(tool.currentCD === GAME_CONSTANTS.OVERLOAD_CD_FORCED, '过载后 tool CD=0.5');
  assert(stelleHero.isOverloadActive(), '斯黛拉过载状态激活');

  console.log('\n=== 全部 P1 检查通过 ===\n');
}

main().catch((err) => {
  console.error('\n验证失败:\n', err);
  process.exit(1);
});
