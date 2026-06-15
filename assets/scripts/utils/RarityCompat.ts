/**
 * v2.1 → v3 品质名称兼容层
 */

import { ItemRarity } from '../config/ItemConfig';

const LEGACY_RARITY_MAP: Record<string, ItemRarity> = {
  bronze: 'common',
  silver: 'rare',
  gold: 'epic',
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
};

/** 将旧品质名 normalize 为 v3 品质 */
export function normalizeRarity(rarity: string): ItemRarity {
  return LEGACY_RARITY_MAP[rarity] ?? 'common';
}

/** 判断是否为 v3 合法品质 */
export function isValidRarity(rarity: string): boolean {
  return rarity in LEGACY_RARITY_MAP;
}
