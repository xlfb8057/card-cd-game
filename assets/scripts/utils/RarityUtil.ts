/**
 * 装备品质颜色（v3 + 旧名兼容）
 */

import { ItemRarity } from '../config/ItemConfig';
import { normalizeRarity } from './RarityCompat';

export const RARITY_BORDER_COLORS: Record<ItemRarity, string> = {
  common: '#4CAF50',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

/** @deprecated 旧 v2.1 品质色映射，仅供 UI 过渡 */
const LEGACY_COLOR_FALLBACK: Record<string, string> = {
  bronze: RARITY_BORDER_COLORS.common,
  silver: RARITY_BORDER_COLORS.rare,
  gold: RARITY_BORDER_COLORS.epic,
};

export function getRarityColor(rarity: ItemRarity | string): string {
  const normalized = normalizeRarity(rarity);
  return (
    RARITY_BORDER_COLORS[normalized] ??
    LEGACY_COLOR_FALLBACK[rarity] ??
    '#CCCCCC'
  );
}

export const HASTE_MAX_COLOR = '#FF4444';

export const LOG_COLORS = {
  damage: '#FF5555',
  haste: '#5599FF',
  shield: '#55CC55',
  heal: '#FFFFFF',
  info: '#AAAAAA',
  victory: '#FFD700',
  defeat: '#FF6666',
} as const;
