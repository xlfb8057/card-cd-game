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
import { MAX_ROUND } from '../config/RoundConfig';
import { formatHpDisplay } from '../utils/MathUtil';

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
  private _bindingsResolved = false;
  private _itemDisplayInited = false;
  private _shopCardsAssigned = false;
  private _legacyEquipHidden = false;

  start() {
    if (!this.bootstrapNode) {
      this.bootstrapNode = this.node;
    }
    this._resolveViewBindings();
    this._bindButtons();
    this._flashMessage('');
    this.scheduleOnce(() => this._refreshAll(), 0);
  }

  onEnable() {
    this._resolveViewBindings();
    this._itemDisplayInited = false;
    const app = this._getApp();
    if (app?.isGameComplete()) {
      this._refreshGameComplete(app);
    } else {
      this._refreshAll();
    }
  }

  onDisable(): void {
    this._itemDisplayInited = false;
    this._legacyEquipHidden = false;
  }

  update(dt: number) {
    const app = this._getApp();
    if (!app) {
      return;
    }

    if (app.isGameComplete()) {
      this._refreshGameComplete(app);
    } else if (app.getScene() === 'shop') {
      this._refreshAll();
    }

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
    if (app.isGameComplete()) {
      this.itemDisplay?.hideDetail();
      app.restartFromBeginning();
      director.loadScene(SCENE_BATTLE);
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
    this._resolveViewBindings();
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
    if (!this.itemDisplay) {
      return false;
    }
    const bound = this.itemDisplay.slotCards.filter((c) => c != null).length;
    return bound >= 6;
  }

  private _useShopCardWidgets(): boolean {
    if (!this.itemDisplay) {
      return false;
    }
    const shopBound =
      this.shopCardWidgets.filter((c) => c != null).length >= 6 ||
      this.itemDisplay.shopCards.filter((c) => c != null).length >= 6;
    return shopBound;
  }

  private _resolveViewBindings(): void {
    if (this._bindingsResolved) {
      return;
    }

    const canvas = this.node.scene?.getChildByName('Canvas') ?? this.node;
    if (!this.itemDisplay) {
      const root = canvas.getChildByName('ItemDisplayRoot');
      this.itemDisplay = root?.getComponent(ItemDisplayController) ?? null;
    }

    if (this.shopCardWidgets.filter((w) => w != null).length < 6) {
      const found: ItemCardWidget[] = [];
      this._collectShopCardWidgets(canvas, found);
      found.sort((a, b) => a.node.name.localeCompare(b.node.name));
      if (found.length >= 6) {
        this.shopCardWidgets = found.slice(0, 6);
      }
    }

    if (!this.modSelectPanel) {
      const panel =
        canvas.getChildByName('ModSelectPanel') ??
        canvas.getChildByName('ModSelectRoot');
      this.modSelectPanel = panel?.getComponent(ModSelectPanel) ?? null;
    }

    if (this.itemDisplay || this.shopCardWidgets.filter((w) => w != null).length >= 6) {
      this._bindingsResolved = true;
    }
  }

  private _collectShopCardWidgets(root: Node, out: ItemCardWidget[]): void {
    if (root.name.startsWith('ShopCardWidget_')) {
      const widget = root.getComponent(ItemCardWidget);
      if (widget) {
        out.push(widget);
      }
    }
    for (const child of root.children) {
      this._collectShopCardWidgets(child, out);
    }
  }

  private _refreshItemDisplay(
    app: NonNullable<ReturnType<ShopSceneView['_getApp']>>,
  ): void {
    if (!this.itemDisplay) {
      return;
    }

    if (!this._itemDisplayInited) {
      this.itemDisplay.setDeps(app.getItemDisplayDeps());
      this.itemDisplay.ensureToastListener((msg) => this._flashMessage(msg));
      this._itemDisplayInited = true;
    }

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
      if (this.shopCardWidgets.length >= 6 && !this._shopCardsAssigned) {
        this.itemDisplay.shopCards = this.shopCardWidgets;
        this._shopCardsAssigned = true;
      }
      this.itemDisplay.refreshShopCards(entries);
    }
  }

  private _setLegacyEquipVisible(visible: boolean): void {
    if (!visible && this._legacyEquipHidden) {
      return;
    }
    if (visible) {
      this._legacyEquipHidden = false;
    }

    for (let i = 0; i < 6; i++) {
      const labelNode = this.equipSlotLabels[i]?.node;
      if (labelNode?.isValid) {
        labelNode.active = visible;
      }
      const borderNode = this.equipSlotBorders[i]?.node;
      if (borderNode?.isValid) {
        borderNode.active = visible;
      }
    }

    if (!visible) {
      this._legacyEquipHidden = true;
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
      for (let i = 0; i < 6; i++) {
        if (this.shopCardLabels[i]?.node?.isValid) {
          this.shopCardLabels[i]!.node.active = false;
        }
        if (this.shopCardWidgets[i]?.node?.isValid) {
          this.shopCardWidgets[i]!.node.active = false;
        }
        const buyBtn = this.shopCardButtons[i];
        if (buyBtn?.node?.isValid) {
          buyBtn.node.active = false;
          buyBtn.interactable = false;
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
      const widget = this.shopCardWidgets[i];
      const choice = offer.choices[i];

      if (widget?.node) {
        widget.node.active = false;
      }

      if (!lbl) {
        continue;
      }
      lbl.node.active = true;
      if (choice) {
        lbl.string = `[改装] ${choice.name}\n${choice.description}`;
        if (btn) {
          btn.node.active = true;
          btn.interactable = true;
        }
      } else if (i < offer.choices.length) {
        lbl.string = '—';
        if (btn) {
          btn.node.active = true;
          btn.interactable = false;
        }
      } else {
        lbl.node.active = false;
        if (btn) {
          btn.node.active = false;
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
      this.hpLabel.string = `HP ${formatHpDisplay(hud.hp)}/${formatHpDisplay(hud.maxHP)}`;
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

      if (lbl?.node?.isValid) {
        lbl.node.active = !useWidgets;
      }
      if (widget?.node?.isValid) {
        widget.node.active = useWidgets;
      }

      if (btn?.node?.isValid) {
        btn.node.active = true;
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

  /** 第 5 关胜利后：GameApp 为 gameover，但仍加载 shop 场景展示通关页 */
  private _refreshGameComplete(
    app: NonNullable<ReturnType<ShopSceneView['_getApp']>>,
  ): void {
    this._resolveViewBindings();
    const s = app.getState().getState();

    if (this.roundLabel) {
      this.roundLabel.string = `恭喜通关！（${MAX_ROUND} 关）`;
    }
    if (this.hpLabel) {
      this.hpLabel.string = `HP ${formatHpDisplay(s.hp)}/${formatHpDisplay(s.maxHP)}`;
    }
    if (this.goldLabel) {
      this.goldLabel.string = `金币 ${s.gold}`;
    }
    if (this.refreshCostLabel) {
      this.refreshCostLabel.string = '';
    }
    if (this.backpackLabel) {
      const names = app.getInventory().getBackpack().map((item) => {
        const cfg = app.getItemDisplayDeps().configTable.getItem(item.configId);
        return cfg?.name ?? item.configId;
      });
      this.backpackLabel.string =
        names.length > 0 ? `背包：${names.join('、')}` : '背包：（空）';
    }

    this.modSelectPanel?.hide();

    for (let i = 0; i < 6; i++) {
      const lbl = this.shopCardLabels[i];
      if (lbl?.node?.isValid) {
        lbl.node.active = false;
      }
      const btn = this.shopCardButtons[i];
      if (btn?.node?.isValid) {
        btn.node.active = false;
        btn.interactable = false;
      }
      const widget = this.shopCardWidgets[i];
      if (widget?.node?.isValid) {
        widget.node.active = false;
      }
    }

    if (this.refreshBtn?.node?.isValid) {
      this.refreshBtn.node.active = false;
      this.refreshBtn.interactable = false;
    }
    if (this.startBattleBtn?.node?.isValid) {
      this.startBattleBtn.node.active = true;
      this.startBattleBtn.interactable = true;
      const lbl = this.startBattleBtn.getComponentInChildren(Label);
      if (lbl) {
        lbl.string = '重新开始';
      }
    }

    if (this.messageLabel) {
      this.messageLabel.string =
        '你已击败全部敌人！点击「重新开始」从第 1 关再来一局。';
      this._messageTimer = 0;
    }

    this._refreshItemDisplay(app);
    if (!this._useItemDisplayForEquip()) {
      this._refreshEquipSlots(app.getShop().getEquipSlotViews());
    }
  }
}
