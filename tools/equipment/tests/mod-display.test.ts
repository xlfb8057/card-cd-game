import { ItemInstance } from '../../../assets/scripts/models/ItemInstance';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { modSelectPresenter } from '../../../assets/scripts/ui/item-display/ModSelectPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const modDisplaySuite: TestSuite = {
  id: 'mod-display',
  name: '改装展示（角标 / 三选一锁定）',
  run(ctx: TestContext): void {
    const plain = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
    });
    const plainCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: plain,
      }),
    );
    assert(!plainCard.hasMod, '无改装 hasMod=false');

    const modded = new ItemInstance({
      configId: 'spike_trap',
      position: 0,
      baseCD: 5,
      star: 1,
      mods: ['mod_sharp'],
    });
    const modCard = itemDisplayPresenter.buildCard(
      buildItemContext('battle_equipped', 'spike_trap', ctx.deps, {
        instance: modded,
      }),
    );
    assert(modCard.hasMod, '有改装 hasMod=true');
    assert(modCard.modNames.includes('锋利'), '卡片 modNames 含改装名');

    const choices = [
      ctx.configTable.getMod('mod_sharp')!,
      ctx.configTable.getMod('mod_swift')!,
      ctx.configTable.getMod('mod_burn')!,
    ].filter(Boolean);

    const round1 = modSelectPresenter.buildModCards(choices, 1);
    assert(round1.every((c) => c.locked), '第 1 回合全部改装锁定');

    const round2 = modSelectPresenter.buildModCards(choices, 2);
    const attr = round2.find((c) => c.modId === 'mod_sharp');
    assert(attr && !attr.locked, '第 2 回合属性改装解锁');

    const round5 = modSelectPresenter.buildModCards(choices, 5);
    const mech = round5.find((c) => c.modId === 'mod_burn');
    assert(mech && !mech.locked, '第 5 回合机制改装解锁');
  },
};
