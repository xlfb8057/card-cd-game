/**
 * 改装词条配置类型
 */

import { EffectTarget, EffectType } from './ItemConfig';

export type ModTier = 'attribute' | 'mechanism' | 'archetype';

export interface IModConfig {
  id: string;
  name: string;
  tier: ModTier;
  tags: string[];
  effectType: EffectType;
  value: number;
  target: EffectTarget;
  description: string;
}

export interface IModConfigTable {
  get(id: string): IModConfig | undefined;
  getAll(): IModConfig[];
  getByTier(tier: ModTier): IModConfig[];
}

export class ModConfigTable implements IModConfigTable {
  private readonly _map: Map<string, IModConfig>;

  constructor(mods: IModConfig[]) {
    this._map = new Map(mods.map((mod) => [mod.id, mod]));
  }

  get(id: string): IModConfig | undefined {
    return this._map.get(id);
  }

  getAll(): IModConfig[] {
    return Array.from(this._map.values());
  }

  getByTier(tier: ModTier): IModConfig[] {
    return this.getAll().filter((m) => m.tier === tier);
  }
}
