/**
 * 战斗相关数学工具
 * 伤害计算、CD 修正、护盾叠加
 */

/** CD 硬下限（秒），防止加速死循环 */
export const CD_MIN = 0.3;

/** 默认护盾上限比例（相对 maxHP） */
export const SHIELD_MAX_RATIO = 0.5;

/**
 * 计算实际 CD（应用加速累计与角色修正）
 * @param baseCD 配置基础 CD
 * @param totalHaste 累计加速减免（秒）
 * @param heroMod 角色 CD 修正乘数（如 0.8 表示 -20%）
 */
export function calculateRealCD(
  baseCD: number,
  totalHaste: number,
  heroMod: number,
): number {
  const modified = baseCD * heroMod - totalHaste;
  return Math.max(CD_MIN, modified);
}

/**
 * 计算最终伤害
 * @param baseDamage 基础伤害
 * @param scaling 缩放加成（如 0.25 表示 +25%）
 * @param critMultiplier 暴击倍率（默认 1）
 */
export function calculateDamage(
  baseDamage: number,
  scaling: number,
  critMultiplier: number = 1,
): number {
  const scaled = baseDamage * (1 + scaling);
  return Math.floor(scaled * critMultiplier);
}

/**
 * 护盾叠加（带上限）
 * @param currentShield 当前护盾
 * @param amount 新增护盾
 * @param maxShield 护盾上限
 */
export function applyShield(
  currentShield: number,
  amount: number,
  maxShield: number,
): number {
  return Math.min(currentShield + amount, maxShield);
}

/**
 * 治疗（不超过 maxHP）
 */
export function applyHeal(
  currentHP: number,
  amount: number,
  maxHP: number,
): number {
  return Math.min(currentHP + amount, maxHP);
}

/**
 * 获取相邻格子索引（0-5 范围内）
 */
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
