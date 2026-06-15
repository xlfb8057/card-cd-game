/**
 * 战斗场景控制器
 * 整合 BattleSystem、救场、UI 视图模型
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { IStateManager } from '../core/StateManager';
import {
  BattleSystem,
  BattleResult,
  IItemTriggeredPayload,
  IHasteAppliedPayload,
  IDamageDealtPayload,
  IBattleEndPayload,
} from '../systems/BattleSystem';
import { IHeroSystem } from '../systems/HeroSystem';
import { IEconomySystem } from '../systems/EconomySystem';
import { IInventorySystem } from '../systems/InventorySystem';
import { IGameSession } from '../systems/GameSession';
import { RescueSystem } from '../systems/RescueSystem';
import { BattleRescueContext } from '../systems/BattleRescueContext';
import { RescuePanel, IRescueButtonView } from './RescuePanel';
import { ItemSlotController, IItemSlotView } from './ItemSlot';
import {
  BattleLogController,
  IBattleLogEntry,
  BattleLogColors,
} from './BattleLog';
import { createEnemyFromConfig } from '../models/EnemyFactory';
import { IItemInstance } from '../models/ItemInstance';
import {
  ROUND_ENEMY_IDS,
  TUTORIAL_ITEM_IDS,
  getBattleGoldReward,
} from '../config/RoundConfig';

/** 战斗 HUD */
export interface IBattleHUDView {
  round: number;
  playerHP: number;
  playerMaxHP: number;
  playerShield: number;
  enemyHP: number;
  enemyMaxHP: number;
  enemyName: string;
  gold: number;
  elapsedTime: number;
}

/** 飘字 */
export interface IFloatingText {
  id: number;
  text: string;
  color: string;
  slotPosition?: number;
  target: 'enemy' | 'player' | 'slot';
}

/** 战斗结算面板 */
export interface IBattleSettlementView {
  result: BattleResult;
  round: number;
  goldReward: number;
  canRetry: boolean;
  canEnterShop: boolean;
  canRestart: boolean;
  message: string;
}

export type BattleScenePhase = 'fighting' | 'settlement';

/**
 * 战斗场景逻辑控制器
 */
export class BattleSceneController {
  private readonly _slots: ItemSlotController[] = [];
  private readonly _log: BattleLogController;
  private readonly _battle: BattleSystem;
  private readonly _rescue: RescueSystem;
  private readonly _rescuePanel: RescuePanel;
  private readonly _rescueCtx: BattleRescueContext;

