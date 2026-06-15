/**
 * 效果解析器（v3 + P2）
 */

import { IConfigTable } from '../core/ConfigTable';
import {
  EffectTarget,
  EffectType,
  IItemConfig,
  IItemEffect,
  ScalingSource,
} from '../config/ItemConfig';
import { GAME_CONSTANTS } from '../config/GameConstants';
import { IItemInstance } from '../models/ItemInstance';
import { IHeroSystem } from './HeroSystem';
import { IDotSystem } from './DotSystem';
import { ModAttributeBonuses } from './ModSystem';
import { calcStarValue, getEffectStarScale } from '../utils/StarCalculator';
import { TargetResolver } from '../utils/TargetResolver';
import { applyHeal, applyShield } from '../utils/MathUtil';

export interface IEffectBattleContext {
  configTable: IConfigTable;
  heroSystem: IHeroSystem | null;
  dotSystem: IDotSystem;
  getItems(): IItemInstance[];
  getEnemyId(): string;
  isEnemyAlive(): boolean;
  dealDamageToEnemy(sourceId: string, amount: number, isCrit: boolean): void;
  getPlayerHP(): number;
  getPlayerMaxHP(): number;
  getPlayerShield(): number;
  setPlayerHP(hp: number): void;
  setPlayerShield(shield: number): void;
  applyHasteToItems(
    source: IItemInstance,
    amount: number,
    targets: IItemInstance[],
  ): void;
  applyEnemyFreeze(duration: number, target: EffectTarget): void;
  getCDBreakMin(item: IItemInstance): number;
  getDotStacksOnEnemy(): number;
  getTagBuffMultiplier(tags: string[]): number;
  addTagBuff(target: EffectTarget, multiplier: number, duration: number): void;
  rollChance(chance: number): boolean;
  getLastDamageDealt(): number;
  setLastDamageDealt(amount: number): void;
  emitHeal(healed: number, overflow: number, tags: string[]): void;
  emitShield(gained: number, tags: string[]): void;
}

export class EffectResolver {
  static resolve(
    effect: IItemEffect,
    sourceItem: IItemInstance,
    config: IItemConfig,
    ctx: IEffectBattleContext,
    modBonuses: ModAttributeBonuses = {},
    fromMod = false,
  ): void {
    const starScale = getEffectStarScale(effect.starScale);
    const starValue = calcStarValue(effect.value, starScale, sourceItem.star);
    let finalValue = this._applyMultipliers(
      starValue,
      config.tags,
      effect.type,
      ctx,
      modBonuses,
    );

    switch (effect.type) {
      case 'damage':
        this._resolveDamage(finalValue, sourceItem, ctx);
        break;
      case 'dot':
        this._resolveDot(finalValue, effect, sourceItem, ctx);
        break;
      case 'self_dot':
        this._resolveSelfDot(finalValue, effect, sourceItem, ctx);
        break;
      case 'shield':
        this._resolveShield(finalValue, ctx);
        break;
      case 'heal':
        if (fromMod && effect.value > 0 && effect.value <= 1) {
          this._resolveLeechHeal(effect.value, config, ctx);
        } else {
          this._resolveHeal(finalValue, config, ctx);
        }
        break;
      case 'haste':
        this._resolveHaste(finalValue, effect.target, sourceItem, ctx);
        break;
      case 'crit':
        break;
      case 'freeze':
        this._resolveFreeze(effect, starValue, sourceItem, ctx, fromMod);
        break;
      case 'buff_multiplier':
        this._resolveBuffMultiplier(effect, ctx);
        break;
      case 'scaling':
      case 'proc_chance':
      case 'unlock_cap':
      case 'cd_break':
      case 'force_cd':
        break;
      default:
        break;
    }
  }

