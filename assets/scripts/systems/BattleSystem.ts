/**
 * 战斗系统（v3）
 * 主循环：CD 更新 → 装备触发 → DOT tick → 敌人攻击 → 胜负判定
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { IItemConfig, EffectTarget } from '../config/ItemConfig';
import { GAME_CONSTANTS } from '../config/GameConstants';
import { calculateRealCD, roundBattleHp } from '../utils/MathUtil';
import { IEnemy } from '../models/Enemy';
import { IItemInstance } from '../models/ItemInstance';
import { CDSystem, ICDSystem } from './CDSystem';
import { IHeroSystem, IHeroSkillContext } from './HeroSystem';
import { DotSystem, IDotSystem, IDotDamageTarget } from './DotSystem';
import {
  EffectResolver,
  IEffectBattleContext,
} from './EffectResolver';
import { ModSystem, IModSystem } from './ModSystem';
import { BuffSystem, IBuffSystem } from './BuffSystem';
import { ProcChanceSystem, IProcChanceSystem } from './ProcChanceSystem';

export interface IBattleSystemDeps {
  eventBus: IEventBus;
  configTable: IConfigTable;
  cdSystem?: ICDSystem;
  heroSystem?: IHeroSystem;
  modSystem?: IModSystem;
  buffSystem?: IBuffSystem;
  procChanceSystem?: IProcChanceSystem;
  rng?: () => number;
}

export type BattleResult = 'ongoing' | 'victory' | 'defeat' | 'timeout';

export interface IBattleState {
  playerHP: number;
  playerMaxHP: number;
  playerShield: number;
  enemyHP: number;
  enemyMaxHP: number;
  result: BattleResult;
  elapsedTime: number;
}

export interface IBattleEndPayload {
  result: BattleResult;
  elapsedTime: number;
}

export interface IItemTriggeredPayload {
  item: IItemInstance;
  config: IItemConfig;
}

export interface IHasteAppliedPayload {
  source: IItemInstance;
  target: IItemInstance;
  amount: number;
}

export interface IDamageDealtPayload {
  source: string;
  target: 'enemy' | 'player';
  amount: number;
}

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
  /** 敌人身上 DOT 总层数（装备 scaling / 详情展示用） */
  getEnemyDotStacks(): number;
  applyEmergencyCharge(item: IItemInstance): void;
  swapEquipped(posA: number, posB: number): boolean;
  pauseForReposition(duration: number): void;
  endRepositionPause(): void;
}

export class BattleSystem implements IBattleSystem {
  private readonly _eventBus: IEventBus;
  private readonly _configTable: IConfigTable;
  private readonly _cdSystem: ICDSystem;
  private readonly _heroSystem: IHeroSystem | null;
  private readonly _modSystem: IModSystem;
  private readonly _buffSystem: IBuffSystem;
  private readonly _procChanceSystem: IProcChanceSystem;
  private readonly _rng: () => number;

  private _dotSystem: IDotSystem | null = null;
  private _lastDamageDealt = 0;
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

  private readonly _deferredQueue: IItemInstance[] = [];

