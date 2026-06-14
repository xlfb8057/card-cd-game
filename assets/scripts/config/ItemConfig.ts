/**
 * 装备配置表类型定义
 */

/** 装备稀有度 */
export type ItemRarity = 'bronze' | 'silver' | 'gold' | 'legendary';

/** 效果目标类型 */
export type EffectTarget =
  | 'enemy'
  | 'self'
  | 'adjacent'
  | 'all_tools'
  | 'all_food';

/** 效果触发时机 */
export type EffectTrigger = 'onTrigger' | 'passive';

/** 装备效果类型 */
export type EffectType =
  | 'damage'
  | 'dot'
  | 'shield'
  | 'heal'
  | 'haste'
  | 'crit'
  | 'freeze';

/** 单条效果配置 */
export interface IItemEffect {
  type: EffectType;
  value: number;
  target: EffectTarget;
  trigger?: EffectTrigger;
  /** DOT 子类型：poison / burn */
  dotType?: 'poison' | 'burn';
}

/** 单件装备配置 */
export interface IItemConfig {
  id: string;
  name: string;
  rarity: ItemRarity;
  baseCD: number;
  price: number;
  tags: string[];
  effects: IItemEffect[];
  heroAffinity?: string;
  maxStar: number;
}

/** 装备配置表查询接口 */
export interface IItemConfigTable {
  get(id: string): IItemConfig | undefined;
  getAll(): IItemConfig[];
  getAllByTag(tag: string): IItemConfig[];
}

/**
 * 装备配置表（只读）
 */
export class ItemConfigTable implements IItemConfigTable {
  private readonly _map: Map<string, IItemConfig>;
  private readonly _tagIndex: Map<string, IItemConfig[]> = new Map();

  constructor(items: IItemConfig[]) {
    this._map = new Map(items.map((item) => [item.id, item]));

    for (const item of items) {
      for (const tag of item.tags) {
        const list = this._tagIndex.get(tag) ?? [];
        list.push(item);
        this._tagIndex.set(tag, list);
      }
    }
  }

  get(id: string): IItemConfig | undefined {
    return this._map.get(id);
  }

  getAll(): IItemConfig[] {
    return Array.from(this._map.values());
  }

  getAllByTag(tag: string): IItemConfig[] {
    return [...(this._tagIndex.get(tag) ?? [])];
  }
}
