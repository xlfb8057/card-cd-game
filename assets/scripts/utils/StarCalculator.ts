/**
 * 升星数值计算
 */

/**
 * 计算升星后的数值
 * 公式: value × (1 + (star-1) × starScale)
 */
export function calcStarValue(
  baseValue: number,
  starScale: number,
  star: number,
): number {
  return Math.round(baseValue * (1 + (star - 1) * starScale) * 100) / 100;
}

/** 获取 effect 的 starScale，缺省时返回 0 */
export function getEffectStarScale(starScale: number | undefined): number {
  return starScale ?? 0;
}
