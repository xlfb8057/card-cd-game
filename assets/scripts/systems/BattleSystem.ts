/**
 * 战斗系统
 * 主循环：CD 更新 → 装备触发 → 加速循环 → 敌人攻击 → 胜负判定
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { IItemEffect, IItemConfig } from '../config/ItemConfig';
import { IItemInstance } from '../models/ItemInstance';
import { IEnemy } from '../models/Enemy';
import { CDSystem, ICDSystem } from './CDSystem';
import { IHeroSystem, IHeroSkillContext } from './HeroSystem';
import {
  calculateDamage,
  calculateRealCD,
  applyShield,
  applyHeal,
  getAdjacentPositions,
  SHIELD_MAX_RATIO,
} from '../utils/MathUtil';

/** 战斗结果 */
export type BattleResult = 'ongoing' | 'victory' | 'defeat' | 'timeout';

/** 战斗状态快照 */
export interface IBattleState {
  playerHP: number;
  playerMaxHP: number;
  playerShield: number;
  enemyHP: number;
  enemyMaxHP: number;
  result: BattleResult;
  elapsedTime: number;
}

/** 战斗系统依赖 */
export interface IBattleSystemDeps {
  eventBus: IEventBus;
  configTable: IConfigTable;
  cdSystem?: ICDSystem;
  heroSystem?: IHeroSystem;
}

/** 战斗结束事件 */
export interface IBattleEndPayload {
  result: BattleResult;
  elapsedTime: number;
}

/** 装备触发事件 */
export interface IItemTriggeredPayload {
  item: IItemInstance;
  config: IItemConfig;
}

/** 加速应用事件 */
export interface IHasteAppliedPayload {
  source: IItemInstance;
  target: IItemInstance;
  amount: number;
}

/** 伤害事件 */
export interface IDamageDealtPayload {
  source: string;
  target: 'enemy' | 'player';
  amount: number;
}

/** BattleSystem 对外接口 */
export interface IBattleSystem {
  startBattle(
    items: IItemInstance[],
    enemy: IEnemy,
    playerHP: number,
    playerMaxHP: number,
  ): void;
  update(dt: number): void;
  getState(): Readonly<IBattleState>;
  isPaused(): boolean;
  setPaused(paused: boolean): void;
  activateHeroSkill(): boolean;
  triggerItemImmediately(item: IItemInstance): void;
  removeItem(item: IItemInstance): void;
  getItems(): IItemInstance[];
  applyEmergencyCharge(item: IItemInstance): void;
  swapEquipped(posA: number, posB: number): boolean;
  pauseForReposition(duration: number): void;
  endRepositionPause(): void;
}

/**
 * 战斗系统实现
 */
export class BattleSystem implements IBattleSystem {
  private readonly _eventBus: IEventBus;
  private readonly _configTable: IConfigTable;
  private readonly _cdSystem: ICDSystem;
  private readonly _heroSystem: IHeroSystem | null;

  private _items: IItemInstance[] = [];
  private _enemy: IEnemy | null = null;
  private _playerHP = 0;
  private _playerMaxHP = 0;
  private _playerShield = 0;
  private _result: BattleResult = 'ongoing';
  private _elapsedTime = 0;
  private _paused = false;
  private _repositionPauseTimer = 0;
  private _enemyFreezeTimer = 0;

  /** 下帧待触发队列（单帧触发上限） */
  private readonly _deferredQueue: IItemInstance[] = [];

  constructor(deps: IBattleSystemDeps) {
    this._eventBus = deps.eventBus;
    this._configTable = deps.configTable;
    this._cdSystem = deps.cdSystem ?? new CDSystem();
    this._heroSystem = deps.heroSystem ?? null;

    if (this._heroSystem) {
      this._heroSystem.onOverloadEnd(() => {
        this._destroyRandomTool();
      });
    }
  }

