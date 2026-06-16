import {
  computeBattlePopoverLayout,
  computePopoverLayout,
  DEFAULT_POPOVER_HEIGHT,
  DEFAULT_POPOVER_WIDTH,
  isPopoverWithinScreen,
} from '../../../assets/scripts/ui/item-display/PopoverLayoutUtil';
import { assert, TestContext, TestSuite } from '../test-utils';

/** 与 ItemDisplayController.screenRect 一致（720×1280，中心原点） */
function battleScreenRect() {
  return { x: -360, y: -640, width: 720, height: 1280 };
}

export const popoverLayoutSuite: TestSuite = {
  id: 'popover-layout',
  name: 'Popover 定位算法',
  run(_ctx: TestContext): void {
    const screen = battleScreenRect();
    const anchorCenter = { x: -56, y: 200, width: 112, height: 112 };

    const right = computePopoverLayout(anchorCenter, screen);
    assert(right.placement === 'right', '居中锚点优先右侧');
    assert(
      right.x >= anchorCenter.x + anchorCenter.width,
      'Popover 在锚点右侧',
    );
    assert(
      isPopoverWithinScreen(right, screen, DEFAULT_POPOVER_WIDTH),
      '右侧布局不超出屏幕',
    );

    const anchorRightEdge = { x: 248, y: -400, width: 112, height: 112 };
    const fallback = computePopoverLayout(anchorRightEdge, screen);
    assert(
      ['left', 'bottom', 'top', 'right'].includes(fallback.placement),
      `贴边锚点有有效 placement: ${fallback.placement}`,
    );
    assert(
      isPopoverWithinScreen(fallback, screen, DEFAULT_POPOVER_WIDTH),
      '贴边 fallback 仍落在安全区内',
    );
    assert(fallback.x >= screen.x + 8, 'Popover x 不小于安全边距');
    assert(
      fallback.y - fallback.maxHeight >= screen.y + 8,
      'Popover 底边不小于安全边距',
    );
    assert(
      fallback.y <= screen.y + screen.height - 8,
      'Popover 顶边不超过安全边距',
    );

    const anchorBottom = { x: -200, y: -520, width: 112, height: 112 };
    const bottomRow = computePopoverLayout(anchorBottom, screen);
    assert(
      isPopoverWithinScreen(bottomRow, screen, DEFAULT_POPOVER_WIDTH),
      '底部装备栏锚点不超出屏幕',
    );
    assert(
      bottomRow.maxHeight <= DEFAULT_POPOVER_HEIGHT,
      '必要时可缩小 maxHeight',
    );

    const battleLayout = computeBattlePopoverLayout(anchorBottom, screen);
    assert(battleLayout.placement === 'top', '战斗界面浮层在卡片上方');
    assert(
      battleLayout.y - battleLayout.maxHeight >= anchorBottom.y + 20 - 1,
      '浮层底边距卡片顶约 20px',
    );
    assert(
      isPopoverWithinScreen(battleLayout, screen, DEFAULT_POPOVER_WIDTH),
      '战斗浮层不超出屏幕',
    );
  },
};
