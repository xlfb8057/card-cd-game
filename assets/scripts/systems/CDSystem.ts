/**
 * CD 懒更新系统
 * 只遍历 activeItems 中有 CD 的装备，CD 归零时通知可触发
 */

import { IItemInstance } from '../models/ItemInstance';

/** CD 更新结果 */
export interface ICDTickResult {
  /** 本帧 CD 归零、可触发的装备 */
  readyItems: IItemInstance[];
}

/** CDSystem 对外接口 */
export interface ICDSystem {
  register(item: IItemInstance): void;
  unregister(item: IItemInstance): void;
  update(dt: number): ICDTickResult;
  forceReduceCD(item: IItemInstance, amount: number): void;
  clear(): void;
  getActiveCount(): number;
}

/**
 * CD 懒更新实现
 * 仅维护 currentCD > 0 的装备集合，减少每帧遍历开销
 */
export class CDSystem implements ICDSystem {
  private readonly _activeItems: Set<IItemInstance> = new Set();

  /** 注册装备到 CD 追踪（currentCD > 0 时） */
  register(item: IItemInstance): void {
    if (item.currentCD > 0) {
      this._activeItems.add(item);
    }
  }

  /** 从 CD 追踪中移除 */
  unregister(item: IItemInstance): void {
    this._activeItems.delete(item);
  }

  /**
   * 懒更新：只遍历 activeItems
   * CD 归零的装备移出 Set 并加入 readyItems
   */
  update(dt: number): ICDTickResult {
    const readyItems: IItemInstance[] = [];
    const toDelete: IItemInstance[] = [];

    for (const item of Array.from(this._activeItems)) {
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

  /**
   * 外部强制减少 CD（加速 / 救场充能）
   * 若减后仍 > 0 则确保在 activeItems 中；若 <= 0 则移出
   */
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