  startBattle(
    items: IItemInstance[],
    enemy: IEnemy,
    playerHP: number,
    playerMaxHP: number,
  ): void {
    this._items = items;
    this._enemy = enemy;
    this._playerHP = playerHP;
    this._playerMaxHP = playerMaxHP;
    this._playerShield = 0;
    this._result = 'ongoing';
    this._elapsedTime = 0;
    this._deferredQueue.length = 0;
    this._enemyFreezeTimer = 0;
    this._cdSystem.clear();
    this._heroSystem?.resetForBattle();

    for (const item of this._items) {
      item.clearFrameFlag();
      item.hasteCount = 0;
      this._cdSystem.register(item);
    }
  }

  update(dt: number): void {
    if (this._paused || this._result !== 'ongoing' || !this._enemy) {
      return;
    }

    this._elapsedTime += dt;
    this._enemy.elapsedTime = this._elapsedTime;

    for (const item of this._items) {
      item.clearFrameFlag();
    }

    this._processDeferredQueue();
    this._heroSystem?.update(dt);
    if (this._repositionPauseTimer > 0) {
      this._repositionPauseTimer = Math.max(0, this._repositionPauseTimer - dt);
      if (this._repositionPauseTimer <= 0) {
        this.endRepositionPause();
      }
    }
    if (this._enemyFreezeTimer > 0) {
      this._enemyFreezeTimer = Math.max(0, this._enemyFreezeTimer - dt);
    }
    this._tickItemCDs(dt);
    this._tickEnemyAttack(dt);
    this._checkBattleEnd();
  }

  getState(): Readonly<IBattleState> {
    return {
      playerHP: this._playerHP,
      playerMaxHP: this._playerMaxHP,
      playerShield: this._playerShield,
      enemyHP: this._enemy?.hp ?? 0,
      enemyMaxHP: this._enemy?.maxHP ?? 0,
      result: this._result,
      elapsedTime: this._elapsedTime,
    };
  }

  isPaused(): boolean {
    return this._paused;
  }

  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  activateHeroSkill(): boolean {
    if (!this._heroSystem) {
      return false;
    }
    return this._heroSystem.activateSkill(this._createSkillContext());
  }

  triggerItemImmediately(item: IItemInstance): void {
    if (this._result !== 'ongoing') {
      return;
    }
    item.currentCD = 0;
    this._cdSystem.unregister(item);
    if (!item.triggeredThisFrame) {
      this._triggerItem(item);
    } else {
      this._deferTrigger(item);
    }
  }

  removeItem(item: IItemInstance): void {
    this._cdSystem.unregister(item);
    this._items = this._items.filter((i) => i.instanceId !== item.instanceId);
    this._eventBus.emit('item_destroyed', { itemId: item.configId });
  }

  getItems(): IItemInstance[] {
    return [...this._items];
  }

  /** 紧急充能：CD × 0.5，≤1 秒时立即触发 */
  applyEmergencyCharge(item: IItemInstance): void {
    const before = item.currentCD;
    item.currentCD *= 0.5;

    if (item.currentCD > 0) {
      this._cdSystem.register(item);
    } else {
      item.currentCD = 0;
      this._cdSystem.unregister(item);
    }

    this._eventBus.emit('emergency_charge', {
      itemId: item.configId,
      before,
      after: item.currentCD,
    });

    if (item.currentCD <= 1 && before > 0) {
      this.triggerItemImmediately(item);
    }
  }

  swapEquipped(posA: number, posB: number): boolean {
    const itemA = this._items.find((i) => i.position === posA);
    const itemB = this._items.find((i) => i.position === posB);

    if (!itemA && !itemB) {
      return false;
    }

    if (itemA) {
      itemA.position = posB;
    }
    if (itemB) {
      itemB.position = posA;
    }

    this._eventBus.emit('battle_items_swapped', { posA, posB });
    return true;
  }

  pauseForReposition(duration: number): void {
    this._paused = true;
    this._repositionPauseTimer = duration;
  }

  endRepositionPause(): void {
    this._paused = false;
    this._repositionPauseTimer = 0;
  }

  private _createSkillContext(): IHeroSkillContext {
    return {
      getItems: () => this._items,
      triggerItemImmediately: (item) => this.triggerItemImmediately(item),
      removeItem: (item) => this.removeItem(item),
      getPlayerHP: () => this._playerHP,
      setPlayerHP: (hp) => {
        this._playerHP = hp;
      },
    };
  }

