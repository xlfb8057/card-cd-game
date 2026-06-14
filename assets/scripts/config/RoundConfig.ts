/**
 * 5 回合流程配置
 */

export const ROUND_ENEMY_IDS: Record<number, string> = {
  1: 'slime',
  2: 'goblin',
  3: 'shadow_wolf',
  4: 'mage',
  5: 'boss_golem',
};

export const TUTORIAL_ITEM_IDS = [
  'pencil_sharpener',
  'spring_fist',
  'lighter',
] as const;

export const MAX_ROUND = 5;

export type RoundType = 'tutorial' | 'normal' | 'elite' | 'boss';

export function getRoundType(round: number): RoundType {
  if (round === 1) {
    return 'tutorial';
  }
  if (round === 4) {
    return 'elite';
  }
  if (round === 5) {
    return 'boss';
  }
  return 'normal';
}

export function getBattleGoldReward(round: number, won: boolean): number {
  if (!won) {
    return 0;
  }
  const base = 5 + round;
  if (getRoundType(round) === 'elite') {
    return base + 3;
  }
  if (getRoundType(round) === 'boss') {
    return base + 10;
  }
  return base;
}
