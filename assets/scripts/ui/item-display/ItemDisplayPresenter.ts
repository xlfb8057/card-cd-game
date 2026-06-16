/**
 * 装备展示统一入口 — config + instance → 卡片/详情 VM
 */

import { IItemConfig } from '../../config/ItemConfig';
import { IItemInstance } from '../../models/ItemInstance';
import {
  ItemDisplayContext,
  IItemCardViewModel,
  IItemDetailViewModel,
  IEmptySlotViewModel,
  IItemModEffectLineViewModel,
} from './ItemDisplayTypes';
import { itemEffectDescriber } from './ItemEffectDescriber';
import { mergeHintResolver } from './MergeHintResolver';
import { buildSynergyResolver } from './BuildSynergyResolver';
import { getTagsDisplay } from './ItemTagRegistry';
import {
  getRarityLabel,
  getRarityFrameKey,
  getRarityDisplayColor,
  getEmptySlotFrameKey,
  getLockedSlotFrameKey,
  getIconPlaceholderKey,
  computeSellPrice,
  formatDisplayNumber,
} from './RarityDisplayUtil';
import {
  resolveDisplayStar,
  computeDisplayBaseCd,
  computeCdProgress,
  isCdAtFloor,
  CD_READY_EPSILON,
} from './ItemValueCalculator';
import { IMergeHint } from './ItemDisplayTypes';

const NO_MERGE_HINT: IMergeHint = {
  canMerge: false,
  mergeTarget: 'none',
  currentStar: 1,
  nextStar: 2,
};

export class ItemDisplayPresenter {
  buildCard(ctx: ItemDisplayContext): IItemCardViewModel {
    const config = ctx.runtime.configTable.getItem(ctx.configId);
    if (!config) {
      return emptyCard(ctx.configId);
    }

    const instance = ctx.instance ?? null;
    const star = resolveDisplayStar(instance, ctx.kind, ctx.codexStar);
    const mergeHint =
      ctx.kind === 'shop_for_sale' || ctx.kind === 'backpack'
        ? mergeHintResolver.getMergeHint(ctx)
        : NO_MERGE_HINT;
    const modNames = this._resolveModNames(instance, ctx);
    const tagIcons = getTagsDisplay(config.tags);

    const showCd =
      ctx.kind === 'battle_equipped' &&
      instance !== null &&
      ctx.battleSettled !== true;
    const baseCd = computeDisplayBaseCd(config, ctx.runtime, instance);
    const cdProgress =
      showCd && instance ? computeCdProgress(instance, baseCd) : 0;
    const cdAtMax = showCd && instance ? isCdAtFloor(instance) : false;
    const cdRemaining =
      showCd && instance ? Math.max(0, instance.currentCD) : 0;

    const sold = ctx.sold === true;
    const clickable = !sold;

    const showMergeHint =
      ctx.kind === 'shop_for_sale' && !sold && mergeHint.canMerge;

    /** 下一星闪烁仅商店待购卡；战斗/详情高亮由 ItemDisplayController 单独控制 */
    const mergeStarPulse =
      ctx.kind === 'shop_for_sale' &&
      mergeHint.canMerge &&
      mergeHint.mergeTarget === 'equipped';

    return {
      configId: config.id,
      name: config.name,
      iconPath: config.iconPath
        ? `textures/${config.iconPath}`
        : getIconPlaceholderKey(),
      rarity: config.rarity,
      rarityFrameKey: getRarityFrameKey(config.rarity),
      rarityColor: getRarityDisplayColor(config.rarity),
      star,
      maxStar: config.maxStar ?? 3,
      tags: config.tags,
      tagIcons,
      hasMod: (instance?.mods.length ?? 0) > 0,
      modNames,
      showCdOverlay: showCd,
      cdProgress,
      cdText: showCd && instance ? formatDisplayNumber(cdRemaining) : '',
      showCdTime:
        showCd && instance !== null && cdRemaining > CD_READY_EPSILON,
      cdAtMax,
      showMergeHint,
      mergeHintText: showMergeHint ? '可升星' : '',
      clickable,
      synergyPulse: false,
      mergeStarPulse,
      isEmpty: false,
      slotLocked: false,
    };
  }