  static resolveAllEffects(
    sourceItem: IItemInstance,
    config: IItemConfig,
    ctx: IEffectBattleContext,
    modMechanismEffects: IItemEffect[] = [],
    modBonuses: ModAttributeBonuses = {},
  ): void {
    ctx.setLastDamageDealt(0);
    const effects = [...config.effects, ...modMechanismEffects];

    let critMultiplier = 1;
    for (const effect of effects) {
      if (effect.type === 'crit') {
        critMultiplier = calcStarValue(
          effect.value,
          getEffectStarScale(effect.starScale),
          sourceItem.star,
        );
      }
    }

    for (const effect of config.effects) {
      if (effect.type === 'crit' || effect.type === 'proc_chance') {
        continue;
      }
      if (effect.type === 'damage') {
        this._resolveDamageWithCrit(
          effect,
          sourceItem,
          config,
          ctx,
          critMultiplier,
          modBonuses,
        );
      } else {
        this.resolve(effect, sourceItem, config, ctx, modBonuses, false);
      }
    }

    for (const effect of modMechanismEffects) {
      if (effect.type === 'damage') {
        this._resolveDamageWithCrit(
          effect,
          sourceItem,
          config,
          ctx,
          1,
          modBonuses,
        );
      } else {
        this.resolve(effect, sourceItem, config, ctx, modBonuses, true);
      }
    }
  }

  private static _applyMultipliers(
    baseValue: number,
    tags: string[],
    effectType: EffectType,
    ctx: IEffectBattleContext,
    modBonuses: ModAttributeBonuses,
  ): number {
    let value = baseValue;
    const heroMult = ctx.heroSystem
      ? ctx.heroSystem.getEffectMultiplier(tags, effectType)
      : 1;
    value *= heroMult;
    value *= ctx.getTagBuffMultiplier(tags);
    const modBonus = modBonuses[effectType] ?? 0;
    value *= 1 + modBonus;
    return value;
  }

  private static _resolveDamageWithCrit(
    effect: IItemEffect,
    sourceItem: IItemInstance,
    config: IItemConfig,
    ctx: IEffectBattleContext,
    critMultiplier: number,
    modBonuses: ModAttributeBonuses,
  ): void {
    const starValue = calcStarValue(
      effect.value,
      getEffectStarScale(effect.starScale),
      sourceItem.star,
    );
    let finalDamage = this._applyMultipliers(
      starValue,
      config.tags,
      'damage',
      ctx,
      modBonuses,
    );
    finalDamage *= this._calculateGlobalScalingMultiplier(ctx);
    finalDamage *= critMultiplier;

    if (finalDamage > 0 && ctx.isEnemyAlive()) {
      const dealt = Math.floor(finalDamage);
      ctx.dealDamageToEnemy(sourceItem.configId, dealt, critMultiplier > 1);
      ctx.setLastDamageDealt(ctx.getLastDamageDealt() + dealt);
    }
  }

  private static _resolveDamage(
    value: number,
    sourceItem: IItemInstance,
    ctx: IEffectBattleContext,
  ): void {
    let finalDamage = value;
    finalDamage *= this._calculateGlobalScalingMultiplier(ctx);

    if (finalDamage > 0 && ctx.isEnemyAlive()) {
      const dealt = Math.floor(finalDamage);
      ctx.dealDamageToEnemy(sourceItem.configId, dealt, false);
      ctx.setLastDamageDealt(ctx.getLastDamageDealt() + dealt);
    }
  }

  private static _resolveDot(
    value: number,
    effect: IItemEffect,
    sourceItem: IItemInstance,
    ctx: IEffectBattleContext,
  ): void {
    if (!ctx.isEnemyAlive() || !effect.dotType) {
      return;
    }

    let dotValue = value;
    dotValue *= this._calculateGlobalScalingMultiplier(ctx);

    ctx.dotSystem.applyDot(
      ctx.getEnemyId(),
      effect.dotType,
      dotValue,
      effect.duration,
      sourceItem.instanceId,
    );
  }

  private static _resolveSelfDot(
    value: number,
    effect: IItemEffect,
    sourceItem: IItemInstance,
    ctx: IEffectBattleContext,
  ): void {
    const currentHP = ctx.getPlayerHP();
    const selfDamage = Math.floor(currentHP * value);
    const actualDamage = Math.min(
      selfDamage,
      currentHP - GAME_CONSTANTS.ADRENALINE_SELF_DAMAGE_MIN_HP,
    );

    if (actualDamage <= 0) {
      return;
    }

    ctx.setPlayerHP(currentHP - actualDamage);

    if (effect.dotType) {
      ctx.dotSystem.applyDot(
        'player',
        effect.dotType,
        actualDamage,
        effect.duration,
        sourceItem.instanceId,
      );
    }
  }

