/**
 * 展示数值计算 — 封装 calcStarValue / HeroSystem / ModSystem
 * 前端禁止硬编码公式，仅调用逻辑层函数
 */

import { EffectType, IItemConfig, IItemEffect } from '../../config/ItemConfig';
import { IItemInstance } from '../../models/ItemInstance';
import { calcStarValue, getEffectStarScale } from '../../utils/StarCalculator';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { ItemDisplayRuntime, IValuePair } from './ItemDisplayTypes';
import { formatDisplayNumber } from './RarityDisplayUtil';

const BUFF_AFFECTED_TYPES: EffectType[] = [
  'damage',
  'dot',
  'shield',
  'heal',
  'haste',
  'crit',
  'proc_chance',
];

/** 获取 context 下的展示星级 */
export function resolveDisplayStar(
  instance: IItemInstance | null | undefined,
  kind: string,
  codexStar?: number,
): number {
  if (kind === 'codex' && codexStar !== undefined) {
    return codexStar;
  }
  if (instance) {
    return instance.star;
  }
  return 1;
}

/** 基础升星值（无加持） */
export function getBaseStarValue(
  effect: IItemEffect,
  star: number,
): number {
  return calcStarValue(
    effect.value,
    getEffectStarScale(effect.starScale),
    star,
  );
}

/** 改装属性加成倍率 */
export function getModMultiplier(
  instance: IItemInstance | null | undefined,
  effectType: EffectType,
  runtime: ItemDisplayRuntime,
): number {
  if (!instance || !runtime.modSystem) {
    return 1;
  }
  const bonuses = runtime.modSystem.getModAttributeBonuses(instance);
  const bonus = bonuses[effectType] ?? 0;
  return 1 + bonus;
}

/** 英雄被动 / buff 倍率 */
export function getHeroMultiplier(
  config: IItemConfig,
  effectType: EffectType,
  runtime: ItemDisplayRuntime,
): number {
  if (!runtime.heroSystem) {
    return 1;
  }
  return runtime.heroSystem.getEffectMultiplier(config.tags, effectType);
}

/** scaling 额外倍率（item_count / dot_stacks） */
export function getScalingBonusMultiplier(
  config: IItemConfig,
  runtime: ItemDisplayRuntime,
  equippedCount: number,
  enemyPoisonStacks: number,
): number {
  let bonus = 0;
  for (const effect of config.effects) {
    if (effect.type !== 'scaling' || !effect.scalingSource) {
      continue;
    }
    const perUnit = getBaseStarValue(effect, 1);
    switch (effect.scalingSource) {
      case 'item_count':
        bonus += equippedCount * perUnit;
        break;
      case 'dot_stacks':
        bonus += enemyPoisonStacks * perUnit;
        break;
      default:
        break;
    }
  }
  return 1 + bonus;
}

/** 单条 effect 基础值 vs 实际生效值 */
export function computeEffectValuePair(
  config: IItemConfig,
  effect: IItemEffect,
  instance: IItemInstance | null | undefined,
  star: number,
  runtime: ItemDisplayRuntime,
  equippedCount: number,
  enemyPoisonStacks: number,
): IValuePair {
  const base = getBaseStarValue(effect, star);

  if (!BUFF_AFFECTED_TYPES.includes(effect.type)) {
    return toValuePair(base, base);
  }

  let effective = base;
  effective *= getModMultiplier(instance, effect.type, runtime);
  effective *= getHeroMultiplier(config, effect.type, runtime);

  if (effect.type === 'damage' || effect.type === 'dot') {
    effective *= getScalingBonusMultiplier(
      config,
      runtime,
      equippedCount,
      enemyPoisonStacks,
    );
  }

  effective = Math.round(effective * 10) / 10;
  return toValuePair(base, effective);
}

export function toValuePair(base: number, effective: number): IValuePair {
  const roundedBase = Math.round(base * 10) / 10;
  const roundedEffective = Math.round(effective * 10) / 10;
  return {
    base: roundedBase,
    effective: roundedEffective,
    formattedBase: formatDisplayNumber(roundedBase),
    formattedEffective: formatDisplayNumber(roundedEffective),
    highlighted: Math.abs(roundedBase - roundedEffective) > 0.05,
  };
}

/** 基础 CD（含英雄 tool 修正，不含 haste 累计） */
export function computeDisplayBaseCd(
  config: IItemConfig,
  runtime: ItemDisplayRuntime,
): number {
  let cd = config.baseCD;
  if (runtime.heroSystem) {
    cd = runtime.heroSystem.getModifiedCD(config.baseCD, config.tags);
  }
  return Math.round(cd * 10) / 10;
}

/** CD overlay 进度 0~1（1 = 满 CD 待触发） */
export function computeCdProgress(
  instance: IItemInstance,
  baseCd: number,
): number {
  if (baseCd <= 0) {
    return 0;
  }
  const minCd = GAME_CONSTANTS.CD_MIN;
  const atMax = instance.currentCD <= minCd + 0.01;
  if (atMax) {
    return 0;
  }
  return Math.max(0, Math.min(1, instance.currentCD / baseCd));
}

export function isCdAtFloor(instance: IItemInstance): boolean {
  return instance.currentCD <= GAME_CONSTANTS.CD_MIN + 0.01;
}
