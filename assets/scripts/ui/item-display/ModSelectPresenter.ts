/**
 * 改装三选一 ViewModel 构建
 */

import { IModConfig, ModTier } from '../../config/ModConfig';
import { IModCardViewModel } from './cocos/ModSelectPanel';

const TIER_LABELS: Record<ModTier, string> = {
  attribute: '属性',
  mechanism: '机制',
  archetype: '核心',
};

const TIER_UNLOCK_ROUND: Record<ModTier, number> = {
  attribute: 2,
  mechanism: 5,
  archetype: 8,
};

export class ModSelectPresenter {
  buildModCards(choices: IModConfig[], round: number): IModCardViewModel[] {
    return choices.map((mod) => {
      const unlockRound = TIER_UNLOCK_ROUND[mod.tier] ?? 99;
      const locked = round < unlockRound;
      return {
        modId: mod.id,
        name: mod.name,
        tierLabel: TIER_LABELS[mod.tier] ?? mod.tier,
        description: mod.description,
        locked,
        lockHint: locked ? `第 ${unlockRound} 回合解锁` : '',
      };
    });
  }
}

export const modSelectPresenter = new ModSelectPresenter();
