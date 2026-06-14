/**
 * 救场系统
 * 紧急充能、手动超载、时停调整
 */

import { IEventBus } from '../core/EventBus';
import { IItemInstance } from '../models/ItemInstance';
import { IHero } from '../models/Hero';

/** 救场技能剩余次数 */
export interface IRescueUses {
  charge: number;
  overload: number;
  reposition: number;
}

/** 救场冷却（秒） */
export interface IRescueCooldowns {
  charge: number;
}

/** 战斗场景救场上下文 */
export interface IRescueBattleContext {
  isInBattle(): boolean;
  getCurrentRound(): number;
  applyEmergencyCharge(item: IItemInstance): void;
  activateHeroSkill(): boolean;
  pauseForReposition(duration: number): void;
  endRepositionPause(): void;
  swapEquipped(posA: number, posB: number): boolean;
}

/** 按钮状态 */
export type RescueButtonState = 'available' | 'cooldown' | 'hidden' | 'disabled';

/** RescueSystem 对外接口 */
export interface IRescueSystem {
  setInBattle(inBattle: boolean): void;
  resetForBattle(): void;
  update(dt: number): void;
  useCharge(item: IItemInstance): boolean;
  useOverload(hero: IHero): boolean;
  useReposition(): boolean;
  getUses(): Readonly<IRescueUses>;
  getCooldowns(): Readonly<IRescueCooldowns>;
  isRepositionActive(): boolean;
  getRepositionSwapRemaining(): number;
  tryRepositionSwap(posA: number, posB: number): boolean;
  getChargeButtonState(): RescueButtonState;
  getOverloadButtonState(): RescueButtonState;
  getRepositionButtonState(round: number): RescueButtonState;
}

const CHARGE_COOLDOWN = 10;
const REPOSITION_PAUSE = 3;
const REPOSITION_UNLOCK_ROUND = 6;
const MAX_REPOSITION_SWAPS = 2;

const DEFAULT_USES: IRescueUses = {
  charge: 2,
  overload: 1,
  reposition: 1,
};

/**
 * 救场系统实现
 */
export class RescueSystem implements IRescueSystem {
  private _uses: IRescueUses = { ...DEFAULT_USES };
  private _cooldowns: IRescueCooldowns = { charge: 0 };
  private _repositionActive = false;
  private _repositionTimer = 0;
  private _repositionSwapsLeft = 0;
  private _inBattle = false;

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _context: IRescueBattleContext,
  ) {}

  setInBattle(inBattle: boolean): void {
    this._inBattle = inBattle;
  }

  resetForBattle(): void {
    this._uses = { ...DEFAULT_USES };
    this._cooldowns = { charge: 0 };
    this._repositionActive = false;
    this._repositionTimer = 0;
    this._repositionSwapsLeft = 0;
  }

  update(dt: number): void {
    if (this._cooldowns.charge > 0) {
      this._cooldowns.charge = Math.max(0, this._cooldowns.charge - dt);
    }

    if (this._repositionActive) {
      this._repositionTimer -= dt;
      if (this._repositionTimer <= 0) {
        this._endReposition();
      }
    }
  }

  useCharge(item: IItemInstance): boolean {
    if (!this._canUseInBattle()) {
      return false;
    }
    if (this._uses.charge <= 0 || this._cooldowns.charge > 0) {
      return false;
    }

    this._uses.charge--;
    this._cooldowns.charge = CHARGE_COOLDOWN;
    this._context.applyEmergencyCharge(item);

    this._eventBus.emit('rescue_charge_used', {
      itemId: item.configId,
      newCD: item.currentCD,
      usesLeft: this._uses.charge,
    });

    return true;
  }

  useOverload(hero: IHero): boolean {
    if (!this._canUseInBattle()) {
      return false;
    }
    if (this._uses.overload <= 0) {
      return false;
    }

    const ok = this._context.activateHeroSkill();
    if (!ok) {
      return false;
    }

    this._uses.overload--;
    this._eventBus.emit('rescue_overload_used', {
      heroId: hero.id,
      usesLeft: this._uses.overload,
    });

    return true;
  }

  useReposition(): boolean {
    if (!this._canUseInBattle()) {
      return false;
    }
    if (this._uses.reposition <= 0) {
      return false;
    }

    const round = this._context.getCurrentRound();
    if (round < REPOSITION_UNLOCK_ROUND) {
      return false;
    }

    this._uses.reposition--;
    this._repositionActive = true;
    this._repositionTimer = REPOSITION_PAUSE;
    this._repositionSwapsLeft = MAX_REPOSITION_SWAPS;

    this._context.pauseForReposition(REPOSITION_PAUSE);
    this._eventBus.emit('pause_battle_3s', { duration: REPOSITION_PAUSE });

    return true;
  }

  getUses(): Readonly<IRescueUses> {
    return { ...this._uses };
  }

  getCooldowns(): Readonly<IRescueCooldowns> {
    return { ...this._cooldowns };
  }

  isRepositionActive(): boolean {
    return this._repositionActive;
  }

  getRepositionSwapRemaining(): number {
    return this._repositionSwapsLeft;
  }

  tryRepositionSwap(posA: number, posB: number): boolean {
    if (!this._repositionActive || this._repositionSwapsLeft <= 0) {
      return false;
    }

    const ok = this._context.swapEquipped(posA, posB);
    if (ok) {
      this._repositionSwapsLeft--;
      this._eventBus.emit('rescue_reposition_swap', {
        posA,
        posB,
        remaining: this._repositionSwapsLeft,
      });
    }
    return ok;
  }

  getChargeButtonState(): RescueButtonState {
    if (this._uses.charge <= 0) {
      return 'hidden';
    }
    if (this._cooldowns.charge > 0) {
      return 'cooldown';
    }
    return 'available';
  }

  getOverloadButtonState(): RescueButtonState {
    if (this._uses.overload <= 0) {
      return 'hidden';
    }
    return 'available';
  }

  getRepositionButtonState(round: number): RescueButtonState {
    if (round < REPOSITION_UNLOCK_ROUND) {
      return 'disabled';
    }
    if (this._uses.reposition <= 0) {
      return 'hidden';
    }
    return 'available';
  }

  private _canUseInBattle(): boolean {
    return this._inBattle && this._context.isInBattle();
  }

  private _endReposition(): void {
    this._repositionActive = false;
    this._repositionTimer = 0;
    this._repositionSwapsLeft = 0;
    this._context.endRepositionPause();
    this._eventBus.emit('rescue_reposition_end', {});
  }
}
