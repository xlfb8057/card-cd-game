/**
 * 效果类型 → 中文名
 */

import { EffectType } from '../../config/ItemConfig';

const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  damage: '伤害',
  dot: '持续伤害',
  self_dot: '自伤',
  shield: '护盾',
  heal: '治疗',
  haste: '加速',
  crit: '暴击',
  freeze: '冻结',
  scaling: '缩放',
  proc_chance: '概率联动',
  unlock_cap: '解除上限',
  cd_break: 'CD 突破',
  buff_multiplier: '效果放大',
  force_cd: '强制 CD',
};

export function getEffectTypeLabel(type: EffectType | string): string {
  return EFFECT_TYPE_LABELS[type as EffectType] ?? type;
}

/** 常见 target 中文（附录 C） */
const TARGET_LABELS: Record<string, string> = {
  enemy: '敌方',
  all_enemy: '所有敌人',
  Random_enemy: '随机敌人',
  self: '自身',
  adjacent: '相邻装备',
  left: '左侧装备',
  right: '右侧装备',
  all_left: '左侧所有装备',
  all_right: '右侧所有装备',
  all_tools: '所有工具',
  all_food: '所有食物',
  all_dot: '所有 DOT 装备',
  all_damage: '所有伤害装备',
  all_shield: '所有护盾装备',
  all_heal: '所有治疗装备',
  adjacent_tools: '相邻工具',
  adjacent_food: '相邻食物',
  adjacent_dot: '相邻 DOT',
  adjacent_damage: '相邻伤害装备',
  adjacent_shield: '相邻护盾装备',
  adjacent_heal: '相邻治疗装备',
  all_self_items: '自身所有装备',
  random_tool: '随机工具',
  random_item: '随机装备',
  enemy_fastest: '敌方最快装备',
  enemy_random: '随机敌人',
  enemy_all: '所有敌人',
};

export function getTargetLabel(target: string): string {
  return TARGET_LABELS[target] ?? target;
}

/** 触发时机中文 */
export function getTriggerLabel(trigger?: string): string {
  if (!trigger || trigger === 'onTrigger') {
    return 'CD 触发';
  }
  if (trigger === 'passive') {
    return '被动';
  }
  if (trigger === 'onPurchase') {
    return '购买时';
  }
  return trigger;
}
