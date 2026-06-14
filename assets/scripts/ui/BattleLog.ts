/**
 * 战斗日志 UI 视图模型
 */

import { LOG_COLORS } from '../utils/RarityUtil';

export interface IBattleLogEntry {
  round: number;
  text: string;
  color: string;
}

export interface IBattleLogController {
  addEntry(round: number, text: string, color: string): void;
  getEntries(): IBattleLogEntry[];
  clear(): void;
}

const MAX_LOG_LINES = 50;

export class BattleLogController implements IBattleLogController {
  private readonly _entries: IBattleLogEntry[] = [];

  addEntry(round: number, text: string, color: string): void {
    this._entries.push({ round, text, color });
    while (this._entries.length > MAX_LOG_LINES) {
      this._entries.shift();
    }
  }

  getEntries(): IBattleLogEntry[] {
    return [...this._entries];
  }

  clear(): void {
    this._entries.length = 0;
  }

  static formatEntry(entry: IBattleLogEntry): string {
    return `[回合${entry.round}] ${entry.text}`;
  }
}

export const BattleLogColors = LOG_COLORS;
