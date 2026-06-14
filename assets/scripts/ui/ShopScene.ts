/**
 * 商店场景控制器（增强版）
 */

import { IEventBus } from '../core/EventBus';
import { IStateManager } from '../core/StateManager';
import { IEconomySystem } from '../systems/EconomySystem';
import { IShopSystem, IBuyResult } from '../systems/ShopSystem';
import { IInventorySystem } from '../systems/InventorySystem';
import { IItemConfig } from '../config/ItemConfig';
import { getRarityColor } from '../utils/RarityUtil';
import { IConfigTable } from '../core/ConfigTable';
import { IItemSlotView } from './ItemSlot';

export interface IShopCardView {
  index: number;
  name: string;
  rarity: string;
  price: number;
  effectSummary: string;
  sold: boolean;
  rarityColor: string;
}

export interface IShopHUDView {
  round: number;
  hp: number;
  maxHP: number;
  gold: number;
  refreshCost: number;
}

export interface IShopScene {
  enterShop(round: number): void;
  getHUD(): IShopHUDView;
  getShopCards(): IShopCardView[];
  getEquipSlotViews(): IItemSlotView[];
  getBackpackNames(): string[];
  tryBuy(index: number): IBuyResult;
  tryRefresh(): boolean;
  equipFromBackpack(backpackIndex: number, slotPosition: number): boolean;
  onEnterBattle(): void;
}

export class ShopScene implements IShopScene {
  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _state: IStateManager,
    private readonly _economy: IEconomySystem,
    private readonly _shop: IShopSystem,
    private readonly _inventory: IInventorySystem,
    private readonly _configTable?: IConfigTable,
  ) {}

  enterShop(round: number): void {
    this._state.setState({ round });
    this._shop.openShop(round);
    this._eventBus.emit('shop_entered', { round });
  }

  getHUD(): IShopHUDView {
    const s = this._state.getState();
    return {
      round: s.round,
      hp: s.hp,
      maxHP: s.maxHP,
      gold: this._economy.currentGold,
      refreshCost: this._shop.getRefreshCost(),
    };
  }

  getShopCards(): IShopCardView[] {
    return this._shop.currentItems.map((slot) => ({
      index: slot.index,
      name: slot.config.name,
      rarity: slot.config.rarity,
      price: slot.config.price,
      effectSummary: this._summarizeEffects(slot.config),
      sold: slot.sold,
      rarityColor: getRarityColor(slot.config.rarity),
    }));
  }

  getEquipSlotViews(): IItemSlotView[] {
    const views: IItemSlotView[] = [];
    for (let i = 0; i < 6; i++) {
      const item = this._inventory.getEquipped(i);
      if (!item) {
        views.push({
          position: i,
          isEmpty: true,
          name: '空',
          cdText: '',
          starText: '',
          borderColor: '#666666',
          isMaxHaste: false,
          showMaxLabel: false,
          pulseRed: false,
          scaleAnim: false,
          detailText: '',
        });
        continue;
      }
      const cfg = this._configTable?.getItem(item.configId);
      views.push({
        position: i,
        isEmpty: false,
        name: cfg?.name ?? item.configId,
        cdText: '',
        starText: '★'.repeat(item.star),
        borderColor: getRarityColor(cfg?.rarity ?? 'bronze'),
        isMaxHaste: false,
        showMaxLabel: false,
        pulseRed: false,
        scaleAnim: false,
        detailText: '',
      });
    }
    return views;
  }

  getBackpackNames(): string[] {
    return this._inventory.getBackpack().map((item) => {
      const cfg = this._configTable?.getItem(item.configId);
      return cfg?.name ?? item.configId;
    });
  }

  tryBuy(index: number): IBuyResult {
    const result = this._shop.buyItem(index);
    if (result.success) {
      this._state.setState({ gold: this._economy.currentGold });
    } else if (result.reason === 'no_gold') {
      this._eventBus.emit('shop_error', { message: '金币不足' });
    }
    return result;
  }

  tryRefresh(): boolean {
    const ok = this._shop.refreshShop(this._state.round);
    if (!ok) {
      this._eventBus.emit('shop_error', { message: '金币不足，无法刷新' });
    } else {
      this._state.setState({ gold: this._economy.currentGold });
    }
    return ok;
  }

  equipFromBackpack(backpackIndex: number, slotPosition: number): boolean {
    const bp = this._inventory.getBackpack();
    const item = bp[backpackIndex];
    if (!item) {
      return false;
    }
    return this._inventory.equipFromBackpack(item, slotPosition);
  }

  onEnterBattle(): void {
    this._state.setState({ gold: this._economy.currentGold });
    this._eventBus.emit('enter_battle', {
      round: this._state.round,
      equipped: this._inventory.getAllEquipped().map((i) => i.configId),
    });
  }

  private _summarizeEffects(config: IItemConfig): string {
    return config.effects
      .map((e) => {
        switch (e.type) {
          case 'damage':
            return `伤害${e.value}`;
          case 'dot':
            return `${e.dotType ?? 'dot'}${e.value}`;
          case 'heal':
            return `治疗${e.value}`;
          case 'shield':
            return `护盾${e.value}`;
          case 'haste':
            return `加速${e.value}s`;
          default:
            return e.type;
        }
      })
      .join(' / ');
  }
}
