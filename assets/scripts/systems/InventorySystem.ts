/**
 * 背包与装备栏系统
 * 6 格装备栏 + 背包，购买/装备/回收
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { IEconomySystem } from './EconomySystem';
import {
  ItemInstance,
  IItemInstance,
  ICreateItemParams,
  itemToSnapshot,
  syncInstanceIdCounterFromSave,
} from '../models/ItemInstance';
import { ISnapshotItem } from '../models/GameSnapshot';

/** 回收类型 */
export type RecycleType = 'sell' | 'dismantle' | 'discard';

/** 回收结果 */
export interface IRecycleResult {
  type: RecycleType;
  goldGained: number;
  fragmentsGained: number;
}

/** InventorySystem 对外接口 */
export interface IInventorySystem {
  getEquipped(position: number): IItemInstance | undefined;
  getAllEquipped(): IItemInstance[];
  getBackpack(): IItemInstance[];
  isEquipSlotFull(): boolean;
  hasEmptySlot(): boolean;
  getFirstEmptySlot(): number;
  addToInventory(item: IItemInstance): boolean;
  equipFromBackpack(item: IItemInstance, position: number): boolean;
  equipAt(item: IItemInstance, position: number): boolean;
  swapEquipped(fromPos: number, toPos: number): boolean;
  recycleItem(
    item: IItemInstance,
    from: 'equipped' | 'backpack',
    type: RecycleType,
  ): IRecycleResult;
  findMergeTarget(configId: string): IItemInstance | null;
  mergeStarUp(item: IItemInstance): boolean;
  createItemInstance(
    configId: string,
    purchasePrice: number,
    position?: number,
  ): IItemInstance | null;
  restoreFromSnapshot(
    equipped: ISnapshotItem[],
    backpack: ISnapshotItem[],
  ): void;
  clearAll(): void;
  toSnapshot(): { equipped: ISnapshotItem[]; backpack: ISnapshotItem[] };
}

const SLOT_COUNT = 6;

/**
 * 背包与装备栏管理
 */
