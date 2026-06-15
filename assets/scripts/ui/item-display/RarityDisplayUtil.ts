/**
 * 品质展示工具 — 边框资源 key + 中文名
 */

import { ItemRarity } from '../../config/ItemConfig';
import { getRarityColor } from '../../utils/RarityUtil';

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

const RARITY_FRAME_KEYS: Record<ItemRarity, string> = {
  common: 'textures/item-display/frames/frame_common',
  rare: 'textures/item-display/frames/frame_rare',
  epic: 'textures/item-display/frames/frame_epic',
  legendary: 'textures/item-display/frames/frame_legendary',
};

export const ITEM_DISPLAY_RESOURCE_PREFIX = 'textures/item-display';

export function getRarityLabel(rarity: ItemRarity | string): string {
  const key = rarity as ItemRarity;
  return RARITY_LABELS[key] ?? '未知';
}

export function getRarityFrameKey(rarity: ItemRarity | string): string {
  const key = rarity as ItemRarity;
  return RARITY_FRAME_KEYS[key] ?? RARITY_FRAME_KEYS.common;
}

export function getRarityDisplayColor(rarity: ItemRarity | string): string {
  return getRarityColor(rarity);
}

export function getEmptySlotFrameKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/frames/slot_empty`;
}

export function getLockedSlotFrameKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/frames/slot_locked`;
}

export function getIconPlaceholderKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/frames/icon_placeholder`;
}

export function getCdOverlayKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/overlays/cd_overlay_bar`;
}

export function getCdMaxBadgeKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/overlays/cd_max_badge`;
}

export function getSynergyPulseFrameKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/overlays/synergy_pulse_frame`;
}

export function getPopoverBgKey(): string {
  return `${ITEM_DISPLAY_RESOURCE_PREFIX}/popover/popover_bg`;
}

/** 全局数值展示：保留 1 位小数 */
export function formatDisplayNumber(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** 出售价 fallback：floor(price × 0.7) */
export function computeSellPrice(price: number, configured?: number): number {
  if (configured !== undefined && configured >= 0) {
    return configured;
  }
  return Math.floor(price * 0.7);
}