  buildDetail(ctx: ItemDisplayContext): IItemDetailViewModel {
    const config = ctx.runtime.configTable.getItem(ctx.configId);
    if (!config) {
      return emptyDetail(ctx.configId);
    }

    const instance = ctx.instance ?? null;
    const star = resolveDisplayStar(instance, ctx.kind, ctx.codexStar);
    const maxStar = config.maxStar ?? 3;
    const mergeHint =
      ctx.kind === 'shop_for_sale' || ctx.kind === 'backpack'
        ? mergeHintResolver.getMergeHint(ctx)
        : NO_MERGE_HINT;
    const showShopMerge =
      ctx.kind === 'shop_for_sale' &&
      ctx.sold !== true &&
      mergeHint.canMerge;
    const nextStar =
      showShopMerge &&
      star < maxStar &&
      this._hasStarScaling(config)
        ? mergeHint.nextStar
        : null;

    const equipped =
      ctx.runtime.equippedItems ??
      ctx.runtime.inventory?.getAllEquipped() ??
      [];
    const equippedCount = equipped.length;
    const enemyStacks = ctx.runtime.enemyPoisonStacks ?? 0;

    const effects = itemEffectDescriber.describeAllEffects({
      config,
      instance,
      star,
      nextStar,
      runtime: ctx.runtime,
      equippedCount,
      enemyPoisonStacks: enemyStacks,
      showStarPreview: showShopMerge,
    });

    const modEffects = this._buildModEffects(instance, ctx);
    const linkedNames = buildSynergyResolver.getLinkedItemNames(
      ctx,
      config.id,
    );
    const isPreview =
      ctx.kind === 'shop_for_sale' || ctx.kind === 'backpack';

    const baseCd = computeDisplayBaseCd(config, ctx.runtime, instance);
    const sellPrice = computeSellPrice(config.price, config.sellPrice);

    return {
      configId: config.id,
      name: config.name,
      description: config.description ?? '',
      iconPath: config.iconPath
        ? `textures/${config.iconPath}`
        : getIconPlaceholderKey(),
      rarity: config.rarity,
      rarityLabel: getRarityLabel(config.rarity),
      rarityFrameKey: getRarityFrameKey(config.rarity),
      rarityColor: getRarityDisplayColor(config.rarity),
      star,
      maxStar,
      modNames: this._resolveModNames(instance, ctx),
      baseCdText: `${formatDisplayNumber(baseCd)}s`,
      priceText: this._formatPrice(config.price, ctx.sold),
      sellPriceText: `${sellPrice} 金`,
      showPrice: ctx.kind === 'shop_for_sale',
      showSellPrice:
        ctx.kind === 'shop_for_sale' ||
        ctx.kind === 'shop_equipped' ||
        ctx.kind === 'backpack',
      affinityLabel: this._buildAffinityLabel(
        config,
        ctx.runtime.currentHeroId,
        ctx,
      ),
      tags: getTagsDisplay(config.tags),
      effects,
      modEffects,
      mergeHintText: showShopMerge
        ? `可升星至 ${mergeHint.nextStar} 星`
        : '',
      showMergeHint: showShopMerge,
      buildPreview: {
        linkedItemNames: linkedNames,
        isPreview,
        previewPrefix: isPreview ? '背包中的' : '',
      },
      sold: ctx.sold === true,
    };
  }

  buildEmptySlot(slotIndex: number, locked = false): IEmptySlotViewModel {
    return {
      slotIndex,
      locked,
      clickable: !locked,
      emptyFrameKey: getEmptySlotFrameKey(),
      lockedFrameKey: getLockedSlotFrameKey(),
    };
  }

  buildEmptyCard(slotIndex: number, locked = false): IItemCardViewModel {
    return {
      ...emptyCard(''),
      isEmpty: true,
      clickable: !locked,
      slotLocked: locked,
    };
  }

  private _resolveModNames(
    instance: IItemInstance | null,
    ctx: ItemDisplayContext,
  ): string[] {
    if (!instance) {
      return [];
    }
    return instance.mods.map((id) => {
      const mod = ctx.runtime.configTable.getMod(id);
      return mod?.name ?? id;
    });
  }

  private _buildModEffects(
    instance: IItemInstance | null,
    ctx: ItemDisplayContext,
  ): IItemModEffectLineViewModel[] {
    if (!instance) {
      return [];
    }
    const lines: IItemModEffectLineViewModel[] = [];
    for (const modId of instance.mods) {
      const mod = ctx.runtime.configTable.getMod(modId);
      if (mod) {
        lines.push({ modName: mod.name, description: mod.description });
      }
    }
    return lines;
  }

  private _hasStarScaling(config: IItemConfig): boolean {
    return config.effects.some((e) => e.starScale > 0);
  }

  private _formatPrice(price: number, sold?: boolean): string {
    if (sold) {
      return '售罄';
    }
    if (price === 0) {
      return '免费';
    }
    return `${price} 金`;
  }

  private _buildAffinityLabel(
    config: IItemConfig,
    heroId: string | undefined,
    ctx: ItemDisplayContext,
  ): string {
    if (!config.heroAffinity) {
      return '';
    }
    if (heroId && config.heroAffinity === heroId) {
      return '亲和';
    }
    const hero = ctx.runtime.configTable.getHero(config.heroAffinity);
    return `专属：${hero?.name ?? config.heroAffinity}`;
  }
}

function emptyCard(configId: string): IItemCardViewModel {
  return {
    configId,
    name: configId,
    iconPath: getIconPlaceholderKey(),
    rarity: 'common',
    rarityFrameKey: getRarityFrameKey('common'),
    rarityColor: getRarityDisplayColor('common'),
    star: 0,
    maxStar: 3,
    tags: [],
    tagIcons: [],
    hasMod: false,
    modNames: [],
    showCdOverlay: false,
    cdProgress: 0,
    cdText: '',
    showCdTime: false,
    cdAtMax: false,
    showMergeHint: false,
    mergeHintText: '',
    clickable: false,
    synergyPulse: false,
    mergeStarPulse: false,
    isEmpty: true,
    slotLocked: false,
  };
}

function emptyDetail(configId: string): IItemDetailViewModel {
  return {
    configId,
    name: configId,
    description: '',
    iconPath: getIconPlaceholderKey(),
    rarity: 'common',
    rarityLabel: '',
    rarityFrameKey: getRarityFrameKey('common'),
    rarityColor: getRarityDisplayColor('common'),
    star: 1,
    maxStar: 3,
    modNames: [],
    baseCdText: '',
    priceText: '',
    sellPriceText: '',
    showPrice: false,
    showSellPrice: false,
    affinityLabel: '',
    tags: [],
    effects: [],
    modEffects: [],
    mergeHintText: '',
    showMergeHint: false,
    buildPreview: {
      linkedItemNames: [],
      isPreview: false,
      previewPrefix: '',
    },
    sold: false,
  };
}

export const itemDisplayPresenter = new ItemDisplayPresenter();
