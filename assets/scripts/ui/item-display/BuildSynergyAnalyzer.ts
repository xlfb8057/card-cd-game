/**
 * Build 联动影响分析 — 供 BuildSynergyPanel 展示（§7.2）
 * 数值来自 calcStarValue / HeroSystem / ModSystem，前端不硬编码公式
 */

import { EffectType, IItemConfig, IItemEffect } from '../../config/ItemConfig';
import { ItemDisplayContext } from './ItemDisplayTypes';
import {
  computeEffectValuePair,
  computeDisplayBaseCd,
  getBaseStarValue,
  getHeroMultiplier,
  getModMultiplier,
  getScalingBonusMultiplier,
  resolveDisplayStar,
} from './ItemValueCalculator';
import { formatDisplayNumber } from './RarityDisplayUtil';

export type BuildSynergyGroup =
  | 'hero'
  | 'mod'
  | 'equipment'
  | 'buff'
  | 'base';

export interface IBuildSynergyLine {
  group: BuildSynergyGroup;
  groupLabel: string;
  source: string;
  effect: string;
  baseValue: string;
  effectiveValue: string;
  delta: string;
}

const GROUP_LABELS: Record<BuildSynergyGroup, string> = {
  hero: '英雄被动',
  mod: '改装加成',
  equipment: '其他装备',
  buff: 'Buff 状态',
  base: '基础属性',
};

const PRIMARY_EFFECT_TYPES: EffectType[] = [
  'damage',
  'dot',
  'shield',
  'heal',
  'haste',
  'crit',
  'proc_chance',
];

export class BuildSynergyAnalyzer {
  analyze(ctx: ItemDisplayContext): IBuildSynergyLine[] {
    const config = ctx.runtime.configTable.getItem(ctx.configId);
    if (!config) {
      return [];
    }

    const instance = ctx.instance ?? null;
    const star = resolveDisplayStar(instance, ctx.kind, ctx.codexStar);
    const equipped =
      ctx.runtime.equippedItems ??
      ctx.runtime.inventory?.getAllEquipped() ??
      [];
    const equippedCount = equipped.length;
    const enemyStacks = ctx.runtime.enemyPoisonStacks ?? 0;

    const lines: IBuildSynergyLine[] = [];
    const modTotals = new Map<EffectType, number>();

    for (const effect of config.effects) {
      if (!PRIMARY_EFFECT_TYPES.includes(effect.type)) {
        continue;
      }

      const pair = computeEffectValuePair(
        config,
        effect,
        instance,
        star,
        ctx.runtime,
        equippedCount,
        enemyStacks,
      );

      const baseOnly = getBaseStarValue(effect, star);
      const baseStr = formatDisplayNumber(baseOnly);
      const effStr = pair.formattedEffective;

      lines.push({
        group: 'base',
        groupLabel: GROUP_LABELS.base,
        source: config.name,
        effect: this._effectLabel(effect),
        baseValue: baseStr,
        effectiveValue: effStr,
        delta: formatDisplayNumber(pair.effective - baseOnly),
      });

      this._appendHeroLines(
        lines,
        config,
        effect,
        baseOnly,
        pair.effective,
        ctx,
      );
      this._appendBuffLines(
        lines,
        config,
        effect,
        baseOnly,
        ctx,
      );
      this._accumulateModBonus(
        modTotals,
        instance,
        effect.type,
        ctx,
        baseOnly,
      );
      this._appendScalingLine(
        lines,
        config,
        effect,
        baseOnly,
        ctx,
        equippedCount,
        enemyStacks,
      );
    }

    this._appendModLines(lines, modTotals, config.name);
    this._appendCdLine(lines, config, ctx);
    this._appendEquipmentProcLines(lines, config, ctx, equipped);

    return this._mergeAndSort(lines);
  }

