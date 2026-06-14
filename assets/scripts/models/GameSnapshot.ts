/**
 * 游戏快照与存档数据结构
 */

/** 快照中的装备简要信息 */
export interface ISnapshotItem {
  configId: string;
  instanceId: string;
  position: number;
  currentCD: number;
  star: number;
  mods: string[];
  purchasePrice: number;
}

/** 回合快照（差量存储） */
export interface IGameSnapshot {
  round: number;
  timestamp: number;
  hp: number;
  maxHP: number;
  gold: number;
  heroId: string;
  fragments: number;
  winStreak: number;
  loseStreak: number;
  equipped: ISnapshotItem[];
  backpack: ISnapshotItem[];
}

/** 完整可存档游戏状态 */
export interface ISaveGameState {
  round: number;
  hp: number;
  maxHP: number;
  gold: number;
  heroId: string;
  fragments: number;
  winStreak: number;
  loseStreak: number;
  equipped: ISnapshotItem[];
  backpack: ISnapshotItem[];
  phase: 'shop' | 'battle';
}

/** 存档文件结构 */
export interface ISaveFile {
  version: string;
  timestamp: number;
  state: ISaveGameState;
}

export const SAVE_VERSION = '1.0';

/** 创建空快照 */
export function createEmptySnapshot(round: number): IGameSnapshot {
  return {
    round,
    timestamp: Date.now(),
    hp: 0,
    maxHP: 0,
    gold: 0,
    heroId: '',
    fragments: 0,
    winStreak: 0,
    loseStreak: 0,
    equipped: [],
    backpack: [],
  };
}

/** 深拷贝快照 */
export function cloneSnapshot(snapshot: IGameSnapshot): IGameSnapshot {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot)) as IGameSnapshot;
}
