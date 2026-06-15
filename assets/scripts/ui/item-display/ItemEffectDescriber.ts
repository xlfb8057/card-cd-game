/**
 * 效果描述拼装 — 方案 A+B（JSON desc + 代码 fallback）
 */

import { IItemEffect, IItemConfig } from '../../config/ItemConfig';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import {
  IEffectDescribeInput,
  IItemEffectLineViewModel,
} from './ItemDisplayTypes';
import {
  getEffectTypeLabel,
  getTargetLabel,
  getTriggerLabel,
} from './EffectTypeRegistry';
import {
  computeEffectValuePair,
  getBaseStarValue,
} from './ItemValueCalculator';
import { formatDisplayNumber } from './RarityDisplayUtil';

const FALLBACK_TEMPLATES: Record<string, string> = {
  damage: '造成 {value} 点直接伤害',
  dot: '每秒 {value} 持续伤害',
  self_dot: '自伤当前生命 {value}%，不会致死',
  shield: '获得 {value} 点护盾',
  heal: '恢复 {value} 点生命值',
  haste: 'CD 减少 {value} 秒',
  crit: '暴击倍率 ×{value}',
  freeze: '冻结敌方最快装备 {duration} 秒',
  scaling: '缩放效果 +{value}',
  proc_chance: '触发时 {value} 概率再触发一次',
  unlock_cap: '解除层数上限',
  cd_break: 'tool 的 CD 可突破至 0.1 秒',
  buff_multiplier: '{duration} 秒内效果 ×{value}',
  force_cd: '强制设置 CD',
};

export class ItemEffectDescriber {
  describeEffect(input: IEffectDescribeInput): IItemEffectLineViewModel {
    const effect = input.config.effects[input.effectIndex];
    if (!effect) {
      return emptyLine();
    }

    const pair = computeEffectValuePair(
      input.config,
      effect,
      input.instance,
      input.star,
      input.runtime,
      input.equippedCount,
      input.enemyPoisonStacks,
    );

    const nextPair =
      input.nextStar !== null && effect.starScale > 0
        ? computeEffectValuePair(
            input.config,
            effect,
            input.instance,
            input.nextStar,
            input.runtime,
            input.equippedCount,
            input.enemyPoisonStacks,
          )
        : null;

    const description = this._buildDescription(input, effect, pair, nextPair);
    const showStarArrow =
      nextPair !== null &&
      effect.starScale > 0 &&
      pair.formattedEffective !== nextPair.formattedEffective;

    return {
      typeLabel: getEffectTypeLabel(effect.type),
      description,
      targetLabel: getTargetLabel(effect.target),
      triggerLabel: getTriggerLabel(effect.trigger),
      showStarArrow,
      currentValueText: pair.formattedEffective,
      nextValueText: nextPair?.formattedEffective ?? '',
      valueHighlighted: pair.highlighted,
      baseValueHint: pair.highlighted ? pair.formattedBase : '',
    };
  }

