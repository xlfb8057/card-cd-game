/**
 * 战斗相关数学工具
 * 伤害计算、CD 修正、护盾叠加
 */

export {
  GAME_CONSTANTS,
  CD_MIN,
  SHIELD_MAX_RATIO,
} from '../config/GameConstants';

import { GAME_CONSTANTS } from '../config/GameConstants';

/**
 * 计算实际 CD（应用加速累计与角色修正）
 */
export function calculateRealCD(
  baseCD: number,
  totalHaste: number,
  heroMod: number,
): number {
  const modified = baseCD * heroMod - totalHaste;
  return Math.max(GAME_CONSTANTS.CD_MIN, modified);
}

export function calculateDamage(
  baseDamage: number,
  scaling: number,
  critMultiplier: number = 1,
): number {
  const scaled = baseDamage * (1 + scaling);
  return Math.floor(scaled * critMultiplier);
}

export function applyShield(
  currentShield: number,
  amount: number,
  maxShield: number,
): number {
  return Math.min(currentShield + amount, maxShield);
}

export function applyHeal(
  currentHP: number,
  amount: number,
  maxHP: number,
): number {
  return Math.min(currentHP + amount, maxHP);
}

export function getAdjacentPositions(position: number): number[] {
  const adjacent: number[] = [];
  if (position > 0) {
    adjacent.push(position - 1);
  }
  if (position < 5) {
    adjacent.push(position + 1);
  }
  return adjacent;
}
