/**
 * Popover 定位算法 — 优先右侧，边缘避让 ≥8px
 */

import { IPopoverLayout, PopoverPlacement } from './ItemDisplayTypes';

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SAFE_MARGIN = 8;
const DEFAULT_POPOVER_WIDTH = 280;
const DEFAULT_POPOVER_HEIGHT = 320;

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

  switch (placement) {
    case 'right':
      x = anchor.x + anchor.width + SAFE_MARGIN;
      break;
    case 'left':
      x = anchor.x - popoverWidth - SAFE_MARGIN;
      break;
    case 'bottom':
      x = anchor.x;
      y = anchor.y - popoverHeight - SAFE_MARGIN;
      break;
    case 'top':
      x = anchor.x;
      y = anchor.y + anchor.height + SAFE_MARGIN;
      break;
  }

  const fits =
    x >= screen.x + SAFE_MARGIN &&
    y >= screen.y + SAFE_MARGIN &&
    x + popoverWidth <= screen.x + screen.width - SAFE_MARGIN &&
    y + popoverHeight <= screen.y + screen.height - SAFE_MARGIN;

  if (!fits) {
    return null;
  }

  return { placement, x, y, maxHeight: popoverHeight };
}

function clampLayout(
  placement: PopoverPlacement,
  x: number,
  y: number,
  maxHeight: number,
  screen: IRect,
  popoverWidth: number,
): IPopoverLayout {
  const clampedX = Math.max(
    screen.x + SAFE_MARGIN,
    Math.min(x, screen.x + screen.width - popoverWidth - SAFE_MARGIN),
  );
  const clampedY = Math.max(
    screen.y + SAFE_MARGIN,
    Math.min(y, screen.y + screen.height - SAFE_MARGIN),
  );
  const availableHeight =
    screen.y + screen.height - SAFE_MARGIN - clampedY;
  return {
    placement,
    x: clampedX,
    y: clampedY,
    maxHeight: Math.min(maxHeight, availableHeight),
  };
}
