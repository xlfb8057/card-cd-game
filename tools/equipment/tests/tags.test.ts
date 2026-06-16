import {
  getTagDisplay,
  getTagsDisplay,
  ALL_TAG_ICON_PATHS,
} from '../../../assets/scripts/ui/item-display/ItemTagRegistry';
import { assert, TestContext, TestSuite } from '../test-utils';

export const tagsSuite: TestSuite = {
  id: 'tags',
  name: '标签注册表（图标 / 中文名）',
  run(ctx: TestContext): void {
    const damage = getTagDisplay('damage');
    assert(damage.label === '伤害', 'damage 中文标签');
    assert(damage.iconPath.includes('tag_damage'), 'damage 图标路径');

    const spike = ctx.configTable.getItem('spike_trap')!;
    const tags = getTagsDisplay(spike.tags);
    assert(tags.length === spike.tags.length, '标签数量与配置一致');
    assert(tags.every((t) => t.iconPath.startsWith('textures/')), '标签图标路径前缀');

    assert(ALL_TAG_ICON_PATHS.length >= 10, '预加载标签路径列表非空');

    const unknown = getTagDisplay('custom_tag');
    assert(unknown.label === 'custom_tag', '未知标签回退为 id');
  },
};
