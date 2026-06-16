import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { mergeHintResolver } from '../../../assets/scripts/ui/item-display/MergeHintResolver';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const mergeHintSuite: TestSuite = {
  id: 'merge-hint',
  name: '升星判定（商店 vs 战斗）',
  run(ctx: TestContext): void {
    const item = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
    });
    ctx.inventory.equipAt(item, 0);

    const shopCtx = buildItemContext('shop_for_sale', 'spike_trap', ctx.deps);
    const hint = mergeHintResolver.getMergeHint(shopCtx);
    assert(hint.canMerge, '商店可升星判定');
    assert(hint.mergeTarget === 'equipped', '升星目标为装备栏');
    assert(hint.nextStar === 2, '下一星 = 2');

    const battleCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: item,
        slotIndex: 0,
      }),
    );
    assert(!battleCard.showMergeHint, '战斗装备栏不显示升星提示');
    assert(!battleCard.mergeStarPulse, '战斗装备栏 mergeStarPulse=false');
  },
};