export class InventorySystem implements IInventorySystem {
  private readonly _equipped: Array<IItemInstance | null> =
    new Array(SLOT_COUNT).fill(null);
  private readonly _backpack: IItemInstance[] = [];

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _configTable: IConfigTable,
    private readonly _economy: IEconomySystem,
  ) {}

  getEquipped(position: number): IItemInstance | undefined {
    if (position < 0 || position >= SLOT_COUNT) {
      return undefined;
    }
    return this._equipped[position] ?? undefined;
  }

  getAllEquipped(): IItemInstance[] {
    return this._equipped.filter(
      (item): item is IItemInstance => item !== null,
    );
  }

  getBackpack(): IItemInstance[] {
    return [...this._backpack];
  }

  isEquipSlotFull(): boolean {
    return this.getAllEquipped().length >= SLOT_COUNT;
  }

  hasEmptySlot(): boolean {
    return this.getAllEquipped().length < SLOT_COUNT;
  }

  getFirstEmptySlot(): number {
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (!this._equipped[i]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 添加装备：有空位则装备，否则进背包
   */
  addToInventory(item: IItemInstance): boolean {
    const emptySlot = this.getFirstEmptySlot();
    if (emptySlot >= 0) {
      return this.equipAt(item, emptySlot);
    }
    this._backpack.push(item);
    this._eventBus.emit('item_to_backpack', { itemId: item.configId });
    return true;
  }

  /** 从背包装备到指定格（可替换） */
  equipFromBackpack(item: IItemInstance, position: number): boolean {
    if (position < 0 || position >= SLOT_COUNT) {
      return false;
    }

    const idx = this._backpack.findIndex(
      (i) => i.instanceId === item.instanceId,
    );
    if (idx < 0) {
      return false;
    }

    this._backpack.splice(idx, 1);
    const displaced = this._equipped[position];
    if (displaced) {
      this._backpack.push(displaced);
    }

    item.position = position;
    this._equipped[position] = item;
    this._eventBus.emit('item_equipped', {
      itemId: item.configId,
      position,
    });
    return true;
  }

  equipAt(item: IItemInstance, position: number): boolean {
    if (position < 0 || position >= SLOT_COUNT) {
      return false;
    }

    const displaced = this._equipped[position];
    if (displaced) {
      this._backpack.push(displaced);
    }

    item.position = position;
    this._equipped[position] = item;
    this._eventBus.emit('item_equipped', {
      itemId: item.configId,
      position,
    });
    return true;
  }

  swapEquipped(fromPos: number, toPos: number): boolean {
    if (
      fromPos < 0 ||
      fromPos >= SLOT_COUNT ||
      toPos < 0 ||
      toPos >= SLOT_COUNT
    ) {
      return false;
    }

    const a = this._equipped[fromPos];
    const b = this._equipped[toPos];
    this._equipped[fromPos] = b;
    this._equipped[toPos] = a;

    if (a) {
      a.position = toPos;
    }
    if (b) {
      b.position = fromPos;
    }

    this._eventBus.emit('items_swapped', { fromPos, toPos });
    return true;
  }

  /** 回收：出售 / 拆解 / 删除（三按钮独立） */
  recycleItem(
    item: IItemInstance,
    from: 'equipped' | 'backpack',
    type: RecycleType,
  ): IRecycleResult {
    const config = this._configTable.getItem(item.configId);
    if (!config) {
      return { type, goldGained: 0, fragmentsGained: 0 };
    }

    this._removeItem(item, from);

    let goldGained = 0;
    let fragmentsGained = 0;

    switch (type) {
      case 'sell':
        goldGained = this._economy.sellItem(item, config);
        break;
      case 'dismantle':
        fragmentsGained = this._economy.dismantleItem(config);
        break;
      case 'discard':
        this._eventBus.emit('item_discarded', { itemId: item.configId });
        break;
    }

    return { type, goldGained, fragmentsGained };
  }

  /** 查找可升星合并的同 id 装备（未满星） */
  findMergeTarget(configId: string): IItemInstance | null {
    for (const item of this._equipped) {
      if (item && this._canMerge(item, configId)) {
        return item;
      }
    }
    for (const item of this._backpack) {
      if (this._canMerge(item, configId)) {
        return item;
      }
    }
    return null;
  }

  /** v3: 重复购买同 id 时 star+1，保留 instanceId 与 currentCD */
  mergeStarUp(item: IItemInstance): boolean {
    const config = this._configTable.getItem(item.configId);
    if (!config) {
      return false;
    }
    const maxStar = config.maxStar ?? 3;
    if (item.star >= maxStar) {
      return false;
    }
    item.star += 1;
    this._eventBus.emit('item_star_merged', {
      itemId: item.configId,
      instanceId: item.instanceId,
      star: item.star,
    });
    return true;
  }

  createItemInstance(
    configId: string,
    purchasePrice: number,
    position = -1,
  ): IItemInstance | null {
    const config = this._configTable.getItem(configId);
    if (!config) {
      return null;
    }

    const params: ICreateItemParams = {
      configId,
      position: position >= 0 ? position : 0,
      baseCD: config.baseCD,
      purchasePrice,
    };
    return new ItemInstance(params);
  }

  restoreFromSnapshot(
    equipped: ISnapshotItem[],
    backpack: ISnapshotItem[],
  ): void {
    this.clearAll();
    syncInstanceIdCounterFromSave([...equipped, ...backpack]);

    for (const data of equipped) {
      const item = this._itemFromSnapshot(data);
      if (item && data.position >= 0 && data.position < SLOT_COUNT) {
        this._equipped[data.position] = item;
      }
    }

    for (const data of backpack) {
      const item = this._itemFromSnapshot(data);
      if (item) {
        this._backpack.push(item);
      }
    }
  }

  clearAll(): void {
    this._equipped.fill(null);
    this._backpack.length = 0;
  }

  toSnapshot(): { equipped: ISnapshotItem[]; backpack: ISnapshotItem[] } {
    return {
      equipped: this.getAllEquipped().map(itemToSnapshot),
      backpack: this.getBackpack().map(itemToSnapshot),
    };
  }

  private _canMerge(item: IItemInstance, configId: string): boolean {
    if (item.configId !== configId) {
      return false;
    }
    const config = this._configTable.getItem(configId);
    const maxStar = config?.maxStar ?? 3;
    return item.star < maxStar;
  }

  private _itemFromSnapshot(data: ISnapshotItem): IItemInstance | null {
    const config = this._configTable.getItem(data.configId);
    if (!config) {
      return null;
    }

    const item = new ItemInstance({
      configId: data.configId,
      instanceId: data.instanceId,
      position: data.position,
      baseCD: data.currentCD,
      star: data.star,
      mods: [...data.mods],
      purchasePrice: data.purchasePrice,
    });

    item.currentCD = data.currentCD;
    return item;
  }

  private _removeItem(
    item: IItemInstance,
    from: 'equipped' | 'backpack',
  ): void {
    if (from === 'backpack') {
      const idx = this._backpack.findIndex(
        (i) => i.instanceId === item.instanceId,
      );
      if (idx >= 0) {
        this._backpack.splice(idx, 1);
      }
      return;
    }

    const pos = this._equipped.findIndex(
      (i) => i?.instanceId === item.instanceId,
    );
    if (pos >= 0) {
      this._equipped[pos] = null;
    }
  }
}
