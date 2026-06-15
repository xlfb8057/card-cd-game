/**
 * 经济系统
 * 工资、连胜/连败奖励、金币与碎片管理
 */

import { IEventBus } from '../core/EventBus';
import { IItemConfig, ItemRarity } from '../config/ItemConfig';
import { IItemInstance } from '../models/ItemInstance';

/** 基础工资（金/回合） */
export const BASE_WAGE = 5;

/** 出售价格比例 */
export const SELL_RATIO = 0.7;

/** 碎片产出（v3 品质） */
export const FRAGMENTS_BY_RARITY: Record<ItemRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
};

/** EconomySystem 对外接口 */
export interface IEconomySystem {
  readonly currentGold: number;
  readonly winStreak: number;
  readonly loseStreak: number;
  readonly fragments: number;
  addWage(round: number): number;
  addWinStreakBonus(): number;
  addLoseStreakCompensation(): number;
  settleRound(round: number, won: boolean): number;
  spendGold(amount: number): boolean;
  addGold(amount: number): void;
  sellItem(item: IItemInstance, config: IItemConfig): number;
  dismantleItem(config: IItemConfig): number;
  getSellPrice(purchasePrice: number): number;
  restoreEconomy(
    gold: number,
    fragments: number,
    winStreak: number,
    loseStreak: number,
  ): void;
}

/**
 * 经济系统实现
 */
export class EconomySystem implements IEconomySystem {
  private _currentGold = 0;
  private _winStreak = 0;
  private _loseStreak = 0;
  private _fragments = 0;

  constructor(private readonly _eventBus: IEventBus) {}

  get currentGold(): number {
    return this._currentGold;
  }

  get winStreak(): number {
    return this._winStreak;
  }

  get loseStreak(): number {
    return this._loseStreak;
  }

  get fragments(): number {
    return this._fragments;
  }

  /** 设置金币（读档/初始化用） */
  setGold(amount: number): void {
    this._currentGold = Math.max(0, amount);
    this._emitGoldChanged();
  }

  /** 基础工资 5 金 */
  addWage(_round: number): number {
    this._addGoldInternal(BASE_WAGE);
    return BASE_WAGE;
  }

  /** 连胜奖励：2 回合 +1，4 回合 +2，6 回合 +3 */
  addWinStreakBonus(): number {
    const bonus = this._getStreakBonus(this._winStreak, [2, 4, 6], [1, 2, 3]);
    if (bonus > 0) {
      this._addGoldInternal(bonus);
    }
    return bonus;
  }

  /** 连败补偿：2 回合 +1，4 回合 +2 */
  addLoseStreakCompensation(): number {
    const bonus = this._getStreakBonus(this._loseStreak, [2, 4], [1, 2]);
    if (bonus > 0) {
      this._addGoldInternal(bonus);
    }
    return bonus;
  }

  /** 回合结算：工资 + 连胜/连败，并更新 streak */
  settleRound(round: number, won: boolean): number {
    let total = this.addWage(round);

    if (won) {
      this._winStreak++;
      this._loseStreak = 0;
      total += this.addWinStreakBonus();
    } else {
      this._loseStreak++;
      this._winStreak = 0;
      total += this.addLoseStreakCompensation();
    }

    this._eventBus.emit('round_settled', {
      round,
      won,
      goldGained: total,
      gold: this._currentGold,
    });

    return total;
  }

  spendGold(amount: number): boolean {
    if (amount <= 0 || this._currentGold < amount) {
      return false;
    }
    this._currentGold -= amount;
    this._emitGoldChanged();
    return true;
  }

  addGold(amount: number): void {
    if (amount <= 0) {
      return;
    }
    this._addGoldInternal(amount);
  }

  /** 出售：买入价 × 0.7 向下取整，至少 1 金 */
  sellItem(item: IItemInstance, _config: IItemConfig): number {
    const price = this.getSellPrice(item.purchasePrice);
    this._addGoldInternal(price);
    this._eventBus.emit('item_sold', {
      itemId: item.configId,
      gold: price,
    });
    return price;
  }

  getSellPrice(purchasePrice: number): number {
    if (purchasePrice <= 0) {
      return 1;
    }
    return Math.max(1, Math.floor(purchasePrice * SELL_RATIO));
  }

  restoreEconomy(
    gold: number,
    fragments: number,
    winStreak: number,
    loseStreak: number,
  ): void {
    this._currentGold = gold;
    this._fragments = fragments;
    this._winStreak = winStreak;
    this._loseStreak = loseStreak;
    this._emitGoldChanged();
  }

  /** 拆解：按稀有度得碎片 */
  dismantleItem(config: IItemConfig): number {
    const gained = FRAGMENTS_BY_RARITY[config.rarity] ?? 1;
    this._fragments += gained;
    this._eventBus.emit('item_dismantled', {
      itemId: config.id,
      fragments: gained,
      totalFragments: this._fragments,
    });
    return gained;
  }

  private _addGoldInternal(amount: number): void {
    this._currentGold += amount;
    this._emitGoldChanged();
  }

  private _emitGoldChanged(): void {
    this._eventBus.emit('gold_changed', { gold: this._currentGold });
  }

  private _getStreakBonus(
    streak: number,
    thresholds: number[],
    bonuses: number[],
  ): number {
    let bonus = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (streak >= thresholds[i]) {
        bonus = bonuses[i];
        break;
      }
    }
    return bonus;
  }
}
