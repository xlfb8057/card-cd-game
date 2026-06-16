/**
 * 装备展示模块 — 类型定义（v4）
 */

import { IItemConfig } from '../../config/ItemConfig';
import { IItemInstance } from '../../models/ItemInstance';
import { IConfigTable } from '../../core/ConfigTable';
import { IHeroSystem } from '../../systems/HeroSystem';
import { IModSystem } from '../../systems/ModSystem';
import { IInventorySystem } from '../../systems/InventorySystem';

/** 展示上下文（6+1 种） */
export type ItemDisplayContextKind =
  | 'battle_equipped'
  | 'shop_for_sale'
  | 'shop_equipped'
  | 'backpack'
  | 'mod_badge'
  | 'mod_select'
  | 'codex';

/** 运行时依赖（逻辑层注入，前端不硬编码公式） */
export interface ItemDisplayRuntime {
  configTable: IConfigTable;
  heroSystem?: IHeroSystem | null;
  modSystem?: IModSystem | null;
  inventory?: IInventorySystem | null;
  /** 当前 6 格已装备（战斗/商店） */
  equippedItems?: IItemInstance[];
  /** 敌人中毒层数（战斗 scaling 用） */
  enemyPoisonStacks?: number;
  currentHeroId?: string;
}

export interface ItemDisplayContext {
  kind: ItemDisplayContextKind;
  configId: string;
  instance?: IItemInstance | null;
  /** 槽位 0-5 */
  slotIndex?: number;
  /** 商店商品是否已售出 */
  sold?: boolean;
  shopIndex?: number;
  /** 图鉴预览星级（codex） */
  codexStar?: number;
  /** 战斗已结束进入结算：隐藏 CD 进度与倒计时 */
  battleSettled?: boolean;
  runtime: ItemDisplayRuntime;
}

/** 卡片 ViewModel */
export interface IItemCardViewModel {
  configId: string;
  name: string;
  iconPath: string;
  rarity: string;
  rarityFrameKey: string;
  rarityColor: string;
  star: number;
  maxStar: number;
  tags: string[];
  tagIcons: { tagId: string; label: string; iconPath: string }[];
  hasMod: boolean;
  modNames: string[];
  /** 仅 battle_equipped */
  showCdOverlay: boolean;
  cdProgress: number;
  cdText: string;
  /** 显示剩余 CD 数字（战斗进行中且仍在冷却） */
  showCdTime: boolean;
  cdAtMax: boolean;
  /** 仅 shop_for_sale 且可升星 */
  showMergeHint: boolean;
  mergeHintText: string;
  /** 可点击 */
  clickable: boolean;
  /** 联动/升星边框闪烁 */
  synergyPulse: boolean;
  mergeStarPulse: boolean;
  isEmpty: boolean;
  slotLocked: boolean;
}

/** 效果行 ViewModel */
export interface IItemEffectLineViewModel {
  typeLabel: string;
  description: string;
  targetLabel: string;
  triggerLabel: string;
  /** 升星箭头：当前值 → 下一星值 */
  showStarArrow: boolean;
  currentValueText: string;
  nextValueText: string;
  /** 实际生效 ≠ 基础时高亮 */
  valueHighlighted: boolean;
  baseValueHint: string;
}

/** 改装效果行 */
export interface IItemModEffectLineViewModel {
  modName: string;
  description: string;
}

/** Build 联动预览文字 */
export interface IBuildSynergyPreviewViewModel {
  linkedItemNames: string[];
  isPreview: boolean;
  previewPrefix: string;
}

/** 详情 ViewModel */
export interface IItemDetailViewModel {
  configId: string;
  name: string;
  description: string;
  iconPath: string;
  rarity: string;
  rarityLabel: string;
  rarityFrameKey: string;
  star: number;
  maxStar: number;
  modNames: string[];
  baseCdText: string;
  priceText: string;
  sellPriceText: string;
  showPrice: boolean;
  showSellPrice: boolean;
  affinityLabel: string;
  tags: { tagId: string; label: string; iconPath: string }[];
  effects: IItemEffectLineViewModel[];
  modEffects: IItemModEffectLineViewModel[];
  mergeHintText: string;
  showMergeHint: boolean;
  buildPreview: IBuildSynergyPreviewViewModel;
  sold: boolean;
}

/** 空槽 ViewModel */
export interface IEmptySlotViewModel {
  slotIndex: number;
  locked: boolean;
  clickable: boolean;
  emptyFrameKey: string;
  lockedFrameKey: string;
}

export interface IMergeHint {
  canMerge: boolean;
  mergeTarget: 'equipped' | 'backpack' | 'none';
  equippedSlotIndex?: number;
  currentStar: number;
  nextStar: number;
}

/** Popover 定位结果 */
export type PopoverPlacement = 'right' | 'left' | 'bottom' | 'top';

export interface IPopoverLayout {
  placement: PopoverPlacement;
  x: number;
  y: number;
  maxHeight: number;
}

/** 展示用数值对（基础 vs 实际） */
export interface IValuePair {
  base: number;
  effective: number;
  formattedBase: string;
  formattedEffective: string;
  highlighted: boolean;
}

/** 内部：描述拼装上下文 */
export interface IEffectDescribeInput {
  config: IItemConfig;
  instance: IItemInstance | null;
  effectIndex: number;
  star: number;
  nextStar: number | null;
  runtime: ItemDisplayRuntime;
  equippedCount: number;
  enemyPoisonStacks: number;
}