  describeAllEffects(input: Omit<IEffectDescribeInput, 'effectIndex'>): IItemEffectLineViewModel[] {
    const lines: IItemEffectLineViewModel[] = [];
    const effects = input.config.effects;

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (this._shouldMergeCritDamage(effects, i)) {
        lines.push(this._describeCritDamageCombo(input, i));
        continue;
      }
      if (this._isCritMergedIntoDamage(effects, i)) {
        continue;
      }
      lines.push(this.describeEffect({ ...input, effectIndex: i }));
    }
    return lines;
  }

  private _buildDescription(
    input: IEffectDescribeInput,
    effect: IItemEffect,
    pair: ReturnType<typeof computeEffectValuePair>,
    nextPair: ReturnType<typeof computeEffectValuePair> | null,
  ): string {
    if (effect.type === 'scaling') {
      return this._describeScaling(input, effect);
    }

    const template = effect.desc ?? FALLBACK_TEMPLATES[effect.type] ?? `{type}: {value}`;
    let text = template;

    const placeholders: Record<string, string> = {
      value: pair.formattedEffective,
      valueNext: nextPair?.formattedEffective ?? pair.formattedEffective,
      duration: formatDisplayNumber(effect.duration ?? effect.value),
      CD_MIN: formatDisplayNumber(GAME_CONSTANTS.CD_MIN),
      type: getEffectTypeLabel(effect.type),
    };

    text = this._replacePercentPlaceholder(text, pair.effective);
    text = this._replacePlaceholders(text, placeholders);

    if (showStarArrowInText(input, effect, pair, nextPair)) {
      text = `${pair.formattedEffective} → ${nextPair!.formattedEffective}`;
    }

    return text;
  }

  private _describeScaling(
    input: IEffectDescribeInput,
    effect: IItemEffect,
  ): string {
    const perUnit = formatDisplayNumber(
      getBaseStarValue(effect, input.star),
    );
    const pct = (getBaseStarValue(effect, input.star) * 100).toFixed(1);

    if (effect.scalingSource === 'item_count') {
      const n = input.equippedCount;
      const total = formatDisplayNumber(
        getBaseStarValue(effect, input.star) * n * 100,
      );
      return `场上每多 1 件装备，伤害 +${pct}%。你当前有 ${n} 件，合计约 +${total}%。`;
    }

    if (effect.scalingSource === 'dot_stacks') {
      const m = input.enemyPoisonStacks;
      if (m <= 0 && input.runtime.equippedItems !== undefined) {
        return `敌人每有 1 层中毒，所有 DOT 伤害 +${pct}%。购买后，战斗时按敌人中毒层数计算，每层 +${pct}%。`;
      }
      const total = formatDisplayNumber(
        getBaseStarValue(effect, input.star) * m * 100,
      );
      return `敌人每有 1 层中毒，所有 DOT 伤害 +${pct}%。当前约 ${m} 层，合计约 +${total}%。`;
    }

    return effect.desc ?? `缩放 +${perUnit}`;
  }

  private _describeCritDamageCombo(
    input: Omit<IEffectDescribeInput, 'effectIndex'>,
    damageIndex: number,
  ): IItemEffectLineViewModel {
    const damageEffect = input.config.effects[damageIndex];
    const critEffect = input.config.effects.find((e) => e.type === 'crit');
    const damagePair = computeEffectValuePair(
      input.config,
      damageEffect,
      input.instance,
      input.star,
      input.runtime,
      input.equippedCount,
      input.enemyPoisonStacks,
    );
    const critVal = critEffect
      ? computeEffectValuePair(
          input.config,
          critEffect,
          input.instance,
          input.star,
          input.runtime,
          input.equippedCount,
          input.enemyPoisonStacks,
        ).effective
      : 1;
    const critDamage = formatDisplayNumber(damagePair.effective * critVal);

    return {
      typeLabel: '伤害',
      description: `暴击倍率 ×${formatDisplayNumber(critVal)}；造成 ${damagePair.formattedEffective} 点伤害，暴击时约 ${critDamage} 点。`,
      targetLabel: getTargetLabel(damageEffect.target),
      triggerLabel: getTriggerLabel(damageEffect.trigger),
      showStarArrow: false,
      currentValueText: damagePair.formattedEffective,
      nextValueText: '',
      valueHighlighted: damagePair.highlighted,
      baseValueHint: damagePair.highlighted ? damagePair.formattedBase : '',
    };
  }

  private _shouldMergeCritDamage(effects: IItemEffect[], index: number): boolean {
    const effect = effects[index];
    return effect.type === 'damage' && effects.some((e) => e.type === 'crit');
  }

  private _isCritMergedIntoDamage(effects: IItemEffect[], index: number): boolean {
    const effect = effects[index];
    return effect.type === 'crit' && effects.some((e) => e.type === 'damage');
  }

  private _replacePercentPlaceholder(text: string, value: number): string {
    const pct = Math.round(value * 100).toString();
    return text
      .replace(/\{value×100\}/g, pct)
      .replace(/\{value\*100\}/g, pct);
  }

  private _replacePlaceholders(
    text: string,
    map: Record<string, string>,
  ): string {
    let result = text;
    for (const [key, val] of Object.entries(map)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    return result;
  }
}

function showStarArrowInText(
  input: IEffectDescribeInput,
  effect: IItemEffect,
  pair: ReturnType<typeof computeEffectValuePair>,
  nextPair: ReturnType<typeof computeEffectValuePair> | null,
): boolean {
  if (!nextPair || effect.starScale <= 0) {
    return false;
  }
  return pair.formattedEffective !== nextPair.formattedEffective;
}

function emptyLine(): IItemEffectLineViewModel {
  return {
    typeLabel: '',
    description: '',
    targetLabel: '',
    triggerLabel: '',
    showStarArrow: false,
    currentValueText: '',
    nextValueText: '',
    valueHighlighted: false,
    baseValueHint: '',
  };
}

export const itemEffectDescriber = new ItemEffectDescriber();