  private _appendHeroLines(
    lines: IBuildSynergyLine[],
    config: IItemConfig,
    effect: IItemEffect,
    baseOnly: number,
    effective: number,
    ctx: ItemDisplayContext,
  ): void {
    const heroSystem = ctx.runtime.heroSystem;
    const hero = heroSystem?.getHero();
    if (!hero) {
      return;
    }

    const mult = getHeroMultiplier(config, effect.type, ctx.runtime);
    if (mult <= 1.001) {
      return;
    }

    const afterHero = Math.round(baseOnly * mult * 10) / 10;
    lines.push({
      group: 'hero',
      groupLabel: GROUP_LABELS.hero,
      source: hero.name,
      effect: this._heroPassiveDesc(hero.passiveConfig.type, config.tags),
      baseValue: formatDisplayNumber(baseOnly),
      effectiveValue: formatDisplayNumber(afterHero),
      delta: formatDisplayNumber(afterHero - baseOnly),
    });
  }

  private _appendBuffLines(
    lines: IBuildSynergyLine[],
    config: IItemConfig,
    effect: IItemEffect,
    baseOnly: number,
    ctx: ItemDisplayContext,
  ): void {
    const heroSystem = ctx.runtime.heroSystem;
    if (!heroSystem) {
      return;
    }

    if (
      heroSystem.getFoodBoostTimer() > 0 &&
      config.tags.includes('food') &&
      ['damage', 'heal', 'shield'].includes(effect.type)
    ) {
      const after = Math.round(baseOnly * 2 * 10) / 10;
      lines.push({
        group: 'buff',
        groupLabel: GROUP_LABELS.buff,
        source: '盛宴/food ×2',
        effect: `${effect.type} 效果翻倍`,
        baseValue: formatDisplayNumber(baseOnly),
        effectiveValue: formatDisplayNumber(after),
        delta: formatDisplayNumber(after - baseOnly),
      });
    }

    if (
      heroSystem.getDotBoostTimer() > 0 &&
      effect.type === 'dot'
    ) {
      const after = Math.round(baseOnly * 2 * 10) / 10;
      lines.push({
        group: 'buff',
        groupLabel: GROUP_LABELS.buff,
        source: '肾上腺素/dot ×2',
        effect: 'DOT 效果翻倍',
        baseValue: formatDisplayNumber(baseOnly),
        effectiveValue: formatDisplayNumber(after),
        delta: formatDisplayNumber(after - baseOnly),
      });
    }
  }

  private _accumulateModBonus(
    totals: Map<EffectType, number>,
    instance: import('../../models/ItemInstance').IItemInstance | null,
    effectType: EffectType,
    ctx: ItemDisplayContext,
    baseOnly: number,
  ): void {
    if (!instance || !ctx.runtime.modSystem) {
      return;
    }
    const mult = getModMultiplier(instance, effectType, ctx.runtime);
    const bonus = mult - 1;
    if (bonus <= 0.001) {
      return;
    }
    totals.set(effectType, (totals.get(effectType) ?? 0) + bonus * baseOnly);
  }

  private _appendModLines(
    lines: IBuildSynergyLine[],
    totals: Map<EffectType, number>,
    itemName: string,
  ): void {
    for (const [effectType, delta] of totals) {
      if (delta <= 0.01) {
        continue;
      }
      lines.push({
        group: 'mod',
        groupLabel: GROUP_LABELS.mod,
        source: '改装合计',
        effect: `${effectType} 属性加成`,
        baseValue: '—',
        effectiveValue: formatDisplayNumber(delta),
        delta: formatDisplayNumber(delta),
      });
    }
  }

  private _appendScalingLine(
    lines: IBuildSynergyLine[],
    config: IItemConfig,
    effect: IItemEffect,
    baseOnly: number,
    ctx: ItemDisplayContext,
    equippedCount: number,
    enemyStacks: number,
  ): void {
    if (effect.type !== 'damage' && effect.type !== 'dot') {
      return;
    }
    const scaleMult = getScalingBonusMultiplier(
      config,
      ctx.runtime,
      equippedCount,
      enemyStacks,
    );
    if (scaleMult <= 1.001) {
      return;
    }
    const after = Math.round(baseOnly * scaleMult * 10) / 10;
    lines.push({
      group: 'equipment',
      groupLabel: GROUP_LABELS.equipment,
      source: 'scaling 联动',
      effect: `×${formatDisplayNumber(scaleMult)}`,
      baseValue: formatDisplayNumber(baseOnly),
      effectiveValue: formatDisplayNumber(after),
      delta: formatDisplayNumber(after - baseOnly),
    });
  }

