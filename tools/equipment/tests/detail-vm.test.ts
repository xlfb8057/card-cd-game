import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const detailVmSuite: TestSuite = {
  id: 'detail-vm',
  name: '详情 ViewModel（效果 / 价格 / 亲和）',
  run(ctx: TestContext): void {
    const ctxShop = buildItemContext('shop_for_sale', 'spike_trap', ctx.deps);
    const detail = itemDisplayPresenter.buildDetail(ctxShop);
    assert(detail.name === '地刺陷阱', '详情名称正确');
    assert(detail.effects.length >= 2, '详情至少 2 条 effect');
    assert(detail.baseCdText.endsWith('s'), `基础 CD 格式: ${detail.baseCdText}`);
    assert(!!detail.sellPriceText, '出售价格已展示');
    assert(detail.showPrice, '商店详情显示购买价');

    const makItem = ctx.configTable.getItem('adrenaline_suit');
    if (makItem) {
      const makDetail = itemDisplayPresenter.buildDetail(
        buildItemContext('shop_for_sale', makItem.id, {
          ...ctx.deps,
          currentHeroId: 'mak',
        }),
      );
      assert(makDetail.affinityLabel === '亲和', '当前英雄专属显示「亲和」');
    }

    const depsPoison = { ...ctx.deps, enemyPoisonStacks: 5 };
    const venomDetail = itemDisplayPresenter.buildDetail(
      buildItemContext('shop_for_sale', 'venom_heart', depsPoison),
    );
    const scalingLine = venomDetail.effects.find((e) =>
      e.description.includes('中毒'),
    );
    assert(!!scalingLine, '毒龙之心含中毒 scaling 描述');
    assert(
      scalingLine!.description.includes('5'),
      `5 层中毒写入描述: ${scalingLine!.description}`,
    );

    const modItem = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
      mods: ['mod_sharp'],
    });
    const modDetail = itemDisplayPresenter.buildDetail(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: modItem,
      }),
    );
    assert(modDetail.modEffects.length === 1, '详情展示改装效果行');
    assert(modDetail.modNames.includes('锋利'), '详情 modNames 含改装名');
  },
};
