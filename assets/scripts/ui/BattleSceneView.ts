/**
 * 战斗场景 Cocos 视图层
 * 每帧读取 BattleSceneController 的 ViewModel，刷新 Label / Sprite / 面板
 */

import {
  _decorator,
  Button,
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
import { MAX_ROUND } from '../config/RoundConfig';
import { BattleLogController } from './BattleLog';
import { IBattleHUDView, IBattleSettlementView, BattleScenePhase } from './BattleScene';
import { IRescueButtonView } from './RescuePanel';
import { IBattleLogEntry } from './BattleLog';
import { formatHpDisplay } from '../utils/MathUtil';
import { ItemDisplayController } from './item-display/ItemDisplayController';
import { IItemInstance } from '../models/ItemInstance';

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

  @property({ type: [Label] })
  rescueButtonLabels: Label[] = [];

  @property(Node)
  settlementPanel: Node | null = null;

  @property(Label)
  resultLabel: Label | null = null;

  @property(Label)
  messageLabel: Label | null = null;

  /** v4 装备展示（可选，挂接 ItemDisplayController 后启用） */
  @property(ItemDisplayController)
  itemDisplay: ItemDisplayController | null = null;

  private _rescueButtons: Button[] = [];
  private _enterShopBtn: Button | null = null;
  private _retryBtn: Button | null = null;
  private _restartBtn: Button | null = null;
  private _buttonsBound = false;

  private _lastLogText = '';
  private _messageTimer = 0;
  /** 结算面板打开期间保持提示，不被计时器清掉 */
  private _settlementHintActive = false;
  private _itemDisplayInited = false;
  private _legacySlotsHidden = false;
  private _bindingsResolved = false;

  start() {
    if (!this.bootstrapNode) {
      this.bootstrapNode = this.node;
    }
    this._resolveViewBindings();
    this._resolveActionButtons();
    this._bindButtonEvents();
    if (this.settlementPanel) {
      this.settlementPanel.active = false;
    }
    if (this.messageLabel) {
      this.messageLabel.string = '';
    }
    this._initItemDisplay();
  }

  onDisable(): void {
    this._itemDisplayInited = false;
    this._legacySlotsHidden = false;
  }

  update(_dt: number) {
    const app = this._getApp();
    if (!app || app.getScene() !== 'battle') {
      return;
    }

    if (!this._bindingsResolved) {
      this._resolveViewBindings();
    }

    const battle = app.getBattle();
    this._refreshHUD(battle.getHUD());
    // 日志 / 救援 / 结算优先刷新，避免装备展示异常时整帧 UI 卡死
    this._refreshLog(battle.getLogEntries());
    this._refreshRescue(battle.getRescueButtons());
    this._refreshSettlement(battle.getPhase(), battle.getSettlement());

    if (this._useItemDisplay()) {
      try {
        this._refreshItemDisplay(app);
      } catch (err) {
        console.error('[BattleSceneView] item display refresh failed', err);
      }
    }
    this._setLegacySlotsVisible(false);

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

  /** 重新开始：回到第 1 关，清空金币与装备 */
  onRestartClick(): void {
    const app = this._getApp();
    if (!app) {
      return;
    }
    app.restartFromBeginning();
    this._settlementHintActive = false;
    this._lastLogText = '';
    if (this.settlementPanel) {
      this.settlementPanel.active = false;
    }
    this._flashMessage('已重新开始：第 1 关');
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
    if (this._buttonsBound) {
      return;
    }
    this._buttonsBound = true;

    this._onClick(this._rescueButtons[0], this.onRescueChargeClick);
    this._onClick(this._rescueButtons[1], this.onRescueOverloadClick);
    this._onClick(this._rescueButtons[2], this.onRescueRepositionClick);
    this._onClick(this._enterShopBtn, this.onEnterShopClick);
    this._onClick(this._retryBtn, this.onRetryClick);
    this._onClick(this._restartBtn, this.onRestartClick);
  }

  /** 按节点名解析按钮，避免 @property(Button) 与节点 Button 重复注册 */
  private _resolveActionButtons(): void {
    this._enterShopBtn = this._findButton('EnterShopBtn');
    this._retryBtn = this._findButton('RetryBtn');
    this._restartBtn = this._findButton('RestartBtn');
    this._rescueButtons = ['RescueBtn1', 'RescueBtn2', 'RescueBtn3']
      .map((name) => this._findButton(name))
      .filter((btn): btn is Button => btn != null);

    if (this.rescueButtonLabels.length === 0) {
      this.rescueButtonLabels = ['RescueBtn1', 'RescueBtn2', 'RescueBtn3']
        .map((name) => this._findLabel(name))
        .filter((lbl): lbl is Label => lbl != null);
    }
  }

  private _findButton(nodeName: string): Button | null {
    const node = this._findNodeByName(nodeName);
    return node?.getComponent(Button) ?? null;
  }

  private _findLabel(buttonNodeName: string): Label | null {
    const btnNode = this._findNodeByName(buttonNodeName);
    return btnNode?.getComponentInChildren(Label) ?? null;
  }

  private _findNodeByName(name: string): Node | null {
    const stack: Node[] = [this.node];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.name === name) {
        return current;
      }
      stack.push(...current.children);
    }
    return null;
  }

  private _onClick(btn: Button | null, handler: () => void): void {
    if (!btn?.node?.isValid) {
      return;
    }
    btn.node.off(Button.EventType.CLICK, handler, this);
    btn.node.on(Button.EventType.CLICK, handler, this);
  }

  private _refreshHUD(hud: IBattleHUDView): void {
    if (this.roundLabel) {
      this.roundLabel.string = `第 ${hud.round} 回合`;
    }
    if (this.playerHPLabel) {
      const shield =
        hud.playerShield > 0
          ? ` (+${formatHpDisplay(hud.playerShield)}盾)`
          : '';
      this.playerHPLabel.string = `${formatHpDisplay(hud.playerHP)}/${formatHpDisplay(hud.playerMaxHP)}${shield}`;
    }
    if (this.enemyNameLabel) {
      this.enemyNameLabel.string = hud.enemyName;
    }
    if (this.enemyHPLabel) {
      this.enemyHPLabel.string = `${formatHpDisplay(hud.enemyHP)}/${formatHpDisplay(hud.enemyMaxHP)}`;
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

  private _refreshItemDisplay(app: NonNullable<ReturnType<BattleSceneView['_getApp']>>): void {
    if (!this.itemDisplay) {
      return;
    }
    const battle = app.getBattle();
    const poisonStacks = battle.getEnemyPoisonStacks();

    if (!this._itemDisplayInited) {
      this.itemDisplay.setDeps(app.getItemDisplayDeps(poisonStacks));
      this.itemDisplay.ensureToastListener((msg) => this._flashMessage(msg));
      this._itemDisplayInited = true;
    } else {
      this.itemDisplay.patchDeps({ enemyPoisonStacks: poisonStacks });
    }

    const items = battle.getEquippedItemsBySlot();
    this.itemDisplay.refreshEquippedSlots('battle_equipped', items, {
      battleSettled: battle.getPhase() === 'settlement',
    });
  }

  private _initItemDisplay(): void {
    this._resolveViewBindings();
    const app = this._getApp();
    if (!app || !this.itemDisplay || this._itemDisplayInited) {
      return;
    }
    if (!this._useItemDisplay()) {
      return;
    }
    this.itemDisplay.setDeps(
      app.getItemDisplayDeps(app.getBattle().getEnemyPoisonStacks()),
    );
    this.itemDisplay.ensureToastListener((msg) => this._flashMessage(msg));
    this._itemDisplayInited = true;
  }

  /** 战斗场景固定走 v4 ItemCardWidget（运行时自动生成 6 张卡） */
  private _useItemDisplay(): boolean {
    return this.itemDisplay?.areBattleSlotsReady() === true;
  }

  private _resolveViewBindings(): void {
    const canvas = this.node.scene?.getChildByName('Canvas') ?? this.node;
    const itemSlots = canvas.getChildByName('ItemSlots');

    if (!this.itemDisplay) {
      let root = canvas.getChildByName('ItemDisplayRoot');
      if (!root) {
        root = new Node('ItemDisplayRoot');
        canvas.addChild(root);
      }
      this.itemDisplay =
        root.getComponent(ItemDisplayController) ??
        root.addComponent(ItemDisplayController);
    }

    this.itemDisplay.ensureBattleSlotWidgets(itemSlots);
    this._bindingsResolved = true;
  }

  private _setLegacySlotsVisible(visible: boolean): void {
    if (!visible && this._legacySlotsHidden) {
      return;
    }
    if (visible) {
      this._legacySlotsHidden = false;
    }

    const canvas = this.node.scene?.getChildByName('Canvas') ?? this.node;
    const itemSlots = canvas.getChildByName('ItemSlots');
    if (itemSlots) {
      for (let i = 0; i < 6; i++) {
        const slot = itemSlots.getChildByName(`Slot${i}`);
        if (slot?.isValid) {
          slot.active = visible;
        }
      }
      if (!visible) {
        this._legacySlotsHidden = true;
      }
      return;
    }

    for (let i = 0; i < 6; i++) {
      const nameNode = this.slotNameLabels[i]?.node;
      if (nameNode?.isValid) {
        nameNode.active = visible;
      }
      const cdNode = this.slotCDLabels[i]?.node;
      if (cdNode?.isValid) {
        cdNode.active = visible;
      }
      const borderNode = this.slotBorders[i]?.node;
      if (borderNode?.isValid) {
        borderNode.active = visible;
      }
    }

    if (this.itemDisplay && !visible) {
      this._legacySlotsHidden = true;
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
      const btn = this._rescueButtons[i];
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
        this.messageLabel.string =
          '「重试」回退本回合 · 「重新开始」从第1关重来（清空金币装备）';
      } else if (settlement.canEnterShop) {
        const isFinalWin =
          settlement.result === 'victory' && settlement.round >= MAX_ROUND;
        this.messageLabel.string = isFinalWin
          ? '点击「查看通关」'
          : '点击「进入商店」购买装备';
      } else {
        this.messageLabel.string = '';
        this._settlementHintActive = false;
      }
    }
    if (this._enterShopBtn?.node?.isValid) {
      this._enterShopBtn.node.active = settlement.canEnterShop;
      if (settlement.canEnterShop) {
        const isFinalWin =
          settlement.result === 'victory' && settlement.round >= MAX_ROUND;
        const lbl = this._enterShopBtn.getComponentInChildren(Label);
        if (lbl) {
          lbl.string = isFinalWin ? '查看通关' : '进入商店';
        }
      }
    }
    if (this._retryBtn?.node?.isValid) {
      this._retryBtn.node.active = settlement.canRetry;
      this._retryBtn.interactable = settlement.canRetry;
    }
    if (this._restartBtn?.node?.isValid) {
      this._restartBtn.node.active = settlement.canRestart;
      this._restartBtn.interactable = settlement.canRestart;
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
