/**
 * 游戏会话协调器
 * 快照/存档与各 System 状态同步
 */

import { IStateManager } from '../core/StateManager';
import { ISnapshotManager, ISnapshotInput } from '../core/SnapshotManager';
import { ISaveManager } from './SaveManager';
import { IEconomySystem } from './EconomySystem';
import { IInventorySystem } from './InventorySystem';
import { ISaveGameState, IGameSnapshot } from '../models/GameSnapshot';

/** GameSession 对外接口 */
export interface IGameSession {
  buildSnapshotInput(): ISnapshotInput;
  takeRoundSnapshot(): void;
  restoreToRound(round: number): boolean;
  saveToDisk(phase: 'shop' | 'battle'): void;
  loadFromDisk(): ISaveGameState | null;
  applySaveState(state: ISaveGameState): void;
  clearAllProgress(): void;
}

/**
 * 跨系统状态同步
 */
export class GameSession implements IGameSession {
  constructor(
    private readonly _state: IStateManager,
    private readonly _economy: IEconomySystem,
    private readonly _inventory: IInventorySystem,
    private readonly _snapshots: ISnapshotManager,
    private readonly _saveManager: ISaveManager,
  ) {}

  buildSnapshotInput(): ISnapshotInput {
    const s = this._state.getState();
    const items = this._inventory.toSnapshot();

    return {
      round: s.round,
      hp: s.hp,
      maxHP: s.maxHP,
      gold: this._economy.currentGold,
      heroId: s.heroId,
      fragments: this._economy.fragments,
      winStreak: this._economy.winStreak,
      loseStreak: this._economy.loseStreak,
      equipped: items.equipped,
      backpack: items.backpack,
    };
  }

  /** 战斗结束、进入商店前自动保存 */
  takeRoundSnapshot(): void {
    this._snapshots.takeSnapshot(this.buildSnapshotInput());
  }

  restoreToRound(round: number): boolean {
    const snap = this._snapshots.restoreSnapshot(round);
    if (!snap) {
      return false;
    }
    this._applySnapshot(snap);
    return true;
  }

  saveToDisk(phase: 'shop' | 'battle'): void {
    const input = this.buildSnapshotInput();
    const save: ISaveGameState = { ...input, phase };
    this._saveManager.saveGame(save);
  }

  loadFromDisk(): ISaveGameState | null {
    return this._saveManager.loadGame();
  }

  applySaveState(state: ISaveGameState): void {
    this._state.setState({
      round: state.round,
      hp: state.hp,
      maxHP: state.maxHP,
      gold: state.gold,
      heroId: state.heroId,
    });
    this._economy.restoreEconomy(
      state.gold,
      state.fragments,
      state.winStreak,
      state.loseStreak,
    );
    this._inventory.restoreFromSnapshot(state.equipped, state.backpack);
  }

  /** 清除磁盘存档与回合快照（重新开始用） */
  clearAllProgress(): void {
    this._saveManager.deleteSave();
    this._snapshots.clear();
  }

  private _applySnapshot(snap: IGameSnapshot): void {
    this._state.setState({
      round: snap.round,
      hp: snap.hp,
      maxHP: snap.maxHP,
      gold: snap.gold,
      heroId: snap.heroId,
    });
    this._economy.restoreEconomy(
      snap.gold,
      snap.fragments,
      snap.winStreak,
      snap.loseStreak,
    );
    this._inventory.restoreFromSnapshot(snap.equipped, snap.backpack);
  }
}