  constructor(deps: IBattleSystemDeps) {
    this._eventBus = deps.eventBus;
    this._configTable = deps.configTable;
    this._cdSystem = deps.cdSystem ?? new CDSystem();
    this._heroSystem = deps.heroSystem ?? null;
    this._modSystem =
      deps.modSystem ?? new ModSystem(deps.eventBus, deps.configTable);
    this._rng = deps.rng ?? Math.random;
    this._buffSystem = deps.buffSystem ?? new BuffSystem();
    this._procChanceSystem =
      deps.procChanceSystem ??
      new ProcChanceSystem(deps.configTable, this._modSystem, this._rng);

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
    this._lastDamageDealt = 0;
    this._buffSystem.clearAll();
    this._cdSystem.clear();
    this._heroSystem?.resetForBattle();

    this._dotSystem = new DotSystem({
      eventBus: this._eventBus,
      getDotBoostMod: () => this._getDotBoostMod(),
      hasUnlockCap: () => this._hasUnlockCap(),
      resolveTarget: (id) => this._resolveDotTarget(id),
    });

    for (const item of this._items) {
      item.clearFrameFlag();
      item.hasteCount = 0;
      item.freezeRemaining = 0;
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
    this._dotSystem?.update(dt);
    this._buffSystem.update(dt);
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

    const result = this._heroSystem.activateSkill(this._createSkillContext());

    if (result && this._heroSystem.isOverloadActive()) {
      for (const item of this._items) {
        const cfg = this._configTable.getItem(item.configId);
        if (cfg?.tags.includes('tool')) {
          item.currentCD = GAME_CONSTANTS.OVERLOAD_CD_FORCED;
          this._cdSystem.register(item);
        }
      }
    }

    return result;
  }

  triggerItemImmediately(item: IItemInstance): void {
    if (this._result !== 'ongoing') {
      return;
    }
    item.currentCD = 0;
    this._cdSystem.unregister(item);
    if (!item.triggeredThisFrame) {
      this._triggerItem(item, true);
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

  getEnemyDotStacks(): number {
    const enemyId = this._enemy?.configId ?? 'enemy';
    return this._dotSystem?.getTotalStacks(enemyId) ?? 0;
  }

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
      applySelfPoison: (amount, sourceId) => {
        if (!this._dotSystem || amount <= 0) {
          return;
        }
        this._dotSystem.applyDot('player', 'poison', amount, undefined, sourceId);
      },
    };
  }

  private _createEffectContext(): IEffectBattleContext {
    const enemy = this._enemy;
    return {
      configTable: this._configTable,
      heroSystem: this._heroSystem,
      dotSystem: this._dotSystem!,
      getItems: () => this._items,
      getEnemyId: () => enemy?.configId ?? 'enemy',
      isEnemyAlive: () => enemy?.isAlive() ?? false,
      dealDamageToEnemy: (sourceId, amount, isCrit) => {
        if (!enemy?.isAlive()) {
          return;
        }
        const dealt = enemy.takeDamage(amount);
        this._eventBus.emit<IDamageDealtPayload>('damage_dealt', {
          source: sourceId,
          target: 'enemy',
          amount: dealt,
        });
        if (isCrit) {
          this._eventBus.emit('crit_hit', { source: sourceId, amount: dealt });
        }
      },
      getPlayerHP: () => this._playerHP,
      getPlayerMaxHP: () => this._playerMaxHP,
      getPlayerShield: () => this._playerShield,
      setPlayerHP: (hp) => {
        this._playerHP = hp;
      },
      setPlayerShield: (shield) => {
        this._playerShield = shield;
      },
      applyHasteToItems: (source, amount, targets) =>
        this._applyHaste(source, amount, targets),
      applyEnemyFreeze: (duration, target) =>
        this._applyFreeze(duration, target),
      getCDBreakMin: (item) => this._getCDBreakMin(item),
      getDotStacksOnEnemy: () =>
        this._dotSystem?.getTotalStacks(enemy?.configId ?? 'enemy') ?? 0,
      getTagBuffMultiplier: (tags) => this._buffSystem.getTagMultiplier(tags),
      addTagBuff: (target, multiplier, duration) =>
        this._buffSystem.addTagBuff(target, multiplier, duration),
      rollChance: (chance) => this._rng() < chance,
      getLastDamageDealt: () => this._lastDamageDealt,
      setLastDamageDealt: (amount) => {
        this._lastDamageDealt = amount;
      },
      emitHeal: (healed, overflow, tags) => {
        this._eventBus.emit('heal_applied', {
          amount: healed,
          hp: this._playerHP,
          tags,
          overflow,
        });
      },
      emitShield: (gained, tags) => {
        this._eventBus.emit('shield_gained', {
          amount: gained,
          total: this._playerShield,
          tags,
        });
      },
    };
  }

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

  private _deferTrigger(item: IItemInstance): void {
    if (!this._deferredQueue.includes(item)) {
      this._deferredQueue.push(item);
    }
  }

  private _triggerItem(item: IItemInstance, skipCDReset = false): void {
    if (this._result !== 'ongoing' || !this._dotSystem) {
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

    const modMechanism = this._modSystem.getModMechanismEffects(item);
    const modBonuses = this._modSystem.getModAttributeBonuses(item);
    EffectResolver.resolveAllEffects(
      item,
      config,
      this._createEffectContext(),
      modMechanism,
      modBonuses,
    );

    this._applyModHasteAfterTrigger(item, config);

    if (!skipCDReset) {
      const realCD = this._heroSystem
        ? this._heroSystem.getModifiedCD(config.baseCD, config.tags)
        : calculateRealCD(config.baseCD, 0, 1);
      item.resetCD(realCD);
      this._cdSystem.register(item);
    }

    this._procChanceSystem.onItemTriggered(item, this._items, (target) => {
      this.triggerItemImmediately(target);
    });
  }

  private _applyModHasteAfterTrigger(
    item: IItemInstance,
    config: IItemConfig,
  ): void {
    const hasteBonus = this._modSystem.getModAttributeBonuses(item).haste;
    if (!hasteBonus || hasteBonus <= 0) {
      return;
    }

    const minCD = this._getCDBreakMin(item);
    if (hasteBonus <= 0.15) {
      item.applyHaste(config.baseCD * hasteBonus, minCD);
    } else {
      item.applyHaste(hasteBonus, minCD);
    }

    if (item.currentCD > 0) {
      this._cdSystem.register(item);
    }
  }

  private _applyHaste(
    source: IItemInstance,
    amount: number,
    targets: IItemInstance[],
  ): void {
    for (const target of targets) {
      const minCD = this._getCDBreakMin(target);
      const prevCD = target.currentCD;
      target.applyHaste(amount, minCD);

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

  private _applyFreeze(duration: number, target: EffectTarget = 'enemy'): void {
    const enemy = this._enemy;

    if (
      (target === 'enemy_fastest' || target === 'enemy') &&
      enemy &&
      enemy.items.length > 0
    ) {
      let fastest = enemy.items[0];
      for (const item of enemy.items) {
        if (item.currentCD < fastest.currentCD) {
          fastest = item;
        }
      }
      fastest.freezeRemaining = Math.max(fastest.freezeRemaining, duration);
      this._eventBus.emit('freeze_applied', {
        targetItemId: fastest.instanceId,
        duration,
      });
      return;
    }

    this._enemyFreezeTimer = Math.max(this._enemyFreezeTimer, duration);
    this._eventBus.emit('enemy_frozen', { duration, target });
  }

  private _getCDBreakMin(target: IItemInstance): number {
    if (this._heroSystem?.isOverloadActive()) {
      const cfg = this._configTable.getItem(target.configId);
      if (cfg?.tags.includes('tool')) {
        return GAME_CONSTANTS.OVERLOAD_CD_FORCED;
      }
    }

    const targetCfg = this._configTable.getItem(target.configId);
    const isTool = targetCfg?.tags.includes('tool') ?? false;
    if (!isTool) {
      return GAME_CONSTANTS.CD_MIN;
    }

    for (const equipped of this._items) {
      const cfg = this._configTable.getItem(equipped.configId);
      if (!cfg) {
        continue;
      }
      for (const effect of cfg.effects) {
        if (effect.type === 'cd_break') {
          return effect.value > 0
            ? effect.value
            : GAME_CONSTANTS.CD_BREAK_MIN;
        }
      }
    }

    return GAME_CONSTANTS.CD_MIN;
  }

  private _hasUnlockCap(): boolean {
    return this._items.some((item) => {
      const cfg = this._configTable.getItem(item.configId);
      return cfg?.effects.some((e) => e.type === 'unlock_cap') ?? false;
    });
  }

  private _getDotBoostMod(): number {
    let boost = 1;
    const hero = this._heroSystem?.getHero();
    if (hero?.passiveConfig.type === 'dot_boost') {
      boost *= 1 + hero.passiveConfig.value;
    }
    if (this._heroSystem && this._heroSystem.getDotBoostTimer() > 0) {
      boost *= 2;
    }
    return boost;
  }

  private _resolveDotTarget(targetId: string): IDotDamageTarget | null {
    if (targetId === 'player') {
      return {
        id: 'player',
        getHP: () => this._playerHP,
        applyDotDamage: (amount) => {
          const before = this._playerHP;
          this._playerHP = roundBattleHp(this._playerHP - amount);
          const dealt = before - this._playerHP;
          if (dealt > 0) {
            this._eventBus.emit<IDamageDealtPayload>('damage_dealt', {
              source: 'dot',
              target: 'player',
              amount: dealt,
            });
          }
          return dealt;
        },
      };
    }

    if (this._enemy && (targetId === this._enemy.configId || targetId === 'enemy')) {
      const enemy = this._enemy;
      return {
        id: enemy.configId,
        getHP: () => enemy.hp,
        applyDotDamage: (amount) => {
          const dealt = enemy.takeDamage(amount);
          if (dealt > 0) {
            this._eventBus.emit<IDamageDealtPayload>('damage_dealt', {
              source: 'dot',
              target: 'enemy',
              amount: dealt,
            });
          }
          return dealt;
        },
      };
    }

    return null;
  }

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
    this._dotSystem?.clearAllDots();
    this._buffSystem.clearAll();
    this._eventBus.emit<IBattleEndPayload>('battle_end', {
      result,
      elapsedTime: this._elapsedTime,
    });
  }
}