  private _round = 1;
  private _phase: BattleScenePhase = 'fighting';
  private _settlement: IBattleSettlementView | null = null;
  private _floatTexts: IFloatingText[] = [];
  private _floatId = 0;
  private _enemyName = '';

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _state: IStateManager,
    private readonly _configTable: IConfigTable,
    private readonly _economy: IEconomySystem,
    private readonly _inventory: IInventorySystem,
    private readonly _session: IGameSession,
    private readonly _heroSystem: IHeroSystem,
    battle: BattleSystem,
    rescueCtx: BattleRescueContext,
    rescue: RescueSystem,
    rescuePanel: RescuePanel,
  ) {
    this._battle = battle;
    this._rescueCtx = rescueCtx;
    this._rescue = rescue;
    this._rescuePanel = rescuePanel;
    this._log = new BattleLogController();

    for (let i = 0; i < 6; i++) {
      this._slots.push(new ItemSlotController(_configTable));
    }

    this._wireEvents();
  }

  /** 开始指定回合战斗 */
  startRound(round: number): void {
    this._round = round;
    this._phase = 'fighting';
    this._settlement = null;
    this._log.clear();
    this._floatTexts = [];

    this._rescue.resetForBattle();
    this._rescueCtx.setCurrentRound(round);
    this._rescuePanel.enterBattle(round);

    if (round === 1 && this._inventory.getAllEquipped().length === 0) {
      this._grantTutorialItems();
    }

    const enemyId = ROUND_ENEMY_IDS[round] ?? 'slime';
    const enemyCfg = this._configTable.getEnemy(enemyId);
    if (!enemyCfg) {
      return;
    }

    this._enemyName = enemyCfg.name;
    const enemy = createEnemyFromConfig(enemyCfg);
    const items = this._inventory.getAllEquipped();
    const s = this._state.getState();

    // 开战前快照：失败时可回退到本回合准备阶段
    this._session.takeRoundSnapshot();

    this._battle.startBattle(items, enemy, s.hp, s.maxHP);
    this._syncSlotsFromBattle();
    this._log.addEntry(
      round,
      `战斗开始 vs ${enemyCfg.name}`,
      BattleLogColors.info,
    );
  }

  update(dt: number): void {
    if (this._phase !== 'fighting') {
      return;
    }

    this._battle.update(dt);
    this._rescue.update(dt);
    this._syncSlotsFromBattle();

    for (const slot of this._slots) {
      slot.tickAnim(dt);
    }
  }

  getPhase(): BattleScenePhase {
    return this._phase;
  }

  getHUD(): IBattleHUDView {
    const bs = this._battle.getState();
    return {
      round: this._round,
      playerHP: bs.playerHP,
      playerMaxHP: bs.playerMaxHP,
      playerShield: bs.playerShield,
      enemyHP: bs.enemyHP,
      enemyMaxHP: bs.enemyMaxHP,
      enemyName: this._enemyName,
      gold: this._economy.currentGold,
      elapsedTime: bs.elapsedTime,
    };
  }

  getItemSlotViews(): IItemSlotView[] {
    return this._slots.map((s) => s.getView());
  }

  /** v4 装备展示：按槽位返回战斗中的装备实例（含实时 CD） */
  getEquippedItemsBySlot(): (IItemInstance | null)[] {
    const items = this._battle.getItems();
    const result: (IItemInstance | null)[] = new Array(6).fill(null);
    for (const item of items) {
      if (item.position >= 0 && item.position < 6) {
        result[item.position] = item;
      }
    }
    return result;
  }

  getLogEntries(): IBattleLogEntry[] {
    return this._log.getEntries();
  }

  getFloatingTexts(): IFloatingText[] {
    return [...this._floatTexts];
  }

  getRescueButtons(): IRescueButtonView[] {
    return this._rescuePanel.getButtons(this._round);
  }

  getSettlement(): IBattleSettlementView | null {
    return this._settlement;
  }

  /** 点击救场：紧急充能选装备 */
  onRescueChargeSelect(item: IItemInstance | null): boolean {
    return this._rescuePanel.onItemSlotClick(item);
  }

  onRescueChargeButton(): void {
    this._rescuePanel.onChargeButtonClick();
  }

  onRescueOverload(): boolean {
    const hero = this._heroSystem.getHero();
    return hero ? this._rescuePanel.onOverloadButtonClick(hero) : false;
  }

  onRescueReposition(): boolean {
    return this._rescuePanel.onRepositionButtonClick();
  }

  onSwapDuringReposition(posA: number, posB: number): boolean {
    return this._rescuePanel.onSwapSlots(posA, posB);
  }

  /** 结算后进入商店 */
  confirmEnterShop(): void {
    if (!this._settlement) {
      return;
    }

    if (this._settlement?.result === 'victory') {
      this._economy.settleRound(this._round, true);
      const reward = getBattleGoldReward(this._round, true);
      this._economy.addGold(reward);
    }

    this._state.setState({
      hp: this._battle.getState().playerHP,
      gold: this._economy.currentGold,
    });

    const won = this._settlement?.result === 'victory';
    this._session.takeRoundSnapshot();
    this._session.saveToDisk('shop');
    this._rescuePanel.leaveBattle();
    this._phase = 'fighting';
    this._settlement = null;

    this._eventBus.emit('battle_to_shop', {
      round: this._round,
      victory: won,
    });
  }

  /** 失败后回退到本回合准备阶段（快照） */
  retryFromSnapshot(): boolean {
    const ok = this._session.restoreToRound(this._round);
    if (ok) {
      this._settlement = null;
      this._phase = 'fighting';
      this._eventBus.emit('battle_retry', { round: this._round });
      this.startRound(this._round);
    }
    return ok;
  }

  private _grantTutorialItems(): void {
    TUTORIAL_ITEM_IDS.forEach((id, idx) => {
      const cfg = this._configTable.getItem(id);
      if (!cfg) {
        return;
      }
      const item = this._inventory.createItemInstance(id, 0, idx);
      if (item) {
        this._inventory.equipAt(item, idx);
      }
    });
  }

  private _syncSlotsFromBattle(): void {
    const items = this._battle.getItems();
    for (let i = 0; i < 6; i++) {
      const item = items.find((it) => it.position === i) ?? null;
      this._slots[i].bindItem(item, i);
    }
  }

  private _wireEvents(): void {
    this._eventBus.on<IItemTriggeredPayload>('item_triggered', (p) => {
      if (!p) {
        return;
      }
      const slot = this._slots[p.item.position];
      slot?.triggerScaleAnim();
      const name =
        this._configTable.getItem(p.item.configId)?.name ?? p.item.configId;
      this._log.addEntry(
        this._round,
        `${name} 触发`,
        BattleLogColors.info,
      );
    });

    this._eventBus.on<IHasteAppliedPayload>('haste_applied', (p) => {
      if (!p) {
        return;
      }
      const targetName =
        this._configTable.getItem(p.target.configId)?.name ??
        p.target.configId;
      const sourceName =
        this._configTable.getItem(p.source.configId)?.name ??
        p.source.configId;
      this._log.addEntry(
        this._round,
        `${sourceName} 给 ${targetName} 加速 -${p.amount.toFixed(1)}s`,
        BattleLogColors.haste,
      );
      this._addFloatText(
        `-${p.amount.toFixed(1)}s`,
        BattleLogColors.haste,
        'slot',
        p.target.position,
      );
      this._slots[p.target.position]?.setPulseRed(true);
    });

    this._eventBus.on<IDamageDealtPayload>('damage_dealt', (p) => {
      if (!p) {
        return;
      }
      if (p.target === 'enemy') {
        this._log.addEntry(
          this._round,
          `造成 ${p.amount} 伤害`,
          BattleLogColors.damage,
        );
        this._addFloatText(`-${p.amount}`, BattleLogColors.damage, 'enemy');
      } else {
        this._log.addEntry(
          this._round,
          `受到 ${p.amount} 伤害`,
          BattleLogColors.damage,
        );
      }
    });

    this._eventBus.on('shield_gained', (p: { amount: number } | undefined) => {
      if (p) {
        this._log.addEntry(
          this._round,
          `获得 ${p.amount} 护盾`,
          BattleLogColors.shield,
        );
      }
    });

    this._eventBus.on('heal_applied', (p: { amount: number } | undefined) => {
      if (p) {
        this._log.addEntry(
          this._round,
          `治疗 ${p.amount} HP`,
          BattleLogColors.heal,
        );
      }
    });

    this._eventBus.on<IBattleEndPayload>('battle_end', (p) => {
      if (!p) {
        return;
      }
      this._onBattleEnd(p.result);
    });
  }

  private _onBattleEnd(result: BattleResult): void {
    this._rescuePanel.leaveBattle();
    const won = result === 'victory';
    const reward = getBattleGoldReward(this._round, won);

    let message = won ? '胜利！' : '失败...';
    if (result === 'timeout') {
      message = '超时失败';
    }

    this._settlement = {
      result,
      round: this._round,
      goldReward: reward,
      canRetry: !won,
      canEnterShop: won,
      canRestart: !won,
      message,
    };

    this._phase = 'settlement';
    this._log.addEntry(
      this._round,
      message,
      won ? BattleLogColors.victory : BattleLogColors.defeat,
    );

    this._eventBus.emit('battle_settlement', this._settlement);
  }

  private _addFloatText(
    text: string,
    color: string,
    target: IFloatingText['target'],
    slotPosition?: number,
  ): void {
    this._floatTexts.push({
      id: ++this._floatId,
      text,
      color,
      target,
      slotPosition,
    });
    if (this._floatTexts.length > 20) {
      this._floatTexts.shift();
    }
  }
}