  /** 处理上帧 deferred 的装备触发 */
  private _processDeferredQueue(): void {
    if (this._deferredQueue.length === 0) {
      return;
    }

    const queue = this._deferredQueue.splice(0);
    queue.sort((a, b) => a.position - b.position);

    for (const item of queue) {
      if (item.canTrigger() && !item.triggeredThisFrame) {
        this._triggerItem(item);
      }
    }
  }

  /** CD 系统 tick + 触发就绪装备 */
  private _tickItemCDs(dt: number): void {
    const { readyItems } = this._cdSystem.update(dt);
    const readySet = new Set(readyItems);
    const alreadyReadyItems = this._items.filter(
      (item) => item.canTrigger() && !readySet.has(item),
    );
    const toTrigger = [...readyItems, ...alreadyReadyItems];
    toTrigger.sort((a, b) => a.position - b.position);

    for (const item of toTrigger) {
      if (!item.canTrigger()) {
        continue;
      }
      if (item.triggeredThisFrame) {
        this._deferTrigger(item);
        continue;
      }
      this._triggerItem(item);
    }
  }

  /** 单帧触发上限：加入下帧队列 */
  private _deferTrigger(item: IItemInstance): void {
    if (!this._deferredQueue.includes(item)) {
      this._deferredQueue.push(item);
    }
  }

  /** 触发单件装备 */
  private _triggerItem(item: IItemInstance): void {
    if (this._result !== 'ongoing') {
      return;
    }

    const config = this._configTable.getItem(item.configId);
    if (!config) {
      return;
    }

    item.markTriggered();
    this._eventBus.emit<IItemTriggeredPayload>('item_triggered', {
      item,
      config,
    });

    let critMultiplier = 1;
    for (const effect of config.effects) {
      if (effect.type === 'crit') {
        critMultiplier = effect.value;
      }
    }

    for (const effect of config.effects) {
      this._executeEffect(item, config, effect, critMultiplier);
    }

    const realCD = this._heroSystem
      ? this._heroSystem.getModifiedCD(config.baseCD, config.tags)
      : calculateRealCD(config.baseCD, 0, 1);
    item.resetCD(realCD);
    this._cdSystem.register(item);
  }

  /** 执行单条效果 */
  private _executeEffect(
    source: IItemInstance,
    config: IItemConfig,
    effect: IItemEffect,
    critMultiplier: number,
  ): void {
    const mult = this._heroSystem
      ? this._heroSystem.getEffectMultiplier(config.tags, effect.type)
      : 1;
    const scaledValue = effect.value * mult;

    switch (effect.type) {
      case 'damage':
        this._applyDamage(source, scaledValue, critMultiplier);
        break;
      case 'haste':
        this._applyHaste(source, scaledValue, effect.target);
        break;
      case 'shield':
        this._applyShieldEffect(scaledValue, config.tags);
        break;
      case 'heal':
        this._applyHealEffect(scaledValue, config.tags);
        break;
      case 'dot':
        this._applyDamage(source, scaledValue, 1);
        break;
      case 'crit':
        break;
      case 'freeze':
        this._applyFreeze(scaledValue);
        break;
      default:
        break;
    }
  }

  private _applyDamage(
    source: IItemInstance,
    baseDamage: number,
    critMultiplier: number,
  ): void {
    if (!this._enemy?.isAlive()) {
      return;
    }

    const amount = calculateDamage(baseDamage, 0, critMultiplier);
    const dealt = this._enemy.takeDamage(amount);

    this._eventBus.emit<IDamageDealtPayload>('damage_dealt', {
      source: source.configId,
      target: 'enemy',
      amount: dealt,
    });
  }

  /** 加速循环核心：给目标装备减 CD，硬下限 0.3 秒 */
  private _applyHaste(
    source: IItemInstance,
    amount: number,
    targetType: IItemEffect['target'],
  ): void {
    const targets = this._resolveHasteTargets(source, targetType);

    for (const target of targets) {
      const prevCD = target.currentCD;
      target.applyHaste(amount);

      this._eventBus.emit<IHasteAppliedPayload>('haste_applied', {
        source,
        target,
        amount,
      });

      if (target.currentCD > 0) {
        this._cdSystem.register(target);
      } else if (prevCD > 0 && target.canTrigger()) {
        if (target.triggeredThisFrame) {
          this._deferTrigger(target);
        } else {
          this._triggerItem(target);
        }
      }
    }
  }

