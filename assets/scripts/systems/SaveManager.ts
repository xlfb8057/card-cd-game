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
      return this._migrate(file);
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

  /** 版本迁移预留 */
  private _migrate(file: ISaveFile): ISaveGameState {
    if (file.version === SAVE_VERSION) {
      return file.state;
    }
    return file.state;
  }
}
