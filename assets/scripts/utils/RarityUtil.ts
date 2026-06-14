/**
 * 装备品质颜色（白盒 UI）
 */

import { ItemRarity } from '../config/ItemConfig';

export const RARITY_BORDER_COLORS: Record<ItemRarity, string> = {
  bronze: '#4CAF50',
  silver: '#2196F3',
  gold: '#9C27B0',
  legendary: '#FF9800',
};

export function getRarityColor(rarity: ItemRarity | string): string {
  return RARITY_BORDER_COLORS[rarity as ItemRarity] ?? '#CCCCCC';
}

/** CD 达到加速极限时的边框色 */
export const HASTE_MAX_COLOR = '#FF4444';

/** 日志颜色 */
export const LOG_COLORS = {
  damage: '#FF5555',
  haste: '#5599FF',
  shield: '#55CC55',
  heal: '#FFFFFF',
  info: '#AAAAAA',
  victory: '#FFD700',
  defeat: '#FF6666',
} as const;