  private static _resolveShield(value: number, ctx: IEffectBattleContext): void {
    const maxShield = Math.floor(
      ctx.getPlayerMaxHP() * GAME_CONSTANTS.SHIELD_MAX_RATIO,
    );
    const newShield = applyShield(ctx.getPlayerShield(), value, maxShield);
    const gained = newShield - ctx.getPlayerShield();
    ctx.setPlayerShield(newShield);

    if (gained > 0) {
      ctx.emitShield(gained, []);
    }
  }

  private static _resolveHeal(
    value: number,
    config: IItemConfig,
    ctx: IEffectBattleContext,
  ): void {
    const before = ctx.getPlayerHP();
    const maxHP = ctx.getPlayerMaxHP();
    const newHP = applyHeal(before, value, maxHP);
    const healed = newHP - before;
    const overflow = value - healed;
    ctx.setPlayerHP(newHP);

    const hero = ctx.heroSystem?.getHero();
    if (overflow > 0 && hero?.passiveConfig.overflowToShield) {
      const shieldFromOverflow = Math.floor(
        overflow * hero.passiveConfig.overflowToShield,
      );
      this._resolveShield(shieldFromOverflow, ctx);
    }

    ctx.emitHeal(healed, overflow, config.tags);
  }

  private static _resolveLeechHeal(
    ratio: number,
    config: IItemConfig,
    ctx: IEffectBattleContext,
  ): void {
    const leechAmount = Math.floor(ctx.getLastDamageDealt() * ratio);
    if (leechAmount > 0) {
      this._resolveHeal(leechAmount, config, ctx);
    }
  }

  private static _resolveHaste(
    value: number,
    target: EffectTarget,
    sourceItem: IItemInstance,
    ctx: IEffectBattleContext,
  ): void {
    const targets =
      target === 'self'
        ? [sourceItem]
        : TargetResolver.resolve(
            target,
            sourceItem,
            ctx.getItems(),
            ctx.configTable,
          );

    ctx.applyHasteToItems(sourceItem, value, targets);
  }

  private static _resolveFreeze(
    effect: IItemEffect,
    starValue: number,
    sourceItem: IItemInstance,
    ctx: IEffectBattleContext,
    fromMod: boolean,
  ): void {
    if (fromMod && !ctx.rollChance(0.2)) {
      return;
    }

    const baseDuration = effect.duration ?? starValue;
    const duration =
      effect.duration !== undefined && effect.starScale > 0
        ? calcStarValue(
            baseDuration,
            getEffectStarScale(effect.starScale),
            sourceItem.star,
          )
        : baseDuration;

    ctx.applyEnemyFreeze(duration, effect.target);
  }

  private static _resolveBuffMultiplier(
    effect: IItemEffect,
    ctx: IEffectBattleContext,
  ): void {
    const duration = effect.duration ?? 15;
    ctx.addTagBuff(effect.target, effect.value, duration);
  }

  private static _calculateGlobalScalingMultiplier(
    ctx: IEffectBattleContext,
  ): number {
    let bonus = 0;

    for (const item of ctx.getItems()) {
      const cfg = ctx.configTable.getItem(item.configId);
      if (!cfg) {
        continue;
      }

      for (const effect of cfg.effects) {
        if (effect.type !== 'scaling' || !effect.scalingSource) {
          continue;
        }

        const scaledPerUnit = calcStarValue(
          effect.value,
          getEffectStarScale(effect.starScale),
          item.star,
        );

        switch (effect.scalingSource as ScalingSource) {
          case 'item_count':
            bonus += ctx.getItems().length * scaledPerUnit;
            break;
          case 'dot_stacks':
            bonus += ctx.getDotStacksOnEnemy() * scaledPerUnit;
            break;
          default:
            break;
        }
      }
    }

    return 1 + bonus;
  }
}
