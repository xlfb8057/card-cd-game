/**
 * 触发概率系统（v3: proc_chance）
 * 姜饼小屋：food 触发时概率额外触发；改装「共鸣」：相邻触发时概率联动
 */

import { IConfigTable } from '../core/ConfigTable';
import { IItemConfig, IItemEffect } from '../config/ItemConfig';
import { IItemInstance } from '../models/ItemInstance';
import { IModSystem } from './ModSystem';
import { calcStarValue, getEffectStarScale } from '../utils/StarCalculator';
import { TargetResolver } from '../utils/TargetResolver';

export interface IProcChanceSystem {
  onItemTriggered(
    triggeredItem: IItemInstance,
    allItems: IItemInstance[],
    extraTrigger: (item: IItemInstance) => void,
  ): void;
}

export class ProcChanceSystem implements IProcChanceSystem {
  constructor(
    private readonly _configTable: IConfigTable,
    private readonly _modSystem: IModSystem,
    private readonly _rng: () => number = Math.random,
  ) {}

  onItemTriggered(
    triggeredItem: IItemInstance,
    allItems: IItemInstance[],
    extraTrigger: (item: IItemInstance) => void,
  ): void {
    for (const listener of allItems) {
      const listenerCfg = this._configTable.getItem(listener.configId);
      if (!listenerCfg) {
        continue;
      }

      const procEffects = this._collectProcEffects(listener, listenerCfg);

      for (const proc of procEffects) {
        if (!this._procMatchesTarget(proc, triggeredItem, listener, allItems)) {
          continue;
        }

        const chance = calcStarValue(
          proc.value,
          getEffectStarScale(proc.starScale),
          proc.ownerStar,
        );

        if (this._rng() < chance) {
          const targetItem = this._resolveProcTarget(
            proc,
            triggeredItem,
            listener,
          );
          if (targetItem) {
            extraTrigger(targetItem);
          }
        }
      }
    }
  }

  private _collectProcEffects(
    item: IItemInstance,
    config: IItemConfig,
  ): Array<IItemEffect & { ownerStar: number }> {
    const list: Array<IItemEffect & { ownerStar: number }> = [];

    for (const effect of config.effects) {
      if (effect.type === 'proc_chance') {
        list.push({ ...effect, ownerStar: item.star });
      }
    }

    if (item.star >= 3) {
      for (const modEffect of this._modSystem.getModMechanismEffects(item)) {
        if (modEffect.type === 'proc_chance') {
          list.push({ ...modEffect, ownerStar: item.star });
        }
      }
    }

    return list;
  }

  private _procMatchesTarget(
    proc: IItemEffect,
    triggeredItem: IItemInstance,
    listener: IItemInstance,
    allItems: IItemInstance[],
  ): boolean {
    if (proc.target === 'all_food' || proc.target === 'all_tools') {
      const targets = TargetResolver.resolve(
        proc.target,
        listener,
        allItems,
        this._configTable,
      );
      return targets.some((t) => t.instanceId === triggeredItem.instanceId);
    }

    if (proc.target === 'adjacent' || proc.target === 'adjacent_food') {
      if (triggeredItem.instanceId === listener.instanceId) {
        return false;
      }
      const adjacent = TargetResolver.resolve(
        proc.target === 'adjacent_food' ? 'adjacent_food' : 'adjacent',
        listener,
        allItems,
        this._configTable,
      );
      return adjacent.some((t) => t.instanceId === triggeredItem.instanceId);
    }

    return triggeredItem.instanceId === listener.instanceId;
  }

  private _resolveProcTarget(
    proc: IItemEffect,
    triggeredItem: IItemInstance,
    listener: IItemInstance,
  ): IItemInstance | null {
    if (proc.target === 'adjacent' || proc.target === 'adjacent_food') {
      return listener;
    }

    if (proc.target === 'all_food' || proc.target === 'all_tools') {
      return triggeredItem;
    }

    return triggeredItem;
  }
}
