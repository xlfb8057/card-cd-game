/**
 * 战斗救场上下文适配器
 * 将 BattleSystem 接入 RescueSystem
 */

import { BattleSystem } from './BattleSystem';
import { IRescueBattleContext } from './RescueSystem';
import { IItemInstance } from '../models/ItemInstance';

/**
 * BattleSystem 的救场上下文实现
 */
export class BattleRescueContext implements IRescueBattleContext {
  private _currentRound = 1;

  constructor(private readonly _battle: BattleSystem) {}

  setCurrentRound(round: number): void {
    this._currentRound = round;
  }

  isInBattle(): boolean {
    return this._battle.getState().result === 'ongoing';
  }

  getCurrentRound(): number {
    return this._currentRound;
  }

  applyEmergencyCharge(item: IItemInstance): void {
    this._battle.applyEmergencyCharge(item);
  }

  activateHeroSkill(): boolean {
    return this._battle.activateHeroSkill();
  }

  pauseForReposition(duration: number): void {
    this._battle.pauseForReposition(duration);
  }

  endRepositionPause(): void {
    this._battle.endRepositionPause();
  }

  swapEquipped(posA: number, posB: number): boolean {
    return this._battle.swapEquipped(posA, posB);
  }
}
