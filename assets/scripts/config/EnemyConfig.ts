/**
 * 敌人配置表类型定义
 */

/** 敌人奖励配置 */
export interface IEnemyReward {
  gold: number;
  items: string[];
}

/** 单个敌人配置 */
export interface IEnemyConfig {
  id: string;
  name: string;
  hp: number;
  attackCD: number;
  damage: number;
  timeLimit?: number;
  reward: IEnemyReward;
}

/** 敌人配置表查询接口 */
export interface IEnemyConfigTable {
  get(id: string): IEnemyConfig | undefined;
  getAll(): IEnemyConfig[];
}

/**
 * 敌人配置表（只读）
 */
export class EnemyConfigTable implements IEnemyConfigTable {
  private readonly _map: Map<string, IEnemyConfig>;

  constructor(enemies: IEnemyConfig[]) {
    this._map = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  }

  get(id: string): IEnemyConfig | undefined {
    return this._map.get(id);
  }

  getAll(): IEnemyConfig[] {
    return Array.from(this._map.values());
  }
}
