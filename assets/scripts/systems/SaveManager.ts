/**
 * 本地存档管理
 * 版本化 JSON 序列化，支持 wx / localStorage
 */

import { IStorageAPI } from '../utils/StorageAPI';
import {
  ISaveGameState,
  ISaveFile,
  SAVE_VERSION,
} from '../models/GameSnapshot';

const SAVE_KEY = 'pixel_brawl_save';

/** SaveManager 对外接口 */
export interface ISaveManager {
  saveGame(state: ISaveGameState): void;
  loadGame(): ISaveGameState | null;
  deleteSave(): void;
  hasSave(): boolean;
}

/**
 * 本地存档管理器
 */
export class SaveManager implements ISaveManager {
  constructor(private readonly _storage: IStorageAPI) {}

  saveGame(state: ISaveGameState): void {
    const file: ISaveFile = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state)) as ISaveGameState,
    };
    this._storage.setItem(SAVE_KEY, JSON.stringify(file));
  }

  loadGame(): ISaveGameState | null {
    const raw = this._storage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const file = JSON.parse(raw) as ISaveFile;
      if (!file.version || !file.state) {
        return null;
      }
      const migrated = this._migrate(file);
      if (!migrated || !this._validateState(migrated)) {
        return null;
      }
      return migrated;
    } catch {
      return null;
    }
  }

  deleteSave(): void {
    this._storage.removeItem(SAVE_KEY);
  }

  hasSave(): boolean {
    return this._storage.getItem(SAVE_KEY) !== null;
  }

  /** 版本迁移预留；未知版本不读取，避免错误结构污染运行时 */
  private _migrate(file: ISaveFile): ISaveGameState | null {
    if (file.version === SAVE_VERSION) {
      return file.state;
    }
    console.warn(`[SaveManager] unsupported save version: ${file.version}`);
    return null;
  }

  private _validateState(state: ISaveGameState): boolean {
    if (!Number.isInteger(state.round) || state.round < 1) {
      return false;
    }
    if (!Number.isFinite(state.maxHP) || state.maxHP < 1) {
      return false;
    }
    if (!Number.isFinite(state.hp) || state.hp < 1 || state.hp > state.maxHP) {
      return false;
    }
    if (!Number.isFinite(state.gold) || state.gold < 0) {
      return false;
    }
    if (!Number.isFinite(state.fragments) || state.fragments < 0) {
      return false;
    }
    if (!Number.isFinite(state.winStreak) || state.winStreak < 0) {
      return false;
    }
    if (!Number.isFinite(state.loseStreak) || state.loseStreak < 0) {
      return false;
    }
    if (state.phase !== 'shop' && state.phase !== 'battle') {
      return false;
    }
    if (!Array.isArray(state.equipped) || !Array.isArray(state.backpack)) {
      return false;
    }
    return state.equipped.every((item) => this._validateItem(item)) &&
      state.backpack.every((item) => this._validateItem(item));
  }

  private _validateItem(item: ISaveGameState['equipped'][number]): boolean {
    return typeof item.configId === 'string' &&
      item.configId.length > 0 &&
      typeof item.instanceId === 'string' &&
      item.instanceId.length > 0 &&
      Number.isInteger(item.position) &&
      item.position >= -1 &&
      item.position < 6 &&
      Number.isFinite(item.currentCD) &&
      item.currentCD >= 0 &&
      Number.isInteger(item.star) &&
      item.star >= 0 &&
      Array.isArray(item.mods) &&
      Number.isFinite(item.purchasePrice) &&
      item.purchasePrice >= 0;
  }
}
