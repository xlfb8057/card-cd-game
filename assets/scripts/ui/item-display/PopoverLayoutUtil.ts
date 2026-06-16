/**
 * Popover 定位算法 — 优先右侧，边缘避让 ≥8px（§4.1）
 *
 * 坐标约定（与 ItemCardWidget.getAnchorRect / screenRect 一致）：
 * - screenRect.(x,y) 为屏幕左下角（Cocos 世界坐标系，y 向上）
 * - 返回值 (x,y) 为 Popover **左上角**（面板 anchor 0,1）
 * - Popover 向下延伸：底边 y = layout.y - maxHeight
 */

import { IPopoverLayout, PopoverPlacement } from './ItemDisplayTypes';

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SAFE_MARGIN = 8;
export const DEFAULT_POPOVER_WIDTH = 280;
export const DEFAULT_POPOVER_HEIGHT = 320;

export function computePopoverLayout(
  anchor: IRect,
  screen: IRect,
  popoverWidth = DEFAULT_POPOVER_WIDTH,
  popoverHeight = DEFAULT_POPOVER_HEIGHT,
): IPopoverLayout {
  const placements: PopoverPlacement[] = ['right', 'left', 'bottom', 'top'];

  for (const placement of placements) {
    const layout = tryPlacement(
      placement,
      anchor,
      screen,
      popoverWidth,
      popoverHeight,
    );
    if (layout) {
      return layout;
    }
  }

  return clampLayout(
    'right',
    anchor.x + anchor.width + SAFE_MARGIN,
    anchor.y,
    popoverHeight,
    screen,
    popoverWidth,
  );
}

function tryPlacement(
  placement: PopoverPlacement,
  anchor: IRect,
  screen: IRect,
  popoverWidth: number,
  popoverHeight: number,
): IPopoverLayout | null {
  let x = 0;
  let y = anchor.y;
  const cardBottom = anchor.y - anchor.height;

  switch (placement) {
    case 'right':
      x = anchor.x + anchor.width + SAFE_MARGIN;
      y = alignVerticalCenter(anchor, popoverHeight);
      break;
    case 'left':
      x = anchor.x - popoverWidth - SAFE_MARGIN;
      y = alignVerticalCenter(anchor, popoverHeight);
      break;
    case 'bottom':
      x = alignHorizontalCenter(anchor, popoverWidth);
      y = cardBottom - SAFE_MARGIN;
      break;
    case 'top':
      x = alignHorizontalCenter(anchor, popoverWidth);
      y = anchor.y + anchor.height + SAFE_MARGIN + popoverHeight;
      break;
  }

  if (!fitsTopLeftPopover(x, y, popoverWidth, popoverHeight, screen)) {
    return null;
  }

  return { placement, x, y, maxHeight: popoverHeight };
}

/** Popover 顶边与卡片垂直居中对齐（左右侧） */
function alignVerticalCenter(anchor: IRect, popoverHeight: number): number {
  const cardCenterY = anchor.y - anchor.height / 2;
  return cardCenterY + popoverHeight / 2;
}

/** Popover 水平与卡片居中对齐（上下侧） */
function alignHorizontalCenter(anchor: IRect, popoverWidth: number): number {
  const cardCenterX = anchor.x + anchor.width / 2;
  return cardCenterX - popoverWidth / 2;
}

/** 顶左锚点 Popover 是否完全落在屏幕安全区内 */
function fitsTopLeftPopover(
  topLeftX: number,
  topLeftY: number,
  width: number,
  height: number,
  screen: IRect,
): boolean {
  const bottomY = topLeftY - height;
  return (
    topLeftX >= screen.x + SAFE_MARGIN &&
    topLeftX + width <= screen.x + screen.width - SAFE_MARGIN &&
    topLeftY <= screen.y + screen.height - SAFE_MARGIN &&
    bottomY >= screen.y + SAFE_MARGIN
  );
}

function clampLayout(
  placement: PopoverPlacement,
  x: number,
  y: number,
  requestedHeight: number,
  screen: IRect,
  popoverWidth: number,
): IPopoverLayout {
  const minTop = screen.y + SAFE_MARGIN;
  const maxTop = screen.y + screen.height - SAFE_MARGIN;
  const minLeft = screen.x + SAFE_MARGIN;
  const maxLeft = screen.x + screen.width - popoverWidth - SAFE_MARGIN;

  const clampedX = Math.max(minLeft, Math.min(x, maxLeft));

  let maxHeight = Math.min(
    requestedHeight,
    maxTop - minTop,
  );
  maxHeight = Math.max(maxHeight, 120);

  let clampedY = Math.max(minTop + maxHeight, Math.min(y, maxTop));

  const bottomY = clampedY - maxHeight;
  if (bottomY < minTop) {
    clampedY = minTop + maxHeight;
  }

  return {
    placement,
    x: clampedX,
    y: clampedY,
    maxHeight,
  };
}

/** 供测试/调试：Popover 四边是否均在安全区内 */
export function isPopoverWithinScreen(
  layout: IPopoverLayout,
  screen: IRect,
  popoverWidth = DEFAULT_POPOVER_WIDTH,
): boolean {
  return fitsTopLeftPopover(
    layout.x,
    layout.y,
    popoverWidth,
    layout.maxHeight,
    screen,
  );
}
