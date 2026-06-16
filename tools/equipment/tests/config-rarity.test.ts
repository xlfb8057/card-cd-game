import {
  getRarityFrameKey,
  getRarityLabel,
  getRarityDisplayColor,
  getEmptySlotFrameKey,
  getLockedSlotFrameKey,
} from '../../../assets/scripts/ui/item-display/RarityDisplayUtil';
import { assert, TestContext, TestSuite } from '../test-utils';

export const configRaritySuite: TestSuite = {
  id: 'config-rarity',
  name: '配置加载与品质展示',
  run(ctx: TestContext): void {
    const spike = ctx.configTable.getItem('spike_trap');
    assert(!!spike, '加载 spike_trap 配置');
    assert(spike!.name === '地刺陷阱', '装备名称与配置一致');

    for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
      const frame = getRarityFrameKey(rarity);
      assert(frame.includes('frame_'), `${rarity} 边框 key: ${frame}`);
      assert(!!getRarityLabel(rarity), `${rarity} 中文标签非空`);
      assert(getRarityDisplayColor(rarity).length >= 6, `${rarity} 颜色 hex`);
    }

    assert(
      getEmptySlotFrameKey().includes('slot_empty'),
      '空槽位边框 key',
    );
    assert(
      getLockedSlotFrameKey().includes('slot_locked'),
      '锁定槽位边框 key',
    );

    const mod = ctx.configTable.getMod('mod_sharp');
    assert(!!mod, '加载 mod_sharp 改装配置');
  },
};
