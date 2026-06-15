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
import { IModSystem } from '../systems/ModSystem';
import { IModConfig, ModTier } from '../config/ModConfig';
import { IItemInstance } from '../models/ItemInstance';

export interface IShopModChoiceView {
  index: number;
  modId: string;
  name: string;
  description: string;
}

export interface IShopModOfferView {
  itemName: string;
  star: number;
  choices: IShopModChoiceView[];
}

export interface IShopCardView {
  index: number;
  configId: string;
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
  hasModOffer(): boolean;
  getModOffer(): IShopModOfferView | null;
  tryPickMod(choiceIndex: number): boolean;
  getModOfferChoices(): IModConfig[];
}

export class ShopScene implements IShopScene {
  private _modOffer: { item: IItemInstance; choices: IModConfig[] } | null = null;

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _state: IStateManager,
    private readonly _economy: IEconomySystem,
    private readonly _shop: IShopSystem,
    private readonly _inventory: IInventorySystem,
    private readonly _configTable?: IConfigTable,
    private readonly _modSystem?: IModSystem,
  ) {}

  enterShop(round: number): void {
    this._state.setState({ round });
    this._shop.openShop(round);
    this._scanPendingModOffers(round);
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
      configId: slot.configId,
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
      const modText = item.mods
        .map((id) => this._configTable?.getMod(id)?.name ?? id)
        .join('+');
      views.push({
        position: i,
        isEmpty: false,
        name: cfg?.name ?? item.configId,
        cdText: '',
        starText: '★'.repeat(item.star) + (modText ? ` [${modText}]` : ''),
        borderColor: getRarityColor(cfg?.rarity ?? 'common'),
        isMaxHaste: false,
        showMaxLabel: false,
        pulseRed: false,
        scaleAnim: false,
        detailText: modText,
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
    if (this._modOffer) {
      return { success: false, reason: 'sold_out' };
    }

    const result = this._shop.buyItem(index);
    if (result.success) {
      this._state.setState({ gold: this._economy.currentGold });
      if (result.item && result.starMerged && result.item.star >= 3) {
        this._beginModOffer(result.item, this._state.round);
      }
    } else if (result.reason === 'no_gold') {
      this._eventBus.emit('shop_error', { message: '金币不足' });
    }
    return result;
  }

  hasModOffer(): boolean {
    return this._modOffer !== null;
  }

  getModOffer(): IShopModOfferView | null {
    if (!this._modOffer || !this._configTable) {
      return null;
    }
    const cfg = this._configTable.getItem(this._modOffer.item.configId);
    return {
      itemName: cfg?.name ?? this._modOffer.item.configId,
      star: this._modOffer.item.star,
      choices: this._modOffer.choices.map((mod, index) => ({
        index,
        modId: mod.id,
        name: mod.name,
        description: mod.description,
      })),
    };
  }

  tryPickMod(choiceIndex: number): boolean {
    if (!this._modOffer || !this._modSystem) {
      return false;
    }
    const mod = this._modOffer.choices[choiceIndex];
    if (!mod) {
      return false;
    }
    const ok = this._modSystem.equipMod(
      this._modOffer.item,
      mod.id,
      this._state.round,
    );
    if (ok) {
      this._modOffer = null;
    }
    return ok;
  }

  getModOfferChoices(): IModConfig[] {
    return this._modOffer ? [...this._modOffer.choices] : [];
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
    this._modOffer = null;
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

  private _scanPendingModOffers(round: number): void {
    if (this._modOffer || !this._modSystem) {
      return;
    }
    const items = [
      ...this._inventory.getAllEquipped(),
      ...this._inventory.getBackpack(),
    ];
    for (const item of items) {
      if (item.star >= 3 && item.mods.length === 0) {
        this._beginModOffer(item, round);
        break;
      }
    }
  }

  private _beginModOffer(item: IItemInstance, round: number): void {
    if (!this._modSystem || item.mods.length > 0) {
      return;
    }
    const tier = this._resolveModTier(round);
    if (!tier) {
      return;
    }
    const choices = this._modSystem.generateModChoices(item, tier);
    if (choices.length === 0) {
      return;
    }
    this._modOffer = { item, choices };
    this._eventBus.emit('mod_offer_ready', {
      itemId: item.configId,
      star: item.star,
      tier,
    });
  }

  private _resolveModTier(round: number): ModTier | null {
    if (round >= 5) {
      return 'mechanism';
    }
    if (round >= 2) {
      return 'attribute';
    }
    return null;
  }
}
