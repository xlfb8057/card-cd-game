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
    assert(!modDetail.showMergeHint, '战斗详情不显示升星提示');
    assert(!modDetail.showSellPrice, '战斗详情不显示出售价格');
    assert(
      !modDetail.effects.some((e) => e.showStarArrow),
      '战斗详情效果行不显示升星箭头',
    );
    const pencilBattle = itemDisplayPresenter.buildDetail(
      buildItemContext('battle_equipped', 'pencil_sharpener', ctx.deps, {
        instance: new ItemInstance({
          configId: 'pencil_sharpener',
          position: 0,
          baseCD: 2,
          star: 2,
        }),
        slotIndex: 0,
      }),
    );
    assert(
      pencilBattle.effects[0]?.description.includes('造成'),
      '卷笔刀战斗详情保留完整描述',
    );
    assert(
      !pencilBattle.effects[0]?.description.match(/^[\d.]+ → [\d.]+$/),
      '卷笔刀战斗详情不应仅为 X→Y',
    );

    const shopMergeDetail = itemDisplayPresenter.buildDetail(
      buildItemContext('shop_for_sale', 'spike_trap', ctx.deps),
    );
    if (shopMergeDetail.showMergeHint) {
      assert(
        shopMergeDetail.effects.some((e) => e.showStarArrow),
        '商店待购可升星时效果行含升星预览',
      );
    }
  },
};
