/**
 * 装备配置表类型定义（v3）
 */

/** 装备稀有度（v3: common/rare/epic/legendary） */
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** @deprecated v2.1 品质名，仅用于兼容读取 */
export type LegacyItemRarity = 'bronze' | 'silver' | 'gold' | 'legendary';

/** 效果目标类型（v3 扩展） */
export type EffectTarget =
  | 'enemy'
  | 'all_enemy'
  | 'Random_enemy'
  | 'self'
  | 'adjacent'
  | 'left'
  | 'right'
  | 'all_left'
  | 'all_right'
  | 'all_tools'
  | 'all_food'
  | 'all_dot'
  | 'all_damage'
  | 'all_shield'
  | 'all_heal'
  | 'adjacent_tools'
  | 'adjacent_food'
  | 'adjacent_dot'
  | 'adjacent_damage'
  | 'adjacent_shield'
  | 'adjacent_heal'
  | 'all_self_items'
  | 'random_tool'
  | 'random_item'
  | 'enemy_fastest'
  | 'enemy_random'
  | 'enemy_all';

/** 效果触发时机 */
export type EffectTrigger =
  | 'onTrigger'
  | 'passive'
  | 'onPurchase'
  | 'onHit'
  | 'onBattleEnd'
  | 'onEnemyHit'
  | 'onSelfHit'
  | 'onEnemyHeal'
  | 'onSelfHeal'
  | 'onEnemyShield'
  | 'onSelfShield'
  | 'onEnemyActive'
  | 'onSelfActive'
  | 'onEnemyHPBelow'
  | 'onSelfHPBelow';

/** DOT 子类型 */
export type DotType = 'poison' | 'burn';

/** 缩放来源 */
export type ScalingSource =
  | 'item_count'
  | 'dot_stacks'
  | 'trigger_count'
  | 'damage_taken';

/** 装备效果类型（v3 扩展） */
export type EffectType =
  | 'damage'
  | 'dot'
  | 'self_dot'
  | 'shield'
  | 'heal'
  | 'haste'
  | 'crit'
  | 'freeze'
  | 'scaling'
  | 'proc_chance'
  | 'unlock_cap'
  | 'cd_break'
  | 'buff_multiplier'
  | 'force_cd';

/** 单条效果配置 */
export interface IItemEffect {
  type: EffectType;
  value: number;
  target: EffectTarget;
  trigger?: EffectTrigger;
  dotType?: DotType;
  duration?: number;
  scalingSource?: ScalingSource;
  critMultiplier?: number;
  /** 升星系数（v3 必填，JSON 中每条 effect 独立配置） */
  starScale: number;
  desc?: string;
}

/** 单件装备配置 */
export interface IItemConfig {
  id: string;
  name: string;
  rarity: ItemRarity;
  baseCD: number;
  price: number;
  /** v3: 商店是否可用，与 price 解耦 */
  shopAvailable: boolean;
  tags: string[];
  effects: IItemEffect[];
  heroAffinity?: string;
  maxStar: number;
  iconPath?: string;
  description?: string;
  /** 出售价（floor(price × 0.7)） */
  sellPrice?: number;
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
