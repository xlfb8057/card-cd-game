import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import {
  computeDisplayBaseCd,
  computeCdProgress,
  isCdAtFloor,
  CD_READY_EPSILON,
} from '../../../assets/scripts/ui/item-display/ItemValueCalculator';
import { IHeroSkillContext } from '../../../assets/scripts/systems/HeroSystem';
import { assert, buildRuntime, TestContext, TestSuite } from '../test-utils';

const noopSkillCtx: IHeroSkillContext = {
  getItems: () => [],
  triggerItemImmediately: () => {},
  removeItem: () => {},
  getPlayerHP: () => 100,
  setPlayerHP: () => {},
};

export const cdDisplaySuite: TestSuite = {
  id: 'cd-display',
  name: 'CD 展示（进度 / 文本 / 结算 / 过载）',
  run(ctx: TestContext): void {
    const item = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
    });
    ctx.inventory.equipAt(item, 0);

    item.currentCD = 3;
    assert(!isCdAtFloor(item), '冷却中不显示 MAX');
    item.currentCD = 0;
    assert(isCdAtFloor(item), 'CD 归零显示 MAX');

    item.currentCD = 2.5;
    const config = ctx.configTable.getItem('spike_trap')!;
    const runtime = buildRuntime(ctx.deps);
    const baseCd = computeDisplayBaseCd(config, runtime, item);
    const progress = computeCdProgress(item, baseCd);
    assert(progress > 0 && progress < 1, `冷却进度 0~1: ${progress}`);

    item.currentCD = 0;
    const readyCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: item,
        slotIndex: 0,
      }),
    );
    assert(readyCard.cdAtMax, '就绪卡片 cdAtMax=true');
    assert(!readyCard.showCdTime, '就绪时不显示 cd 数字');

    item.currentCD = 2.5;
    const coolingCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: item,
        slotIndex: 0,
      }),
    );
    assert(!coolingCard.cdAtMax, '冷却中卡片 cdAtMax=false');
    assert(coolingCard.showCdTime, '冷却中 showCdTime=true');
    assert(coolingCard.cdText.length > 0, '冷却中 cdText 非空');

    const settledCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: item,
        slotIndex: 0,
        battleSettled: true,
      }),
    );
    assert(!settledCard.showCdOverlay, '结算后隐藏 CD 层');

    ctx.heroSystem.loadHeroById('stelle');
    ctx.heroSystem.activateSkill(noopSkillCtx);
    assert(ctx.heroSystem.isOverloadActive(), '斯黛拉过载已激活');

    const lighterCfg = ctx.configTable.getItem('lighter')!;
    const toolItem = new ItemInstance({
      configId: 'lighter',
      position: 1,
      baseCD: lighterCfg.baseCD,
      star: 1,
      currentCD: 3,
    });
    const overloadRuntime = buildRuntime({
      ...ctx.deps,
      heroSystem: ctx.heroSystem,
      currentHeroId: 'stelle',
    });
    const overloadCd = computeDisplayBaseCd(
      lighterCfg,
      overloadRuntime,
      toolItem,
    );
    assert(
      overloadCd >= toolItem.currentCD - CD_READY_EPSILON,
      `过载 tool 展示 CD 取 max(修正, currentCD): ${overloadCd}`,
    );
    const modified = ctx.heroSystem.getModifiedCD(
      lighterCfg.baseCD,
      lighterCfg.tags,
    );
    assert(modified === 0.5, `过载 tool 基础 CD 修正为 0.5s（实际 ${modified}）`);
  },
};
