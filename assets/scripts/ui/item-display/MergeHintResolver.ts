/**
 * 升星判定 — 商店/背包/详情
 */

import {
  ItemDisplayContext,
  IMergeHint,
  ItemDisplayRuntime,
} from './ItemDisplayTypes';
import { IItemInstance } from '../../models/ItemInstance';

export class MergeHintResolver {
  getMergeHint(
    ctx: ItemDisplayContext,
    shopConfigId?: string,
  ): IMergeHint {
    const configId = shopConfigId ?? ctx.configId;
    const runtime = ctx.runtime;
    const inventory = runtime.inventory;

    if (!inventory) {
      return noneHint();
    }

    const target = inventory.findMergeTarget(configId);
    if (!target) {
      return noneHint();
    }

    const config = runtime.configTable.getItem(configId);
    const maxStar = config?.maxStar ?? 3;

    if (target.star >= maxStar) {
      return noneHint();
    }

    const equipped = runtime.equippedItems ?? inventory.getAllEquipped();
    const equippedSlotIndex = findEquippedSlotIndex(equipped, target);

    return {
      canMerge: true,
      mergeTarget: equippedSlotIndex >= 0 ? 'equipped' : 'backpack',
      equippedSlotIndex: equippedSlotIndex >= 0 ? equippedSlotIndex : undefined,
      currentStar: target.star,
      nextStar: target.star + 1,
    };
  }
}

function findEquippedSlotIndex(
  equipped: IItemInstance[],
  target: IItemInstance,
): number {
  for (const item of equipped) {
    if (item.instanceId === target.instanceId) {
      return item.position;
    }
  }
  return -1;
}

function noneHint(): IMergeHint {
  return {
    canMerge: false,
    mergeTarget: 'none',
    currentStar: 1,
    nextStar: 2,
  };
}

export const mergeHintResolver = new MergeHintResolver();
