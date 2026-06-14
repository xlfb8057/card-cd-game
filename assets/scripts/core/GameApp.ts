/**
 * 游戏总控
 * 整合全部 System，驱动 5 回合 battle ↔ shop 流程
 */

import { EventBus } from '../core/EventBus';
import { StateManager, IStateManager } from '../core/StateManager';
import { ConfigTable, IConfigLoader } from '../core/ConfigTable';
import { SnapshotManager } from '../core/SnapshotManager';
import { EconomySystem } from '../systems/EconomySystem';
import { InventorySystem } from '../systems/InventorySystem';
import { ShopSystem } from '../systems/ShopSystem';
import { BattleSystem } from '../systems/BattleSystem';
import { HeroSystem } from '../systems/HeroSystem';
import { RescueSystem } from '../systems/RescueSystem';
import { BattleRescueContext } from '../systems/BattleRescueContext';
import { SaveManager } from '../systems/SaveManager';
import { GameSession } from '../systems/GameSession';
import { ShopScene } from '../ui/ShopScene';
import { BattleSceneController } from '../ui/BattleScene';
import { RescuePanel } from '../ui/RescuePanel';
import { createStorageAPI, MemoryStorageAPI } from '../utils/StorageAPI';
import { MAX_ROUND } from '../config/RoundConfig';
import { resetInstanceIdCounter } from '../models/ItemInstance';
import { preloadLaterAssetsIfNeeded } from '../platform/SubpackageLoader';

export type GameSceneType = 'menu' | 'battle' | 'shop' | 'gameover';

/** GameApp 对外接口 */
export interface IGameApp {
  initialize(): Promise<void>;
  selectHero(heroId: string): boolean;
  startNewGame(): void;
  hasContinueSave(): boolean;
  continueGame(): boolean;
  getScene(): GameSceneType;
  tick(dt: number): void;
  enterShop(victory?: boolean): void;
  startBattle(): void;
  getBattle(): BattleSceneController;
  getShop(): ShopScene;
  getState(): IStateManager;
  getEconomy(): EconomySystem;
  getInventory(): InventorySystem;
}

/**
 * 游戏应用入口（Cocos 场景 onLoad 中创建此类）
 */
export class GameApp implements IGameApp {
  private readonly _eventBus = new EventBus();
  private readonly _state = StateManager.getInstance();
  private readonly _snapshots = new SnapshotManager();

  private _configTable!: ConfigTable;
  private _economy!: EconomySystem;
  private _inventory!: InventorySystem;
  private _shop!: ShopSystem;
  private _battle!: BattleSystem;
  private _heroSystem!: HeroSystem;
  private _rescue!: RescueSystem;
  private _rescueCtx!: BattleRescueContext;
  private _rescuePanel!: RescuePanel;
  private _session!: GameSession;
  private _shopScene!: ShopScene;
  private _battleScene!: BattleSceneController;

  private _scene: GameSceneType = 'menu';
  private _heroId = '';

  constructor(
    private readonly _configLoader: IConfigLoader,
    private readonly _useMemoryStorage = false,
  ) {}

  async initialize(): Promise<void> {
    this._configTable = new ConfigTable(this._configLoader);
    await this._configTable.loadAll();

    this._economy = new EconomySystem(this._eventBus);
    this._inventory = new InventorySystem(
      this._eventBus,
      this._configTable,
      this._economy,
    );
    this._shop = new ShopSystem(
      this._eventBus,
      this._configTable,
      this._economy,
      this._inventory,
    );
    this._heroSystem = new HeroSystem(this._eventBus, this._configTable);
    this._battle = new BattleSystem({
      eventBus: this._eventBus,
      configTable: this._configTable,
      heroSystem: this._heroSystem,
    });
    this._rescueCtx = new BattleRescueContext(this._battle);
    this._rescue = new RescueSystem(this._eventBus, this._rescueCtx);
    this._rescuePanel = new RescuePanel(this._eventBus, this._rescue);

    const storage = this._useMemoryStorage
      ? new MemoryStorageAPI()
      : createStorageAPI();
    const saveManager = new SaveManager(storage);

    this._session = new GameSession(
      this._state,
      this._economy,
      this._inventory,
      this._snapshots,
      saveManager,
    );

    this._shopScene = new ShopScene(
      this._eventBus,
      this._state,
      this._economy,
      this._shop,
      this._inventory,
      this._configTable,
    );

    this._battleScene = new BattleSceneController(
      this._eventBus,
      this._state,
      this._configTable,
      this._economy,
      this._inventory,
      this._session,
      this._heroSystem,
      this._battle,
      this._rescueCtx,
      this._rescue,
      this._rescuePanel,
    );

    this._eventBus.on('battle_to_shop', (p: { victory?: boolean } | undefined) => {
      this.enterShop(p?.victory ?? false);
    });
  }

  selectHero(heroId: string): boolean {
    if (!this._heroSystem.loadHeroById(heroId)) {
      return false;
    }
    this._heroId = heroId;
    return true;
  }

  startNewGame(): void {
    resetInstanceIdCounter();
    this._state.reset({
      round: 1,
      hp: 100,
      maxHP: 100,
      gold: 0,
      heroId: this._heroId,
    });
    this._economy.setGold(0);
    this._economy.restoreEconomy(0, 0, 0, 0);
    this._inventory.clearAll();
    this._snapshots.clear();
    this._scene = 'battle';
    this._battleScene.startRound(1);
  }

  hasContinueSave(): boolean {
    return this._session.loadFromDisk() !== null;
  }

  continueGame(): boolean {
    const save = this._session.loadFromDisk();
    if (!save) {
      return false;
    }
    this._session.applySaveState(save);
    this._heroSystem.loadHeroById(save.heroId);
    this._scene = save.phase === 'battle' ? 'battle' : 'shop';

    if (this._scene === 'battle') {
      this._battleScene.startRound(save.round);
    } else {
      this._shopScene.enterShop(save.round);
    }
    return true;
  }

  getScene(): GameSceneType {
    return this._scene;
  }

  tick(dt: number): void {
    if (this._scene === 'battle') {
      this._battleScene.update(dt);
    }
  }

  enterShop(victory = false): void {
    const round = this._state.round;

    if (round >= MAX_ROUND && victory) {
      this._scene = 'gameover';
      this._eventBus.emit('game_complete', {});
      return;
    }

    const s = this._state.getState();
    const healAmount = Math.floor(s.maxHP * 0.6);
    this._state.setState({
      hp: Math.min(s.maxHP, s.hp + healAmount),
    });

    this._scene = 'shop';
    this._shopScene.enterShop(round);
  }

  startBattle(): void {
    const nextRound = this._state.round + 1;
    if (nextRound > MAX_ROUND) {
      return;
    }

    this._state.setState({ round: nextRound });
    this._shopScene.onEnterBattle();
    this._session.saveToDisk('battle');
    this._scene = 'battle';
    preloadLaterAssetsIfNeeded(nextRound);
    this._battleScene.startRound(nextRound);
  }

  getBattle(): BattleSceneController {
    return this._battleScene;
  }

  getShop(): ShopScene {
    return this._shopScene;
  }

  getState(): IStateManager {
    return this._state;
  }

  getEconomy(): EconomySystem {
    return this._economy;
  }

  getInventory(): InventorySystem {
    return this._inventory;
  }
}
