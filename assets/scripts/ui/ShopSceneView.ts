/**
 * 商店场景 Cocos 视图层
 * 读取 ShopScene ViewModel，处理购买 / 刷新 / 开战
 */

import {
  _decorator,
  Button,
  Color,
  Component,
  director,
  Label,
  Node,
  Sprite,
} from 'cc';
import { GameBootstrap } from '../GameBootstrap';
import { getGameApp } from '../core/GameAppHolder';
import { SCENE_BATTLE } from '../config/SceneNames';
import { IShopCardView, IShopHUDView, IShopModOfferView } from './ShopScene';
import { IItemSlotView } from './ItemSlot';
import { ItemDisplayController } from './item-display/ItemDisplayController';
import { ItemCardWidget } from './item-display/cocos/ItemCardWidget';
import { ModSelectPanel } from './item-display/cocos/ModSelectPanel';
import { modSelectPresenter } from './item-display/ModSelectPresenter';
import { IItemInstance } from '../models/ItemInstance';

const { ccclass, property } = _decorator;

@ccclass('ShopSceneView')
export class ShopSceneView extends Component {
  @property(Node)
  bootstrapNode: Node | null = null;

  @property(Label)
  roundLabel: Label | null = null;

  @property(Label)
  hpLabel: Label | null = null;

  @property(Label)
  goldLabel: Label | null = null;

  @property(Label)
  refreshCostLabel: Label | null = null;

  @property({ type: [Button] })
  shopCardButtons: Button[] = [];

  @property({ type: [Label] })
  shopCardLabels: Label[] = [];

  /** v4 商店商品卡（点击开详情；购买用 shopCardButtons） */
  @property({ type: [ItemCardWidget] })
  shopCardWidgets: ItemCardWidget[] = [];

  @property(Button)
  refreshBtn: Button | null = null;

  @property(Button)
  startBattleBtn: Button | null = null;

  @property({ type: [Sprite] })
  equipSlotBorders: Sprite[] = [];

  @property({ type: [Label] })
  equipSlotLabels: Label[] = [];

  @property(Label)
  backpackLabel: Label | null = null;

  @property(Label)
  messageLabel: Label | null = null;

  /** v4 装备展示（装备栏 + 可选商店卡） */
  @property(ItemDisplayController)
  itemDisplay: ItemDisplayController | null = null;

  /** v4 改装三选一（独立于商店 6 卡） */
  @property(ModSelectPanel)
  modSelectPanel: ModSelectPanel | null = null;

  private _messageTimer = 0;
  private _modPickWired = false;

  start() {
    if (!this.bootstrapNode) {
      this.bootstrapNode = this.node;
    }
    this._bindButtons();
    this._flashMessage('');
    this._refreshAll();
    this.scheduleOnce(() => this._refreshAll(), 0);
  }

  onEnable() {
    this._refreshAll();
  }

  update(dt: number) {
    const app = this._getApp();
    if (!app || app.getScene() !== 'shop') {
      return;
    }

    this._refreshAll();

    if (this._messageTimer > 0) {
      this._messageTimer -= dt;
      if (this._messageTimer <= 0 && this.messageLabel) {
        this.messageLabel.string = '';
      }
    }
  }

  onShopCardClick(_event: unknown, indexStr: string): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    const index = Number(indexStr);
    const shop = app.getShop();

    if (shop.hasModOffer()) {
      if (index < 3 && shop.tryPickMod(index)) {
        this._flashMessage('改装已安装！');
      } else if (index >= 3) {
        this._flashMessage('请先点击前 3 张卡片选择改装');
      }
      return;
    }

