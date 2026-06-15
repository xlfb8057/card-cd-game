/**
 * 改装系统（v3: 3 星解锁 1 槽）
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { EffectType, IItemEffect } from '../config/ItemConfig';
import { IModConfig, ModTier } from '../config/ModConfig';
import { IItemInstance } from '../models/ItemInstance';

export type ModAttributeBonuses = Partial<Record<EffectType, number>>;

export interface IModSystem {
  equipMod(item: IItemInstance, modId: string, round: number): boolean;
  generateModChoices(item: IItemInstance, tier: ModTier): IModConfig[];
  modToEffect(mod: IModConfig): IItemEffect;
  getModAttributeBonuses(item: IItemInstance): ModAttributeBonuses;
  getModMechanismEffects(item: IItemInstance): IItemEffect[];
  /** @deprecated 使用 getModMechanismEffects + getModAttributeBonuses */
  getModEffectsForItem(item: IItemInstance): IItemEffect[];
}

const ATTRIBUTE_EFFECT_TYPES: EffectType[] = [
  'damage',
  'shield',
  'heal',
  'haste',
];

/** 属性改装：value 为百分比加成（0.10 = +10%） */
function isAttributeMod(mod: IModConfig): boolean {
  return (
    mod.tier === 'attribute' &&
    ATTRIBUTE_EFFECT_TYPES.includes(mod.effectType) &&
    mod.value > 0 &&
    mod.value < 1
  );
}

export class ModSystem implements IModSystem {
  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _configTable: IConfigTable,
    private readonly _rng: () => number = Math.random,
  ) {}

  equipMod(item: IItemInstance, modId: string, round: number): boolean {
    if (item.star < 3) {
      return false;
    }

    const mod = this._configTable.getMod(modId);
    if (!mod) {
      return false;
    }

    const unlockRound = this._getTierUnlockRound(mod.tier);
    if (round < unlockRound) {
      return false;
    }

    if (!this._canEquipMod(item, mod)) {
      return false;
    }

    if (item.mods.length >= 1) {
      if (mod.tier === 'archetype') {
        item.mods = [modId];
      } else {
        return false;
      }
    } else {
      item.mods.push(modId);
    }

    this._eventBus.emit('mod_equipped', { itemInstance: item, modId });
    return true;
  }

  generateModChoices(item: IItemInstance, tier: ModTier): IModConfig[] {
    const tierMods = this._configTable.getAllMods().filter((m) => m.tier === tier);
    const valid = tierMods.filter((m) => this._canEquipMod(item, m));
    return this._randomPick(valid, 3);
  }

  modToEffect(mod: IModConfig): IItemEffect {
    const effect: IItemEffect = {
      type: mod.effectType,
      value: mod.value,
      target: mod.target,
      starScale: 0,
    };

    if (mod.id === 'mod_burn' || mod.effectType === 'dot') {
      effect.dotType = 'burn';
      effect.duration = 3;
    }

    if (mod.id === 'mod_frost') {
      effect.duration = mod.value;
    }

    return effect;
  }

  getModAttributeBonuses(item: IItemInstance): ModAttributeBonuses {
    const bonuses: ModAttributeBonuses = {};
    if (item.star < 3) {
      return bonuses;
    }

    for (const modId of item.mods) {
      const mod = this._configTable.getMod(modId);
      if (!mod || !isAttributeMod(mod)) {
        continue;
      }
      bonuses[mod.effectType] = (bonuses[mod.effectType] ?? 0) + mod.value;
    }

    return bonuses;
  }

  getModMechanismEffects(item: IItemInstance): IItemEffect[] {
    if (item.star < 3) {
      return [];
    }

    const effects: IItemEffect[] = [];
    for (const modId of item.mods) {
      const mod = this._configTable.getMod(modId);
      if (!mod || isAttributeMod(mod)) {
        continue;
      }
      if (mod.effectType === 'shield' && mod.value === 0) {
        continue;
      }
      effects.push(this.modToEffect(mod));
    }
    return effects;
  }

  getModEffectsForItem(item: IItemInstance): IItemEffect[] {
    return this.getModMechanismEffects(item);
  }

  private _canEquipMod(item: IItemInstance, mod: IModConfig): boolean {
    if (item.star < 3) {
      return false;
    }
    if (mod.tags.includes('all')) {
      return true;
    }
    const cfg = this._configTable.getItem(item.configId);
    if (!cfg) {
      return false;
    }
    return cfg.tags.some((tag) => mod.tags.includes(tag));
  }

  private _getTierUnlockRound(tier: ModTier): number {
    switch (tier) {
      case 'attribute':
        return 2;
      case 'mechanism':
        return 5;
      case 'archetype':
        return 8;
      default:
        return 99;
    }
  }

  private _randomPick(items: IModConfig[], count: number): IModConfig[] {
    const shuffled = [...items].sort(() => this._rng() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}
