/**
 * 从 GameApp 构建 ItemDisplayContext / Runtime
 */

import { IConfigTable } from '../../core/ConfigTable';
import { IHeroSystem } from '../../systems/HeroSystem';
import { IModSystem } from '../../systems/ModSystem';
import { IInventorySystem } from '../../systems/InventorySystem';
import { IItemInstance } from '../../models/ItemInstance';
import {
  ItemDisplayContext,
  ItemDisplayContextKind,
  ItemDisplayRuntime,
} from './ItemDisplayTypes';

export interface IItemDisplayDeps {
  configTable: IConfigTable;
  heroSystem?: IHeroSystem | null;
  modSystem?: IModSystem | null;
  inventory?: IInventorySystem | null;
  currentHeroId?: string;
  enemyPoisonStacks?: number;
}

export function buildItemDisplayRuntime(
  deps: IItemDisplayDeps,
): ItemDisplayRuntime {
  const equipped = deps.inventory?.getAllEquipped();
  return {
    configTable: deps.configTable,
    heroSystem: deps.heroSystem,
    modSystem: deps.modSystem,
    inventory: deps.inventory,
    equippedItems: equipped,
    enemyPoisonStacks: deps.enemyPoisonStacks ?? 0,
    currentHeroId: deps.currentHeroId ?? deps.heroSystem?.getHero()?.id,
  };
}

export function buildItemContext(
  kind: ItemDisplayContextKind,
  configId: string,
  deps: IItemDisplayDeps,
  options?: {
    instance?: IItemInstance | null;
    slotIndex?: number;
    sold?: boolean;
    shopIndex?: number;
    codexStar?: number;
  },
): ItemDisplayContext {
  return {
    kind,
    configId,
    instance: options?.instance,
    slotIndex: options?.slotIndex,
    sold: options?.sold,
    shopIndex: options?.shopIndex,
    codexStar: options?.codexStar,
    runtime: buildItemDisplayRuntime(deps),
  };
}