  private _resolveHasteTargets(
    source: IItemInstance,
    targetType: IItemEffect['target'],
  ): IItemInstance[] {
    switch (targetType) {
      case 'adjacent':
        return this._getItemsAtPositions(
          getAdjacentPositions(source.position),
        );
      case 'all_tools':
        return this._items.filter((item) => {
          const cfg = this._configTable.getItem(item.configId);
          return cfg?.tags.includes('tool');
        });
      case 'self':
        return [source];
      default:
        return this._getItemsAtPositions(
          getAdjacentPositions(source.position),
        );
    }
  }

  private _getItemsAtPositions(positions: number[]): IItemInstance[] {
    return this._items.filter((item) => positions.includes(item.position));
  }

  private _applyShieldEffect(amount: number, itemTags: string[]): void {
    const maxShield = Math.floor(this._playerMaxHP * SHIELD_MAX_RATIO);
    this._playerShield = applyShield(this._playerShield, amount, maxShield);
    this._eventBus.emit('shield_gained', {
      amount,
      total: this._playerShield,
      tags: itemTags,
    });
  }

  private _applyHealEffect(amount: number, itemTags: string[]): void {
    const before = this._playerHP;
    this._playerHP = applyHeal(this._playerHP, amount, this._playerMaxHP);
    const healed = this._playerHP - before;

    const overflow = amount - healed;
    if (
      overflow > 0 &&
      this._heroSystem?.getHero()?.passiveConfig.overflowToShield
    ) {
      const ratio = this._heroSystem.getHero()!.passiveConfig.overflowToShield!;
      const maxShield = Math.floor(this._playerMaxHP * SHIELD_MAX_RATIO);
      this._playerShield = applyShield(
        this._playerShield,
        Math.floor(overflow * ratio),
        maxShield,
      );
    }

    this._eventBus.emit('heal_applied', {
      amount: healed,
      hp: this._playerHP,
      tags: itemTags,
    });
  }

  private _applyFreeze(duration: number): void {
    this._enemyFreezeTimer = Math.max(this._enemyFreezeTimer, duration);
    this._eventBus.emit('enemy_frozen', { duration });
  }

  /** 斯黛拉过载结束：随机销毁 1 件 tool 装备 */
  private _destroyRandomTool(): void {
    const tools = this._items.filter((item) => {
      const cfg = this._configTable.getItem(item.configId);
      return cfg?.tags.includes('tool');
    });

    if (tools.length === 0) {
      return;
    }

    const idx = Math.floor(Math.random() * tools.length);
    this.removeItem(tools[idx]);
  }

  /** 敌人攻击循环 */
  private _tickEnemyAttack(dt: number): void {
    if (!this._enemy?.isAlive()) {
      return;
    }

    if (this._enemyFreezeTimer > 0) {
      return;
    }

    if (!this._enemy.tickAttackCD(dt)) {
      return;
    }

    let remaining = this._enemy.damage;

    if (this._playerShield > 0) {
      const absorbed = Math.min(this._playerShield, remaining);
      this._playerShield -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) {
      this._playerHP = Math.max(0, this._playerHP - remaining);
      this._eventBus.emit<IDamageDealtPayload>('damage_dealt', {
        source: this._enemy.configId,
        target: 'player',
        amount: remaining,
      });
    }

    this._enemy.resetAttackCD();
  }

  private _checkBattleEnd(): void {
    if (!this._enemy) {
      return;
    }

    if (this._playerHP <= 0) {
      this._endBattle('defeat');
      return;
    }

    if (!this._enemy.isAlive()) {
      this._endBattle('victory');
      return;
    }

    if (
      this._enemy.timeLimit !== undefined &&
      this._elapsedTime >= this._enemy.timeLimit
    ) {
      this._endBattle('timeout');
    }
  }

  private _endBattle(result: BattleResult): void {
    this._result = result;
    this._eventBus.emit<IBattleEndPayload>('battle_end', {
      result,
      elapsedTime: this._elapsedTime,
    });
  }
}
