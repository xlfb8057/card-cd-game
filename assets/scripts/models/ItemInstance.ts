/**
 * 装备实例数据模型
 * 运行时 mutable 状态，对应 6 格装备栏中的一项
 */

import { CD_MIN } from '../utils/MathUtil';
import { ISnapshotItem } from './GameSnapshot';

/** 装备实例接口 */
export interface IItemInstance {
  configId: string;
  instanceId: string;
  position: number;
  currentCD: number;
  star: number;
  hasteCount: number;
  mods: string[];
  purchasePrice: number;
  triggeredThisFrame: boolean;
  resetCD(baseCD: number): void;
  applyHaste(amount: number): void;
  canTrigger(): boolean;
  clearFrameFlag(): void;
  markTriggered(): void;
}

let _nextInstanceId = 1;

/** 生成唯一实例 ID */
export function generateInstanceId(): string {
  return `item_${_nextInstanceId++}`;
}

/** 重置实例 ID 计数器（测试用） */
export function resetInstanceIdCounter(): void {
  _nextInstanceId = 1;
}

/** 从存档恢复时同步实例 ID 计数器 */
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

/** 序列化为快照条目 */
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

/** 创建装备实例所需参数 */
export interface ICreateItemParams {
  configId: string;
  position: number;
  baseCD: number;
  star?: number;
  mods?: string[];
  purchasePrice?: number;
  instanceId?: string;
}

/**
 * 装备实例
 * position 范围 0-5，对应该格在装备栏中的索引
 */
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
  }

  /** 触发后重置 CD 到完整值 */
  resetCD(baseCD: number): void {
    this.currentCD = baseCD;
    this.triggeredThisFrame = false;
  }

  /**
   * 应用加速（减少当前 CD）
   * 硬下限 0.3 秒：已在下限或以下时不再减少
   */
  applyHaste(amount: number): void {
    if (this.currentCD <= CD_MIN) {
      return;
    }
    this.currentCD = Math.max(CD_MIN, this.currentCD - amount);
    this.hasteCount++;
  }

  /** CD 是否已归零，可以触发 */
  canTrigger(): boolean {
    return this.currentCD <= 0;
  }

  /** 清除本帧触发标记（每帧开始时调用） */
  clearFrameFlag(): void {
    this.triggeredThisFrame = false;
  }

  /** 标记本帧已触发 */
  markTriggered(): void {
    this.triggeredThisFrame = true;
  }
}
