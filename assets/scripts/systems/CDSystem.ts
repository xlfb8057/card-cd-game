/**
 * CD 懒更新系统
 * 只遍历 activeItems 中有 CD 的装备，CD 归零时通知可触发
 */

import { IItemInstance } from '../models/ItemInstance';

export interface ICDTickResult {
  readyItems: IItemInstance[];
}

export interface ICDSystem {
  register(item: IItemInstance): void;
  unregister(item: IItemInstance): void;
  update(dt: number): ICDTickResult;
  forceReduceCD(item: IItemInstance, amount: number): void;
  clear(): void;
  getActiveCount(): number;
}

export class CDSystem implements ICDSystem {
  private readonly _activeItems: Set<IItemInstance> = new Set();

  register(item: IItemInstance): void {
    if (item.currentCD > 0) {
      this._activeItems.add(item);
    }
  }

  unregister(item: IItemInstance): void {
    this._activeItems.delete(item);
  }

  update(dt: number): ICDTickResult {
    const readyItems: IItemInstance[] = [];
    const toDelete: IItemInstance[] = [];

    for (const item of Array.from(this._activeItems)) {
      item.tickFreeze(dt);
      if (item.freezeRemaining > 0) {
        continue;
      }

      item.currentCD -= dt;

      if (item.currentCD <= 0) {
        item.currentCD = 0;
        toDelete.push(item);
        readyItems.push(item);
      }
    }

    for (const item of toDelete) {
      this._activeItems.delete(item);
    }

    return { readyItems };
  }

  forceReduceCD(item: IItemInstance, amount: number): void {
    item.currentCD -= amount;

    if (item.currentCD <= 0) {
      item.currentCD = 0;
      this._activeItems.delete(item);
    } else {
      this._activeItems.add(item);
    }
  }

  clear(): void {
    this._activeItems.clear();
  }

  getActiveCount(): number {
    return this._activeItems.size;
  }
}
