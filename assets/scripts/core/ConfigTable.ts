/**
 * 配置表加载系统
 * 从 resources/config/ 加载 JSON，支持按 id 和 tag 查询
 */

import { ItemConfigTable, IItemConfig } from '../config/ItemConfig';
import { HeroConfigTable, IHeroConfig } from '../config/HeroConfig';
import { EnemyConfigTable, IEnemyConfig } from '../config/EnemyConfig';

/** 配置加载器接口，便于依赖注入与测试替换 */
export interface IConfigLoader {
  loadJson<T>(path: string): Promise<T>;
}

/** Cocos 资源加载器（运行时在 Cocos 环境中使用） */
export class CocosConfigLoader implements IConfigLoader {
  async loadJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load config: ${path}`);
    }
    return response.json() as Promise<T>;
  }
}

/** 内存配置加载器（测试/Node 环境使用） */
export class MemoryConfigLoader implements IConfigLoader {
  constructor(private readonly _data: Map<string, unknown>) {}

  async loadJson<T>(path: string): Promise<T> {
    const data = this._data.get(path);
    if (data === undefined) {
      throw new Error(`Config not found in memory: ${path}`);
    }
    return data as T;
  }
}

/** ConfigTable 对外接口 */
export interface IConfigTable {
  loadAll(): Promise<void>;
  reload(): Promise<void>;
  getItem(id: string): IItemConfig | undefined;
  getHero(id: string): IHeroConfig | undefined;
  getEnemy(id: string): IEnemyConfig | undefined;
  getAllItems(): IItemConfig[];
  getAllItemsByTag(tag: string): IItemConfig[];
  getAllHeroes(): IHeroConfig[];
  getAllEnemies(): IEnemyConfig[];
}

/** JSON 根结构 */
interface ItemsJsonRoot {
  items: IItemConfig[];
}

interface HeroesJsonRoot {
  heroes: IHeroConfig[];
}

interface EnemiesJsonRoot {
  enemies: IEnemyConfig[];
}

/** 配置表路径常量 */
const CONFIG_PATHS = {
  items: 'config/items',
  heroes: 'config/heroes',
  enemies: 'config/enemies',
} as const;

/**
 * 配置表管理器
 * 启动时加载 JSON，提供只读查询
 */
export class ConfigTable implements IConfigTable {
  private _items: ItemConfigTable = new ItemConfigTable([]);
  private _heroes: HeroConfigTable = new HeroConfigTable([]);
  private _enemies: EnemyConfigTable = new EnemyConfigTable([]);
  private _loaded = false;

  constructor(private readonly _loader: IConfigLoader) {}

  /** 是否已加载 */
  get isLoaded(): boolean {
    return this._loaded;
  }

  /** 加载全部配置表 */
  async loadAll(): Promise<void> {
    const [itemsData, heroesData, enemiesData] = await Promise.all([
      this._loader.loadJson<ItemsJsonRoot>(CONFIG_PATHS.items),
      this._loader.loadJson<HeroesJsonRoot>(CONFIG_PATHS.heroes),
      this._loader.loadJson<EnemiesJsonRoot>(CONFIG_PATHS.enemies),
    ]);

    this._items = new ItemConfigTable(itemsData.items);
    this._heroes = new HeroConfigTable(heroesData.heroes);
    this._enemies = new EnemyConfigTable(enemiesData.enemies);
    this._loaded = true;
  }

  /** 热重载配置（开发调试用） */
  async reload(): Promise<void> {
    this._loaded = false;
    await this.loadAll();
  }

  getItem(id: string): IItemConfig | undefined {
    return this._items.get(id);
  }

  getHero(id: string): IHeroConfig | undefined {
    return this._heroes.get(id);
  }

  getEnemy(id: string): IEnemyConfig | undefined {
    return this._enemies.get(id);
  }

  getAllItems(): IItemConfig[] {
    return this._items.getAll();
  }

  getAllItemsByTag(tag: string): IItemConfig[] {
    return this._items.getAllByTag(tag);
  }

  getAllHeroes(): IHeroConfig[] {
    return this._heroes.getAll();
  }

  getAllEnemies(): IEnemyConfig[] {
    return this._enemies.getAll();
  }
}