  private _appendCdLine(
    lines: IBuildSynergyLine[],
    config: IItemConfig,
    ctx: ItemDisplayContext,
  ): void {
    const baseCd = config.baseCD;
    const displayCd = computeDisplayBaseCd(config, ctx.runtime);
    if (Math.abs(baseCd - displayCd) < 0.05) {
      return;
    }
    lines.push({
      group: 'hero',
      groupLabel: GROUP_LABELS.hero,
      source: ctx.runtime.heroSystem?.getHero()?.name ?? '英雄',
      effect: 'tool CD 修正',
      baseValue: `${formatDisplayNumber(baseCd)}s`,
      effectiveValue: `${formatDisplayNumber(displayCd)}s`,
      delta: formatDisplayNumber(displayCd - baseCd),
    });
  }

  private _appendEquipmentProcLines(
    lines: IBuildSynergyLine[],
    config: IItemConfig,
    ctx: ItemDisplayContext,
    equipped: import('../../models/ItemInstance').IItemInstance[],
  ): void {
    for (const item of equipped) {
      if (item.configId === ctx.configId) {
        continue;
      }
      const otherCfg = ctx.runtime.configTable.getItem(item.configId);
      if (!otherCfg) {
        continue;
      }
      const hasProc = otherCfg.effects.some((e) => e.type === 'proc_chance');
      const hasBuff = otherCfg.effects.some(
        (e) => e.type === 'buff_multiplier',
      );
      if (!hasProc && !hasBuff) {
        continue;
      }
      const affects = this._equipmentAffectsItem(otherCfg, config);
      if (!affects) {
        continue;
      }
      lines.push({
        group: 'equipment',
        groupLabel: GROUP_LABELS.equipment,
        source: otherCfg.name,
        effect: hasProc ? '概率联动' : '效果放大',
        baseValue: '—',
        effectiveValue: '联动中',
        delta: '—',
      });
    }
  }

  private _equipmentAffectsItem(
    source: IItemConfig,
    target: IItemConfig,
  ): boolean {
    for (const effect of source.effects) {
      const t = effect.target ?? '';
      if (t.includes('all_food') && target.tags.includes('food')) {
        return true;
      }
      if (t.includes('all_tools') && target.tags.includes('tool')) {
        return true;
      }
      if (t.includes('all_dot') && target.tags.includes('dot')) {
        return true;
      }
      if (effect.type === 'buff_multiplier' && t.includes('food')) {
        return target.tags.includes('food');
      }
    }
    return false;
  }

  private _effectLabel(effect: IItemEffect): string {
    if (effect.desc) {
      const part = effect.desc.split('{')[0].trim();
      if (part) {
        return part;
      }
    }
    return effect.type;
  }

  private _heroPassiveDesc(passiveType: string, tags: string[]): string {
    if (passiveType === 'food_boost' && tags.includes('food')) {
      return 'food 效果 ×1.25';
    }
    if (passiveType === 'dot_boost') {
      return 'dot 效果 ×1.3';
    }
    if (passiveType === 'tool_cd' && tags.includes('tool')) {
      return 'tool CD ×0.8';
    }
    return passiveType;
  }

  /** 同类 mod 归并；base 行保留 */
  private _mergeAndSort(lines: IBuildSynergyLine[]): IBuildSynergyLine[] {
    const order: BuildSynergyGroup[] = [
      'base',
      'hero',
      'mod',
      'equipment',
      'buff',
    ];
    const modMerged = new Map<string, IBuildSynergyLine>();

    const result: IBuildSynergyLine[] = [];
    for (const line of lines) {
      if (line.group === 'mod') {
        const key = line.effect;
        const existing = modMerged.get(key);
        if (existing) {
          const d =
            parseFloat(existing.delta) + parseFloat(line.delta);
          existing.delta = formatDisplayNumber(d);
          existing.effectiveValue = formatDisplayNumber(d);
        } else {
          modMerged.set(key, { ...line });
        }
        continue;
      }
      result.push(line);
    }

    result.push(...modMerged.values());
    result.sort(
      (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
    );
    return result;
  }
}

export const buildSynergyAnalyzer = new BuildSynergyAnalyzer();
