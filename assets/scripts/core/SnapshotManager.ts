/**
 * 回合快照管理器
 * 差量存储，最多保留 3 个回合快照
 */

import {
  IGameSnapshot,
  cloneSnapshot,
} from '../models/GameSnapshot';

/** 快照输入数据 */
export interface ISnapshotInput {
  round: number;
  hp: number;
  maxHP: number;
  gold: number;
  heroId: string;
  fragments: number;
  winStreak: number;
  loseStreak: number;
  equipped: IGameSnapshot['equipped'];
  backpack: IGameSnapshot['backpack'];
}

/** SnapshotManager 对外接口 */
export interface ISnapshotManager {
  takeSnapshot(state: ISnapshotInput): void;
  restoreSnapshot(round: number): IGameSnapshot | null;
  getLatestSnapshot(): IGameSnapshot | null;
  getAllSnapshots(): IGameSnapshot[];
  clear(): void;
}

const MAX_SNAPSHOTS = 3;

/**
 * 快照管理器
 * items 使用 structuredClone 深拷贝
 */
export class SnapshotManager implements ISnapshotManager {
  private readonly _snapshots: IGameSnapshot[] = [];

  takeSnapshot(state: ISnapshotInput): void {
    const snapshot: IGameSnapshot = cloneSnapshot({
      round: state.round,
      timestamp: Date.now(),
      hp: state.hp,
      maxHP: state.maxHP,
      gold: state.gold,
      heroId: state.heroId,
      fragments: state.fragments,
      winStreak: state.winStreak,
      loseStreak: state.loseStreak,
      equipped: state.equipped,
      backpack: state.backpack,
    });

    const existingIdx = this._snapshots.findIndex(
      (s) => s.round === state.round,
    );
    if (existingIdx >= 0) {
      this._snapshots[existingIdx] = snapshot;
    } else {
      this._snapshots.push(snapshot);
      this._snapshots.sort((a, b) => a.round - b.round);
    }

    while (this._snapshots.length > MAX_SNAPSHOTS) {
      this._snapshots.shift();
    }
  }

  restoreSnapshot(round: number): IGameSnapshot | null {
    const found = this._snapshots.find((s) => s.round === round);
    return found ? cloneSnapshot(found) : null;
  }

  getLatestSnapshot(): IGameSnapshot | null {
    if (this._snapshots.length === 0) {
      return null;
    }
    return cloneSnapshot(this._snapshots[this._snapshots.length - 1]);
  }

  getAllSnapshots(): IGameSnapshot[] {
    return this._snapshots.map(cloneSnapshot);
  }

  clear(): void {
    this._snapshots.length = 0;
  }
}
