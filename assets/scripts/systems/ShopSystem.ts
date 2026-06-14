/**
 * 商店系统
 * 刷新、购买、按回合解锁装备池
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { IItemConfig } from '../config/ItemConfig';
import { IItemInstance } from '../models/ItemInstance';
import { IEconomySystem } from './EconomySystem';
import { IInventorySystem } from './InventorySystem';

/** 商店商品槽 */
export interface IShopSlot {
  index: number;
  configId: string;
  config: IItemConfig;
  sold: boolean;
}

/** 购买结果 */
export interface IBuyResult {
  success: boolean;
  item?: IItemInstance;
  reason?: 'sold_out' | 'no_gold' | 'invalid_index' | 'no_config';
}

/** ShopSystem 对外接口 */
export interface IShopSystem {
  readonly currentItems: IShopSlot[];
  readonly refreshCount: number;
  readonly currentRound: number;
  openShop(round: number): void;
  refreshShop(round: number): boolean;
  buyItem(index: number): IBuyResult;
  getPoolByRound(round: number): string[];
  getRefreshCost(): number;
}

const SHOP_SIZE = 6;
const REFRESH_COST = 2;

/**
 * 商店系统实现
 */
export class ShopSystem implements IShopSystem {
  private _currentItems: IShopSlot[] = [];
  private _refreshCount = 0;
  private _currentRound = 1;
  private readonly _rng: () => number;

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _configTable: IConfigTable,
    private readonly _economy: IEconomySystem,
    private readonly _inventory: IInventorySystem,
    rng: () => number = Math.random,
  ) {
    this._rng = rng;
  }

  get currentItems(): IShopSlot[] {
    return this._currentItems;
  }

  get refreshCount(): number {
    return this._refreshCount;
  }

  get currentRound(): number {
    return this._currentRound;
  }

  openShop(round: number): void {
    this._currentRound = round;
    this._refreshCount = 0;
    this._generateShop(round);
    this._eventBus.emit('shop_opened', { round, items: this._currentItems });
  }

  refreshShop(round: number): boolean {
    const cost = this.getRefreshCost();
    if (cost > 0 && !this._economy.spendGold(cost)) {
      return false;
    }

    this._refreshCount++;
    this._currentRound = round;
    this._generateShop(round);
    this._eventBus.emit('shop_refreshed', {
      round,
      cost,
      refreshCount: this._refreshCount,
    });
    return true;
  }

  getRefreshCost(): number {
    return this._refreshCount === 0 ? 0 : REFRESH_COST;
  }

  buyItem(index: number): IBuyResult {
    const slot = this._currentItems[index];
    if (!slot || slot.sold) {
      return { success: false, reason: 'sold_out' };
    }

    const config = slot.config;
    if (!this._economy.spendGold(config.price)) {
      return { success: false, reason: 'no_gold' };
    }

    const item = this._inventory.createItemInstance(config.id, config.price);
    if (!item) {
      this._economy.addGold(config.price);
      return { success: false, reason: 'no_config' };
    }

    const wasFull = this._inventory.isEquipSlotFull();
    this._inventory.addToInventory(item);
    slot.sold = true;

    const inBackpack = wasFull;
    this._eventBus.emit('item_purchased', {
      itemId: config.id,
      price: config.price,
      toBackpack: inBackpack,
    });

    return { success: true, item };
  }

  getPoolByRound(round: number): string[] {
    const all = this._configTable.getAllItems();
    if (round <= 2) {
      return all.filter((i) => i.rarity === 'bronze').map((i) => i.id);
    }
    if (round <= 4) {
      return all
        .filter((i) => i.rarity === 'bronze' || i.rarity === 'silver')
        .map((i) => i.id);
    }
    return all.map((i) => i.id);
  }

  private _generateShop(round: number): void {
    const poolIds = this.getPoolByRound(round);
    const pool = poolIds
      .map((id) => this._configTable.getItem(id))
      .filter((c): c is IItemConfig => c !== undefined);

    this._currentItems = [];

    for (let i = 0; i < SHOP_SIZE; i++) {
      if (pool.length === 0) {
        break;
      }
      const pick = pool[Math.floor(this._rng() * pool.length)];
      this._currentItems.push({
        index: i,
        configId: pick.id,
        config: pick,
        sold: false,
      });
    }
  }
}
