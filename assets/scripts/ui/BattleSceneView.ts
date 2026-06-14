/**
 * 战斗场景 Cocos 视图层
 * 每帧读取 BattleSceneController 的 ViewModel，刷新 Label / Sprite / 面板
 */

import {
  _decorator,
  Button,
  Color,
  Component,
  director,
  Label,
  Node,
  ScrollView,
  Sprite,
  UITransform,
} from 'cc';
import { GameBootstrap } from '../GameBootstrap';
import { getGameApp } from '../core/GameAppHolder';
import { SCENE_SHOP } from '../config/SceneNames';
import { BattleLogController } from './BattleLog';
import { IBattleHUDView, IBattleSettlementView, BattleScenePhase } from './BattleScene';
import { IItemSlotView } from './ItemSlot';
import { IRescueButtonView } from './RescuePanel';
import { IBattleLogEntry } from './BattleLog';

const { ccclass, property } = _decorator;

const HP_BAR_FULL_WIDTH = 200;

@ccclass('BattleSceneView')
export class BattleSceneView extends Component {
  /**
   * 挂有 GameBootstrap 的节点（通常就是 Canvas 自身）
   * 用 Node 而不是 GameBootstrap，避免编辑器拖绑时报 replace 错误
   */
  @property(Node)
  bootstrapNode: Node | null = null;

  @property(Label)
  roundLabel: Label | null = null;

  @property(Label)
  playerHPLabel: Label | null = null;

  /** 玩家 HP 绿条节点（PlayerHPBarFill） */
  @property(Node)
  playerHPBarFillNode: Node | null = null;

  @property(Label)
  enemyNameLabel: Label | null = null;

  @property(Label)
  enemyHPLabel: Label | null = null;

  /** 敌人 HP 条节点 */
  @property(Node)
  enemyHPBarFillNode: Node | null = null;

  @property(Label)
  goldLabel: Label | null = null;

  @property({ type: [Sprite] })
  slotBorders: Sprite[] = [];

  @property({ type: [Label] })
  slotNameLabels: Label[] = [];

  @property({ type: [Label] })
  slotCDLabels: Label[] = [];

  @property(Label)
  logLabel: Label | null = null;

  @property(ScrollView)
  logScrollView: ScrollView | null = null;

  @property({ type: [Button] })
  rescueButtons: Button[] = [];

  @property({ type: [Label] })
  rescueButtonLabels: Label[] = [];

  @property(Node)
  settlementPanel: Node | null = null;

  @property(Label)
  resultLabel: Label | null = null;

  @property(Button)
  enterShopBtn: Button | null = null;

  @property(Button)
  retryBtn: Button | null = null;

  @property(Label)
  messageLabel: Label | null = null;

  private _lastLogText = '';
  private _messageTimer = 0;
  /** 结算面板打开期间保持提示，不被计时器清掉 */
  private _settlementHintActive = false;

  start() {
    if (!this.bootstrapNode) {
      this.bootstrapNode = this.node;
    }
    this._bindButtonEvents();
    if (this.settlementPanel) {
      this.settlementPanel.active = false;
    }
    if (this.messageLabel) {
      this.messageLabel.string = '';
    }
  }

  update(_dt: number) {
    const app = this._getApp();
    if (!app || app.getScene() !== 'battle') {
      return;
    }

    const battle = app.getBattle();
    this._refreshHUD(battle.getHUD());
    this._refreshSlots(battle.getItemSlotViews());
    this._refreshLog(battle.getLogEntries());
    this._refreshRescue(battle.getRescueButtons());
    this._refreshSettlement(battle.getPhase(), battle.getSettlement());

    if (this._messageTimer > 0) {
      this._messageTimer -= _dt;
      if (this._messageTimer <= 0 && this.messageLabel && !this._settlementHintActive) {
        this.messageLabel.string = '';
      }
    }
  }

  onRescueChargeClick(): void {
    this._getApp()?.getBattle().onRescueChargeButton();
  }

  onRescueOverloadClick(): void {
    this._getApp()?.getBattle().onRescueOverload();
  }

  onRescueRepositionClick(): void {
    this._getApp()?.getBattle().onRescueReposition();
  }

  onEnterShopClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    app.getBattle().confirmEnterShop();
    if (this.settlementPanel) {
      this.settlementPanel.active = false;
    }
    director.loadScene(SCENE_SHOP);
  }

  onRetryClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    const ok = app.getBattle().retryFromSnapshot();
    if (ok) {
      this._settlementHintActive = false;
      this._lastLogText = '';
      this._flashMessage('已回退，重新开战');
      if (this.resultLabel) {
        this.resultLabel.string = '已回退，重新开战';
      }
      // 延迟关闭，让玩家看见提示（MessageLabel 在 SettlementPanel 内）
      this.scheduleOnce(() => {
        if (this.settlementPanel) {
          this.settlementPanel.active = false;
        }
      }, 0.6);
    } else {
      this._flashMessage('无法回退（无快照）', true);
      if (this.resultLabel) {
        this.resultLabel.string = '失败...\n无法回退（无快照）';
      }
    }
  }

  private _getApp() {
    return (
      getGameApp() ??
      this.bootstrapNode?.getComponent(GameBootstrap)?.getApp() ??
      this.node.getComponent(GameBootstrap)?.getApp() ??
      null
    );
  }

  private _bindButtonEvents(): void {
    this._onClick(this.rescueButtons[0], this.onRescueChargeClick);
    this._onClick(this.rescueButtons[1], this.onRescueOverloadClick);
    this._onClick(this.rescueButtons[2], this.onRescueRepositionClick);
    this._onClick(this.enterShopBtn, this.onEnterShopClick);
    this._onClick(this.retryBtn, this.onRetryClick);
  }

  private _onClick(btn: Button | null, handler: () => void): void {
    if (!btn) {
      return;
    }
    btn.node.on(Button.EventType.CLICK, handler, this);
  }

  private _refreshHUD(hud: IBattleHUDView): void {
    if (this.roundLabel) {
      this.roundLabel.string = `第 ${hud.round} 回合`;
    }
    if (this.playerHPLabel) {
      const shield = hud.playerShield > 0 ? ` (+${hud.playerShield}盾)` : '';
      this.playerHPLabel.string = `${hud.playerHP}/${hud.playerMaxHP}${shield}`;
    }
    if (this.enemyNameLabel) {
      this.enemyNameLabel.string = hud.enemyName;
    }
    if (this.enemyHPLabel) {
      this.enemyHPLabel.string = `${hud.enemyHP}/${hud.enemyMaxHP}`;
    }
    if (this.goldLabel) {
      this.goldLabel.string = `金币 ${hud.gold}`;
    }

    this._setHPBar(this.playerHPBarFillNode, hud.playerHP, hud.playerMaxHP);
    this._setHPBar(this.enemyHPBarFillNode, hud.enemyHP, hud.enemyMaxHP);
  }

  private _setHPBar(barNode: Node | null, hp: number, maxHP: number): void {
    if (!barNode) {
      return;
    }
    const bar = barNode.getComponent(UITransform);
    if (!bar) {
      return;
    }
    const ratio = maxHP > 0 ? Math.max(0, Math.min(1, hp / maxHP)) : 0;
    bar.setContentSize(HP_BAR_FULL_WIDTH * ratio, bar.contentSize.height);
  }

  private _refreshSlots(views: IItemSlotView[]): void {
    for (let i = 0; i < 6; i++) {
      const view = views[i];
      const border = this.slotBorders[i];
      const nameLabel = this.slotNameLabels[i];
      const cdLabel = this.slotCDLabels[i];

      if (nameLabel) {
        nameLabel.string = view?.name ?? '空';
      }
      if (cdLabel) {
        cdLabel.string = view?.cdText ?? '';
        cdLabel.node.active = !(view?.isEmpty ?? true);
      }
      if (border && view?.borderColor) {
        const hex = view.borderColor.startsWith('#')
          ? view.borderColor.slice(1)
          : view.borderColor;
        const c = new Color();
        Color.fromHEX(c, hex);
        border.color = c;
      }
      if (border && view?.scaleAnim) {
        border.node.setScale(1.15, 1.15, 1);
      } else if (border) {
        border.node.setScale(1, 1, 1);
      }
    }
  }

  private _refreshLog(entries: IBattleLogEntry[]): void {
    if (!this.logLabel) {
      return;
    }
    const text = entries
      .map((e) => BattleLogController.formatEntry(e))
      .join('\n');
    if (text === this._lastLogText) {
      return;
    }
    this._lastLogText = text;
    this.logLabel.string = text || '（等待战斗开始…）';
    if (this.logScrollView) {
      this.logScrollView.scrollToBottom(0.05);
    }
  }

  private _refreshRescue(buttons: IRescueButtonView[]): void {
    for (let i = 0; i < buttons.length; i++) {
      const view = buttons[i];
      const btn = this.rescueButtons[i];
      const lbl = this.rescueButtonLabels[i];
      if (!view || !btn) {
        continue;
      }

      btn.node.active = view.state !== 'hidden';
      btn.interactable = view.state === 'available';

      if (lbl) {
        let text = `${view.label} (${view.usesLeft})`;
        if (view.cooldownSec !== undefined && view.cooldownSec > 0) {
          text += ` ${view.cooldownSec}s`;
        }
        lbl.string = text;
      }
    }
  }

  private _refreshSettlement(
    phase: BattleScenePhase,
    settlement: IBattleSettlementView | null,
  ): void {
    if (!this.settlementPanel) {
      return;
    }

    if (phase !== 'settlement' || !settlement) {
      this.settlementPanel.active = false;
      this._settlementHintActive = false;
      if (this.messageLabel && this._messageTimer <= 0) {
        this.messageLabel.string = '';
      }
      return;
    }

    this.settlementPanel.active = true;

    if (this.resultLabel) {
      this.resultLabel.string = `${settlement.message}\n奖励金币 +${settlement.goldReward}`;
    }
    if (this.messageLabel) {
      this._settlementHintActive = true;
      this._messageTimer = 0;
      if (settlement.canRetry) {
        this.messageLabel.string = '点击「重试」回退到本回合准备阶段';
      } else if (settlement.canEnterShop) {
        this.messageLabel.string = '点击「进入商店」购买装备';
      } else {
        this.messageLabel.string = '';
        this._settlementHintActive = false;
      }
    }
    if (this.enterShopBtn) {
      this.enterShopBtn.node.active = settlement.canEnterShop;
    }
    if (this.retryBtn) {
      this.retryBtn.node.active = settlement.canRetry;
      this.retryBtn.interactable = settlement.canRetry;
    }
  }

  private _flashMessage(text: string, keepDuringSettlement = false): void {
    if (this.messageLabel) {
      this.messageLabel.string = text;
    }
    if (keepDuringSettlement) {
      this._settlementHintActive = true;
      this._messageTimer = 0;
    } else {
      this._settlementHintActive = false;
      this._messageTimer = text ? 2.5 : 0;
    }
  }
}
