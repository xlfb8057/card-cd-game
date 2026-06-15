/**
 * 装备前端展示离线验证（F-07 / F-21）
 *
 * 用法（在 NewProject 目录）:
 *   npm run verify:item-display
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryConfigLoader, ConfigTable } from '../assets/scripts/core/ConfigTable';
import { EventBus } from '../assets/scripts/core/EventBus';
import { EconomySystem } from '../assets/scripts/systems/EconomySystem';
import { InventorySystem } from '../assets/scripts/systems/InventorySystem';
import { HeroSystem } from '../assets/scripts/systems/HeroSystem';
import { ModSystem } from '../assets/scripts/systems/ModSystem';
import { ItemInstance } from '../assets/scripts/models/ItemInstance';
import { calcStarValue } from '../assets/scripts/utils/StarCalculator';
import { itemDisplayPresenter } from '../assets/scripts/ui/item-display/ItemDisplayPresenter';
import {
  buildItemContext,
} from '../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { mergeHintResolver } from '../assets/scripts/ui/item-display/MergeHintResolver';
import { buildSynergyResolver } from '../assets/scripts/ui/item-display/BuildSynergyResolver';
import { buildSynergyAnalyzer } from '../assets/scripts/ui/item-display/BuildSynergyAnalyzer';
import { getBaseStarValue } from '../assets/scripts/ui/item-display/ItemValueCalculator';
import { formatDisplayNumber } from '../assets/scripts/ui/item-display/RarityDisplayUtil';

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'assets', 'resources', 'config');

function loadJsonFile(name: string): unknown {
  const filePath = path.join(CONFIG_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  OK  ${message}`);
}

async function main(): Promise<void> {
  console.log('\n=== 装备前端展示验证（离线）===\n');

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

  const eventBus = new EventBus();
  const economy = new EconomySystem(eventBus);
  const inventory = new InventorySystem(eventBus, configTable, economy);
  const heroSystem = new HeroSystem(eventBus, configTable);
  const modSystem = new ModSystem(eventBus, configTable);

  heroSystem.loadHeroById('jules');

  const deps = {
    configTable,
    heroSystem,
    modSystem,
    inventory,
    currentHeroId: 'jules',
  };

  const spike = configTable.getItem('spike_trap');
  assert(!!spike, '加载 spike_trap 配置');

  const star2 = calcStarValue(10, 0.5, 2);
  assert(star2 === 15, `calcStarValue(10, 0.5, 2) = ${star2}`);

  const ctx = buildItemContext('shop_for_sale', 'spike_trap', deps);
  const detail = itemDisplayPresenter.buildDetail(ctx);
  assert(detail.name === '地刺陷阱', '详情名称正确');
  assert(detail.effects.length >= 2, '详情至少 2 条 effect');
  assert(
    detail.baseCdText.endsWith('s'),
    `基础 CD 格式: ${detail.baseCdText}`,
  );
  assert(!!detail.sellPriceText, '出售价格已展示');

  for (const effect of spike!.effects) {
    for (let star = 1; star <= 3; star++) {
      const expected = formatDisplayNumber(
        calcStarValue(effect.value, effect.starScale, star),
      );
      const computed = formatDisplayNumber(getBaseStarValue(effect, star));
      assert(
        expected === computed,
        `${spike!.id} ${effect.type} ${star}星 = ${computed}`,
      );
    }
  }

  const item = new ItemInstance({
    configId: 'spike_trap',
    position: 0,
    baseCD: 5,
    star: 1,
  });
  inventory.equipAt(item, 0);

  const mergeCtx = buildItemContext('shop_for_sale', 'spike_trap', deps);
  const hint = mergeHintResolver.getMergeHint(mergeCtx);
  assert(hint.canMerge, '商店可升星判定');
  assert(hint.mergeTarget === 'equipped', '升星目标为装备栏');
  assert(hint.nextStar === 2, '下一星 = 2');

  const card = itemDisplayPresenter.buildCard(
    buildItemContext('battle_equipped', 'spike_trap', deps, {
      instance: item,
      slotIndex: 0,
    }),
  );
  assert(card.showCdOverlay, '战斗卡片显示 CD 层');
  assert(card.rarityFrameKey.includes('frame_'), '品质边框 key');

  const foodItem = configTable.getAllItems().find(
    (i) =>
      i.tags.includes('food') &&
      i.effects.some((e) =>
        ['damage', 'heal', 'shield'].includes(e.type),
      ),
  );
  if (foodItem) {
    const foodCtx = buildItemContext('shop_for_sale', foodItem.id, deps);
    const foodDetail = itemDisplayPresenter.buildDetail(foodCtx);
    assert(!!foodDetail, 'food 装备详情可构建');

    const foodInst = new ItemInstance({
      configId: foodItem.id,
      position: 1,
      baseCD: foodItem.baseCD,
      star: 1,
    });
    inventory.equipAt(foodInst, 1);
    const equippedFoodCtx = buildItemContext('shop_equipped', foodItem.id, deps, {
      instance: foodInst,
      slotIndex: 1,
    });
    const synergyLines = buildSynergyAnalyzer.analyze(equippedFoodCtx);
    assert(
      synergyLines.some((l) => l.group === 'hero'),
      '朱尔斯 + food 装备 Build 面板含英雄被动',
    );
  }

  const procItem = configTable
    .getAllItems()
    .find((i) => i.effects.some((e) => e.type === 'proc_chance'));
  if (procItem && foodItem) {
    const procCtx = buildItemContext('shop_for_sale', procItem.id, deps);
    const linked = buildSynergyResolver.getLinkedSlots(procCtx, procItem.id);
    assert(linked.length >= 1, 'proc 装备联动至少高亮 1 槽');
  }

  console.log('\n=== 全部通过 ===\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
