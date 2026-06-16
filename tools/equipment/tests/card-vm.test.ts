import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const cardVmSuite: TestSuite = {
  id: 'card-vm',
  name: '卡片 ViewModel（名称 / 品质 / 升星闪烁）',
  run(ctx: TestContext): void {
    const item = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
    });
    ctx.inventory.equipAt(item, 0);

    const battleCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: item,
        slotIndex: 0,
      }),
    );
    assert(battleCard.name === '地刺陷阱', '战斗卡片 name 字段');
    assert(battleCard.showCdOverlay, '战斗卡片显示 CD 层');
    assert(!battleCard.mergeStarPulse, '战斗装备栏不闪烁升星');
    assert(battleCard.rarityFrameKey.includes('frame_'), '品质边框 key');
    assert(!battleCard.isEmpty, '已装备卡片 isEmpty=false');

    const mergeCtx = buildItemContext('shop_for_sale', 'spike_trap', ctx.deps);
    const shopCard = itemDisplayPresenter.buildCard(mergeCtx);
    assert(shopCard.mergeStarPulse, '商店待购可升星时闪烁下一星');
    assert(shopCard.name === '地刺陷阱', '商店卡片 name 字段');

    const soldCard = itemDisplayPresenter.buildCard(
      buildItemContext('shop_for_sale', 'spike_trap', ctx.deps, { sold: true }),
    );
    assert(!soldCard.clickable, '售罄卡片不可点击');
  },
};
