/**
 * DOT 结算系统（v3: 每 1 秒 tick 一次）
 */

import { IEventBus } from '../core/EventBus';
import { DotType } from '../config/ItemConfig';
import { GAME_CONSTANTS } from '../config/GameConstants';

/** DOT 运行时状态 */
export interface IDotState {
  dotType: DotType;
  dotValuePerStack: number;
  stacks: number;
  burnRemaining: number;
  sourceInstanceId: string;
}

/** DOT 伤害目标 */
export interface IDotDamageTarget {
  id: string;
  getHP(): number;
  applyDotDamage(amount: number): number;
}

export interface IDotSystemDeps {
  eventBus: IEventBus;
  getDotBoostMod: () => number;
  hasUnlockCap: () => boolean;
  resolveTarget: (targetId: string) => IDotDamageTarget | null;
}

export interface IDotSystem {
  applyDot(
    targetId: string,
    dotType: DotType,
    value: number,
    duration: number | undefined,
    sourceInstanceId: string,
  ): void;
  update(dt: number): void;
  getTotalStacks(targetId: string): number;
  clearAllDots(): void;
}

export class DotSystem implements IDotSystem {
  private readonly _eventBus: IEventBus;
  private readonly _getDotBoostMod: () => number;
  private readonly _hasUnlockCap: () => boolean;
  private readonly _resolveTarget: (targetId: string) => IDotDamageTarget | null;

  private _tickAccumulator = 0;
  private readonly _dotTargets = new Map<string, IDotState[]>();

  constructor(deps: IDotSystemDeps) {
    this._eventBus = deps.eventBus;
    this._getDotBoostMod = deps.getDotBoostMod;
    this._hasUnlockCap = deps.hasUnlockCap;
    this._resolveTarget = deps.resolveTarget;
  }

  applyDot(
    targetId: string,
    dotType: DotType,
    value: number,
    duration: number | undefined,
    sourceInstanceId: string,
  ): void {
    let states = this._dotTargets.get(targetId) ?? [];

    if (dotType === 'poison') {
      const existing = states.find(
        (s) => s.dotType === 'poison' && s.sourceInstanceId === sourceInstanceId,
      );
      const maxStacks = this._hasUnlockCap()
        ? Number.MAX_SAFE_INTEGER
        : GAME_CONSTANTS.DOT_STACK_MAX;

      if (existing) {
        existing.stacks = Math.min(existing.stacks + 1, maxStacks);
      } else {
        states.push({
          dotType: 'poison',
          dotValuePerStack: value,
          stacks: 1,
          burnRemaining: 0,
          sourceInstanceId,
        });
      }
    } else if (dotType === 'burn') {
      const existing = states.find(
        (s) => s.dotType === 'burn' && s.sourceInstanceId === sourceInstanceId,
      );
      const burnDuration = duration ?? 3;

      if (existing) {
        existing.dotValuePerStack = value;
        existing.burnRemaining = burnDuration;
      } else {
        states.push({
          dotType: 'burn',
          dotValuePerStack: value,
          stacks: 1,
          burnRemaining: burnDuration,
          sourceInstanceId,
        });
      }
    }

    this._dotTargets.set(targetId, states);
    this._eventBus.emit('dot_applied', {
      target: targetId,
      dotType,
      stacks: 1,
      value,
    });
  }

  update(dt: number): void {
    this._tickAccumulator += dt;

    if (this._tickAccumulator >= GAME_CONSTANTS.DOT_TICK_INTERVAL) {
      this._tickAccumulator -= GAME_CONSTANTS.DOT_TICK_INTERVAL;
      this._applyAllDOTTicks();
    }
  }

  getTotalStacks(targetId: string): number {
    const states = this._dotTargets.get(targetId) ?? [];
    return states
      .filter((s) => s.dotType === 'poison')
      .reduce((sum, s) => sum + s.stacks, 0);
  }

  clearAllDots(): void {
    this._dotTargets.clear();
    this._tickAccumulator = 0;
  }

  private _applyAllDOTTicks(): void {
    const dotBoostMod = this._getDotBoostMod();

    for (const [targetId, states] of this._dotTargets) {
      const target = this._resolveTarget(targetId);
      if (!target) {
        continue;
      }

      let totalDamage = 0;
      const remainingStates: IDotState[] = [];

      for (const state of states) {
        if (state.dotType === 'poison') {
          totalDamage += state.dotValuePerStack * state.stacks * dotBoostMod;
          state.stacks -= GAME_CONSTANTS.DOT_DECAY_PER_TICK;
          if (state.stacks > 0) {
            remainingStates.push(state);
          }
        } else if (state.dotType === 'burn') {
          totalDamage += state.dotValuePerStack * dotBoostMod;
          state.burnRemaining -= GAME_CONSTANTS.DOT_TICK_INTERVAL;
          if (state.burnRemaining > 0) {
            remainingStates.push(state);
          }
        }
      }

      if (totalDamage > 0) {
        target.applyDotDamage(totalDamage);
        this._eventBus.emit('dot_tick', {
          target: targetId,
          totalDamage,
          dotStates: remainingStates,
        });
      }

      if (remainingStates.length > 0) {
        this._dotTargets.set(targetId, remainingStates);
      } else {
        this._dotTargets.delete(targetId);
      }
    }
  }
}
