import { computePopoverLayout } from '../../../assets/scripts/ui/item-display/PopoverLayoutUtil';
import { assert, TestContext, TestSuite } from '../test-utils';

export const popoverLayoutSuite: TestSuite = {
  id: 'popover-layout',
  name: 'Popover 定位算法',
  run(_ctx: TestContext): void {
    const screen = { x: 0, y: 0, width: 720, height: 1280 };
    const anchorCenter = { x: 300, y: 600, width: 80, height: 80 };

    const right = computePopoverLayout(anchorCenter, screen);
    assert(right.placement === 'right', '居中锚点优先右侧');
    assert(right.x >= anchorCenter.x + anchorCenter.width, 'Popover 在锚点右侧');

    const anchorRightEdge = { x: 650, y: 600, width: 60, height: 60 };
    const fallback = computePopoverLayout(anchorRightEdge, screen);
    assert(
      ['left', 'bottom', 'top', 'right'].includes(fallback.placement),
      `贴边锚点有有效 placement: ${fallback.placement}`,
    );
    assert(fallback.x >= 8, 'Popover x 不小于安全边距');
  },
};
