/**
 * 角色配置表类型定义
 */

/** 被动技能配置 */
export interface IHeroPassive {
  type: string;
  value: number;
  overflowToShield?: number;
}

/** 主动技能配置 */
export interface IHeroActiveSkill {
  name: string;
  effect: string;
  duration: number;
  usesPerBattle: number;
}

/** 单个角色配置 */
export interface IHeroConfig {
  id: string;
  name: string;
  maxHP: number;
  passive: IHeroPassive;
  activeSkill: IHeroActiveSkill;
}

/** 角色配置表查询接口 */
export interface IHeroConfigTable {
  get(id: string): IHeroConfig | undefined;
  getAll(): IHeroConfig[];
}

/**
 * 角色配置表（只读）
 */
export class HeroConfigTable implements IHeroConfigTable {
  private readonly _map: Map<string, IHeroConfig>;

  constructor(heroes: IHeroConfig[]) {
    this._map = new Map(heroes.map((hero) => [hero.id, hero]));
  }

  get(id: string): IHeroConfig | undefined {
    return this._map.get(id);
  }

  getAll(): IHeroConfig[] {
    return Array.from(this._map.values());
  }
}
