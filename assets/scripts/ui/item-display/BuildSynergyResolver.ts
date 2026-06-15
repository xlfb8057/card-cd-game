/**
 * Build 联动装备判定 — 详情高亮槽位 0-5
 */

import { IItemConfig, IItemEffect } from '../../config/ItemConfig';
import { IItemInstance } from '../../models/ItemInstance';
import { getAdjacentPositions } from '../../utils/MathUtil';
import { ItemDisplayContext } from './ItemDisplayTypes';

export class BuildSynergyResolver {
  /** 返回需要 SynergyPulse 高亮的槽位 index 列表 */
  getLinkedSlots(ctx: ItemDisplayContext, clickedConfigId: string): number[] {
    const runtime = ctx.runtime;
    const equipped = runtime.equippedItems ?? [];
    if (equipped.length === 0) {
      return [];
    }

    const clickedConfig = runtime.configTable.getItem(clickedConfigId);
    if (!clickedConfig) {
      return [];
    }

    const slots = new Set<number>();
    const heroId = runtime.currentHeroId;
    const hero = heroId
      ? runtime.configTable.getHero(heroId)
      : undefined;

    for (const effect of clickedConfig.effects) {
      this._applyEffectRules(
        effect,
        clickedConfig,
        ctx,
        equipped,
        slots,
      );
    }

    if (hero && this._heroTagAffinity(hero.passive?.type, clickedConfig.tags)) {
      for (const item of equipped) {
        if (
          this._itemMatchesHeroAffinity(item, hero.passive?.type, runtime)
        ) {
          slots.add(item.position);
        }
      }
    }

    return [...slots].sort((a, b) => a - b);
  }

  /** 联动装备名称（详情底部文字） */
  getLinkedItemNames(ctx: ItemDisplayContext, clickedConfigId: string): string[] {
    const slots = this.getLinkedSlots(ctx, clickedConfigId);
    const runtime = ctx.runtime;
    const equipped = runtime.equippedItems ?? [];
    const names: string[] = [];

    for (const slot of slots) {
      const item = equipped.find((i) => i.position === slot);
      if (!item) {
        continue;
      }
      const cfg = runtime.configTable.getItem(item.configId);
      names.push(cfg?.name ?? item.configId);
    }
    return names;
  }

  private _applyEffectRules(
    effect: IItemEffect,
    clickedConfig: IItemConfig,
    ctx: ItemDisplayContext,
    equipped: IItemInstance[],
    slots: Set<number>,
  ): void {
    const runtime = ctx.runtime;
    const target = effect.target ?? '';

    if (target.includes('all_food') || this._isFoodProc(effect)) {
      this._addByTag(equipped, 'food', slots, runtime);
    }
    if (
      target.includes('all_tools') ||
      effect.type === 'cd_break' ||
      effect.type === 'force_cd'
    ) {
      this._addByTag(equipped, 'tool', slots, runtime);
    }
    if (target.includes('all_dot')) {
      this._addByTag(equipped, 'dot', slots, runtime);
    }
    if (target.includes('all_damage')) {
      this._addByTag(equipped, 'damage', slots, runtime);
    }
    if (target.includes('all_shield')) {
      this._addByTag(equipped, 'shield', slots, runtime);
    }
    if (target.includes('all_heal')) {
      this._addByTag(equipped, 'heal', slots, runtime);
    }

    if (target.includes('adjacent') && ctx.kind !== 'shop_for_sale') {
      const pos = ctx.slotIndex ?? ctx.instance?.position;
      if (pos !== undefined && pos >= 0) {
        const adjacent = getAdjacentPositions(pos);
        const tag = this._adjacentTagFromTarget(target);
        for (const adjPos of adjacent) {
          const item = equipped.find((i) => i.position === adjPos);
          if (item && this._itemHasTag(item, tag, runtime)) {
            slots.add(adjPos);
          }
        }
      }
    }

    if (effect.type === 'scaling' && effect.scalingSource === 'item_count') {
      for (const item of equipped) {
        slots.add(item.position);
      }
    }

    if (effect.type === 'scaling' && effect.scalingSource === 'dot_stacks') {
      for (const item of equipped) {
        const cfg = runtime.configTable.getItem(item.configId);
        if (cfg?.tags.some((t) => t === 'poison' || t === 'dot')) {
          slots.add(item.position);
        }
      }
    }

    if (effect.type === 'buff_multiplier' && target.includes('food')) {
      this._addByTag(equipped, 'food', slots, runtime);
    }
  }

  private _isFoodProc(effect: IItemEffect): boolean {
    return effect.type === 'proc_chance';
  }

  private _addByTag(
    equipped: IItemInstance[],
    tag: string,
    slots: Set<number>,
    runtime: ItemDisplayContext['runtime'],
  ): void {
    for (const item of equipped) {
      if (this._itemHasTag(item, tag, runtime)) {
        slots.add(item.position);
      }
    }
  }

  private _itemHasTag(
    item: IItemInstance,
    tag: string,
    runtime: ItemDisplayContext['runtime'],
  ): boolean {
    const cfg = runtime.configTable.getItem(item.configId);
    return cfg?.tags.includes(tag) ?? false;
  }

  private _adjacentTagFromTarget(target: string): string {
    if (target.includes('food')) return 'food';
    if (target.includes('tool')) return 'tool';
    if (target.includes('dot')) return 'dot';
    if (target.includes('damage')) return 'damage';
    if (target.includes('shield')) return 'shield';
    if (target.includes('heal')) return 'heal';
    return '';
  }

  private _heroTagAffinity(passiveType: string | undefined, tags: string[]): boolean {
    if (passiveType === 'food_boost') return tags.includes('food');
    if (passiveType === 'dot_boost') return tags.includes('dot') || tags.includes('poison');
    if (passiveType === 'tool_cd') return tags.includes('tool');
    return false;
  }

  private _itemMatchesHeroAffinity(
    item: IItemInstance,
    passiveType: string | undefined,
    runtime: ItemDisplayContext['runtime'],
  ): boolean {
    const cfg = runtime.configTable.getItem(item.configId);
    if (!cfg) return false;
    return this._heroTagAffinity(passiveType, cfg.tags);
  }
}

export const buildSynergyResolver = new BuildSynergyResolver();
