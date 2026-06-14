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
import { IShopCardView, IShopHUDView } from './ShopScene';
import { IItemSlotView } from './ItemSlot';

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

  private _messageTimer = 0;

  start() {
    if (!this.bootstrapNode) {
      this.bootstrapNode = this.node;
    }
    this._bindButtons();
    this._flashMessage('');
    // 场景刚加载时立即刷新（避免首帧 GameBootstrap 未就绪导致 Label 停留在编辑器默认值）
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
    const result = app.getShop().tryBuy(index);
    if (result.success) {
      this._flashMessage('购买成功！已放入背包');
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
    const ok = app.getShop().tryRefresh();
    this._flashMessage(ok ? '商店已刷新' : '金币不足，无法刷新');
  }

  onStartBattleClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
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
    this._refreshCards(shop.getShopCards());
    this._refreshEquipSlots(shop.getEquipSlotViews());
    this._refreshBackpack(shop.getBackpackNames());
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
    for (let i = 0; i < 6; i++) {
      const card = cards[i];
      const lbl = this.shopCardLabels[i];
      const btn = this.shopCardButtons[i];
      if (!card || !lbl) {
        continue;
      }

      if (card.sold) {
        lbl.string = `[已售] ${card.name}`;
      } else {
        lbl.string = `${card.name}\n${card.price}金 · ${card.effectSummary}`;
      }

      if (btn) {
        btn.interactable = !card.sold;
      }
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
