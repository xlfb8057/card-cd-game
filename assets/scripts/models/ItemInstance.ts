/**
 * 装备实例数据模型
 * 运行时 mutable 状态，对应 6 格装备栏中的一项
 */

import { GAME_CONSTANTS } from '../config/GameConstants';
import { ISnapshotItem } from './GameSnapshot';

/** 装备实例接口 */
export interface IItemInstance {
  configId: string;
  instanceId: string;
  /** 装备栏位置 0-5（等同 v3 slotIndex） */
  position: number;
  currentCD: number;
  star: number;
  hasteCount: number;
  mods: string[];
  purchasePrice: number;
  triggeredThisFrame: boolean;
  /** 被冻结剩余时间（秒），冻结期间 CD 不减少 */
  freezeRemaining: number;
  resetCD(baseCD: number): void;
  applyHaste(amount: number, minCD?: number): void;
  canTrigger(): boolean;
  clearFrameFlag(): void;
  markTriggered(): void;
  tickFreeze(dt: number): void;
}

let _nextInstanceId = 1;

export function generateInstanceId(): string {
  return `item_${_nextInstanceId++}`;
}

export function resetInstanceIdCounter(): void {
  _nextInstanceId = 1;
}

export function syncInstanceIdCounterFromSave(items: { instanceId: string }[]): void {
  for (const item of items) {
    const match = /^item_(\d+)$/.exec(item.instanceId);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      if (num > _nextInstanceId) {
        _nextInstanceId = num;
      }
    }
  }
}

export function itemToSnapshot(item: IItemInstance): ISnapshotItem {
  return {
    configId: item.configId,
    instanceId: item.instanceId,
    position: item.position,
    currentCD: item.currentCD,
    star: item.star,
    mods: [...item.mods],
    purchasePrice: item.purchasePrice,
  };
}

export interface ICreateItemParams {
  configId: string;
  position: number;
  baseCD: number;
  star?: number;
  mods?: string[];
  purchasePrice?: number;
  instanceId?: string;
}

export class ItemInstance implements IItemInstance {
  readonly configId: string;
  readonly instanceId: string;
  position: number;
  currentCD: number;
  star: number;
  hasteCount: number;
  mods: string[];
  purchasePrice: number;
  triggeredThisFrame: boolean;
  freezeRemaining: number;

  constructor(params: ICreateItemParams) {
    this.configId = params.configId;
    this.instanceId = params.instanceId ?? generateInstanceId();
    this.position = params.position;
    this.currentCD = params.baseCD;
    this.star = params.star ?? 1;
    this.hasteCount = 0;
    this.mods = params.mods ?? [];
    this.purchasePrice = params.purchasePrice ?? 0;
    this.triggeredThisFrame = false;
    this.freezeRemaining = 0;
  }

  resetCD(baseCD: number): void {
    this.currentCD = baseCD;
    this.triggeredThisFrame = false;
  }

  applyHaste(amount: number, minCD: number = GAME_CONSTANTS.CD_MIN): void {
    if (this.currentCD <= minCD) {
      return;
    }
    this.currentCD = Math.max(minCD, this.currentCD - amount);
    this.hasteCount++;
  }

  canTrigger(): boolean {
    if (this.freezeRemaining > 0) {
      return false;
    }
    return this.currentCD <= 0;
  }

  clearFrameFlag(): void {
    this.triggeredThisFrame = false;
  }

  markTriggered(): void {
    this.triggeredThisFrame = true;
  }

  tickFreeze(dt: number): void {
    if (this.freezeRemaining > 0) {
      this.freezeRemaining = Math.max(0, this.freezeRemaining - dt);
    }
  }
}
