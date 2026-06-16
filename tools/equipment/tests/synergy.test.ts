import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { buildSynergyAnalyzer } from '../../../assets/scripts/ui/item-display/BuildSynergyAnalyzer';
import { buildSynergyResolver } from '../../../assets/scripts/ui/item-display/BuildSynergyResolver';
import { assert, TestContext, TestSuite } from '../test-utils';

export const synergySuite: TestSuite = {
  id: 'synergy',
  name: 'Build 联动（分析 / 高亮槽位）',
  run(ctx: TestContext): void {
    const foodItem = ctx.configTable.getItem('chef_hat');
    assert(!!foodItem, 'chef_hat 存在');

    const foodInst = new ItemInstance({
      configId: foodItem!.id,
      position: 1,
      baseCD: foodItem!.baseCD,
      star: 1,
    });
    ctx.inventory.equipAt(foodInst, 1);

    const equippedFoodCtx = buildItemContext(
      'shop_equipped',
      foodItem!.id,
      ctx.deps,
      { instance: foodInst, slotIndex: 1 },
    );
    const synergyLines = buildSynergyAnalyzer.analyze(equippedFoodCtx);
    assert(
      synergyLines.some((l) => l.group === 'hero'),
      '朱尔斯 + food 装备 Build 面板含英雄被动',
    );

    const procItem = ctx.configTable
      .getAllItems()
      .find((i) => i.effects.some((e) => e.type === 'proc_chance'));
    if (procItem) {
      const procCtx = buildItemContext('shop_for_sale', procItem.id, ctx.deps);
      const linked = buildSynergyResolver.getLinkedSlots(procCtx, procItem.id);
      assert(linked.length >= 0, 'proc 装备联动槽位查询不抛错');
    }
  },
};