    const result = shop.tryBuy(index);
    if (result.success) {
      this.itemDisplay?.hideDetail();
      if (result.starMerged && result.item) {
        this._flashMessage(
          `升星成功！${result.item.configId} 现为 ${result.item.star} 星`,
        );
      } else {
        this._flashMessage('购买成功！已放入背包');
      }
    } else if (result.reason === 'no_gold') {
      this._flashMessage('金币不足');
    } else if (result.reason === 'sold_out') {
      this._flashMessage('已售出');
    }
  }

  onRefreshClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    if (app.getShop().hasModOffer()) {
      this._flashMessage('请先完成改装选择');
      return;
    }
    this.itemDisplay?.hideDetail();
    const ok = app.getShop().tryRefresh();
    this._flashMessage(ok ? '商店已刷新' : '金币不足，无法刷新');
  }

  onStartBattleClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    if (app.getShop().hasModOffer()) {
      this._flashMessage('请先完成改装选择');
      return;
    }
    this.itemDisplay?.hideDetail();
    app.getShop().onEnterBattle();
    app.startBattle();
    director.loadScene(SCENE_BATTLE);
  }

  private _getApp() {
    return (
      getGameApp() ??
      this.bootstrapNode?.getComponent(GameBootstrap)?.getApp() ??
      this.node.getComponent(GameBootstrap)?.getApp() ??
      null
    );
  }

  private _refreshAll(): void {
    const app = this._getApp();
    if (!app || app.getScene() !== 'shop') {
      return;
    }
    const shop = app.getShop();
    this._refreshHUD(shop.getHUD());
    if (shop.hasModOffer()) {
      this._refreshModOffer(app, shop.getModOffer());
    } else {
      this.modSelectPanel?.hide();
      this._refreshCards(shop.getShopCards());
    }
    this._refreshItemDisplay(app);
    if (!this._useItemDisplayForEquip()) {
      this._refreshEquipSlots(shop.getEquipSlotViews());
    }
    this._refreshBackpack(shop.getBackpackNames());
  }

  private _useItemDisplayForEquip(): boolean {
    return (
      this.itemDisplay !== null &&
      this.itemDisplay.slotCards.length >= 6
    );
  }

  private _useShopCardWidgets(): boolean {
    return (
      this.itemDisplay !== null &&
      (this.shopCardWidgets.length >= 6 ||
        this.itemDisplay.shopCards.length >= 6)
    );
  }

  private _refreshItemDisplay(
    app: NonNullable<ReturnType<ShopSceneView['_getApp']>>,
  ): void {
    if (!this.itemDisplay) {
      return;
    }
    this.itemDisplay.setDeps(app.getItemDisplayDeps());
    this.itemDisplay.ensureToastListener((msg) => this._flashMessage(msg));

    if (this._useItemDisplayForEquip()) {
      const items: (IItemInstance | null)[] = [];
      for (let i = 0; i < 6; i++) {
        items.push(app.getInventory().getEquipped(i) ?? null);
      }
      this.itemDisplay.refreshEquippedSlots('shop_equipped', items);
      this._setLegacyEquipVisible(false);
    } else {
      this._setLegacyEquipVisible(true);
    }

    const shop = app.getShop();
    if (!shop.hasModOffer() && this._useShopCardWidgets()) {
      const entries = shop.getShopCards().map((c) => ({
        configId: c.configId,
        sold: c.sold,
        shopIndex: c.index,
      }));
      if (this.shopCardWidgets.length >= 6) {
        this.itemDisplay.shopCards = this.shopCardWidgets;
      }
      this.itemDisplay.refreshShopCards(entries);
    }
  }

  private _setLegacyEquipVisible(visible: boolean): void {
    for (let i = 0; i < 6; i++) {
      if (this.equipSlotLabels[i]) {
        this.equipSlotLabels[i]!.node.active = visible;
      }
      if (this.equipSlotBorders[i]) {
        this.equipSlotBorders[i]!.node.active = visible;
      }
    }
  }

  private _refreshModOffer(
    app: NonNullable<ReturnType<ShopSceneView['_getApp']>>,
    offer: IShopModOfferView | null,
  ): void {
    if (!offer) {
      return;
    }

    const shop = app.getShop();
    const round = shop.getHUD().round;
    const choices = shop.getModOfferChoices();
    const cards = modSelectPresenter.buildModCards(choices, round);

    if (this.modSelectPanel) {
      this.modSelectPanel.show(offer.itemName, offer.star, cards);
      this._wireModPickOnce(app);
      for (let i = 0; i < this.shopCardLabels.length; i++) {
        if (this.shopCardLabels[i]) {
          this.shopCardLabels[i].node.active = false;
        }
        if (this.shopCardWidgets[i]) {
          this.shopCardWidgets[i].node.active = false;
        }
      }
    } else {
      this._refreshModOfferLegacy(offer);
    }

    if (this.messageLabel) {
      this.messageLabel.string =
        `3星 ${offer.itemName} 解锁改装！请选择一项改装`;
    }
  }

  private _wireModPickOnce(
    app: NonNullable<ReturnType<ShopSceneView['_getApp']>>,
  ): void {
    if (this._modPickWired || !this.modSelectPanel) {
      return;
    }
    this._modPickWired = true;
    this.modSelectPanel.setPickHandler((index) => {
      const ok = app.getShop().tryPickMod(index);
      if (ok) {
        this.modSelectPanel?.hide();
        this._flashMessage('改装已安装！');
      } else {
        this._flashMessage('无法安装该改装');
      }
    });
  }

  private _refreshModOfferLegacy(offer: IShopModOfferView): void {
    if (!offer) {
      return;
    }
    for (let i = 0; i < 6; i++) {
      const lbl = this.shopCardLabels[i];
      const btn = this.shopCardButtons[i];
      const choice = offer.choices[i];
      if (!lbl) {
        continue;
      }
      if (choice) {
        lbl.string = `[改装] ${choice.name}\n${choice.description}`;
        if (btn) {
          btn.interactable = true;
        }
      } else {
        lbl.string = i < 3 ? '—' : '请先选改装';
        if (btn) {
          btn.interactable = false;
        }
      }
    }
    if (this.messageLabel) {
      this.messageLabel.string =
        `3星 ${offer.itemName} 解锁改装！点击前 ${offer.choices.length} 张卡片三选一`;
    }
  }

  private _bindButtons(): void {
    for (let i = 0; i < this.shopCardButtons.length; i++) {
      const btn = this.shopCardButtons[i];
      if (!btn) {
        continue;
      }
      btn.node.off(Button.EventType.CLICK);
      btn.node.on(
        Button.EventType.CLICK,
        () => this.onShopCardClick(null, String(i)),
        this,
      );
    }
    if (this.refreshBtn) {
      this.refreshBtn.node.on(Button.EventType.CLICK, this.onRefreshClick, this);
    }
    if (this.startBattleBtn) {
      this.startBattleBtn.node.on(
        Button.EventType.CLICK,
        this.onStartBattleClick,
        this,
      );
    }
  }

  private _refreshHUD(hud: IShopHUDView): void {
    if (this.roundLabel) {
      this.roundLabel.string = `第 ${hud.round} 回合 · 商店`;
    }
    if (this.hpLabel) {
      this.hpLabel.string = `HP ${hud.hp}/${hud.maxHP}`;
    }
    if (this.goldLabel) {
      this.goldLabel.string = `金币 ${hud.gold}`;
    }
    if (this.refreshCostLabel) {
      this.refreshCostLabel.string = `刷新 ${hud.refreshCost} 金`;
    }
  }

  private _refreshCards(cards: IShopCardView[]): void {
    const useWidgets = this._useShopCardWidgets();

    for (let i = 0; i < 6; i++) {
      const card = cards[i];
      const lbl = this.shopCardLabels[i];
      const btn = this.shopCardButtons[i];
      const widget = this.shopCardWidgets[i];

      if (lbl) {
        lbl.node.active = !useWidgets;
      }
      if (widget) {
        widget.node.active = useWidgets;
      }

      if (!card || !lbl || useWidgets) {
        if (btn && card) {
          btn.interactable = !card.sold;
          this._setBuyButtonLabel(btn, card);
        }
        continue;
      }

      if (card.sold) {
        lbl.string = `[已售] ${card.name}`;
      } else {
        lbl.string = `${card.name}\n${card.price}金 · ${card.effectSummary}`;
      }

      if (btn) {
        btn.interactable = !card.sold;
        this._setBuyButtonLabel(btn, card);
      }
    }
  }

  private _setBuyButtonLabel(btn: Button, card: IShopCardView): void {
    const lbl = btn.getComponentInChildren(Label);
    if (!lbl) {
      return;
    }
    if (card.sold) {
      lbl.string = '售罄';
    } else if (card.price === 0) {
      lbl.string = '免费';
    } else {
      lbl.string = `购买 ${card.price}金`;
    }
  }

  private _refreshEquipSlots(views: IItemSlotView[]): void {
    for (let i = 0; i < 6; i++) {
      const view = views[i];
      const lbl = this.equipSlotLabels[i];
      const border = this.equipSlotBorders[i];
      if (lbl) {
        lbl.string = view?.isEmpty ? '空' : `${view.name} ${view.starText}`;
      }
      if (border && view?.borderColor) {
        const hex = view.borderColor.startsWith('#')
          ? view.borderColor.slice(1)
          : view.borderColor;
        const c = new Color();
        Color.fromHEX(c, hex);
        border.color = c;
      }
    }
  }

  private _refreshBackpack(names: string[]): void {
    if (!this.backpackLabel) {
      return;
    }
    this.backpackLabel.string =
      names.length > 0 ? `背包：${names.join('、')}` : '背包：（空）';
  }

  private _flashMessage(text: string): void {
    if (this.messageLabel) {
      this.messageLabel.string = text;
    }
    this._messageTimer = text ? 2 : 0;
  }
}
