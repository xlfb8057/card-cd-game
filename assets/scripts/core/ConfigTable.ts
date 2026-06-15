/**
 * 配置表加载系统
 * 从 resources/config/ 加载 JSON，支持按 id 和 tag 查询
 */

import { ItemConfigTable, IItemConfig, IItemEffect } from '../config/ItemConfig';
import { HeroConfigTable, IHeroConfig } from '../config/HeroConfig';
import { EnemyConfigTable, IEnemyConfig } from '../config/EnemyConfig';
import { ModConfigTable, IModConfig } from '../config/ModConfig';
import { normalizeRarity } from '../utils/RarityCompat';

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
  getMod(id: string): IModConfig | undefined;
  getAllItems(): IItemConfig[];
  getAllItemsByTag(tag: string): IItemConfig[];
  getAllHeroes(): IHeroConfig[];
  getAllEnemies(): IEnemyConfig[];
  getAllMods(): IModConfig[];
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

interface ModsJsonRoot {
  mods: IModConfig[];
}

/** 配置表路径常量 */
const CONFIG_PATHS = {
  items: 'config/items',
  heroes: 'config/heroes',
  enemies: 'config/enemies',
  mods: 'config/mods',
} as const;

/** v3 装备配置 normalize（兼容旧 JSON 缺字段） */
function normalizeItemConfig(raw: IItemConfig): IItemConfig {
  return {
    ...raw,
    rarity: normalizeRarity(raw.rarity as string),
    shopAvailable: raw.shopAvailable ?? raw.price > 0,
    sellPrice: raw.sellPrice ?? Math.floor(raw.price * 0.7),
    effects: raw.effects.map(normalizeEffect),
  };
}

function normalizeEffect(raw: IItemEffect): IItemEffect {
  const value =
    typeof raw.value === 'number' && !Number.isNaN(raw.value) ? raw.value : 0;
  return {
    ...raw,
    value,
    starScale: raw.starScale ?? 0,
  };
}

/**
 * 配置表管理器
 * 启动时加载 JSON，提供只读查询
 */
export class ConfigTable implements IConfigTable {
  private _items: ItemConfigTable = new ItemConfigTable([]);
  private _heroes: HeroConfigTable = new HeroConfigTable([]);
  private _enemies: EnemyConfigTable = new EnemyConfigTable([]);
  private _mods: ModConfigTable = new ModConfigTable([]);
  private _loaded = false;

  constructor(private readonly _loader: IConfigLoader) {}

  get isLoaded(): boolean {
    return this._loaded;
  }

  async loadAll(): Promise<void> {
    const [itemsData, heroesData, enemiesData, modsData] = await Promise.all([
      this._loader.loadJson<ItemsJsonRoot>(CONFIG_PATHS.items),
      this._loader.loadJson<HeroesJsonRoot>(CONFIG_PATHS.heroes),
      this._loader.loadJson<EnemiesJsonRoot>(CONFIG_PATHS.enemies),
      this._loader.loadJson<ModsJsonRoot>(CONFIG_PATHS.mods).catch(() => ({ mods: [] })),
    ]);

    const normalizedItems = itemsData.items.map(normalizeItemConfig);
    this._items = new ItemConfigTable(normalizedItems);
    this._heroes = new HeroConfigTable(heroesData.heroes);
    this._enemies = new EnemyConfigTable(enemiesData.enemies);
    this._mods = new ModConfigTable(modsData.mods ?? []);
    this._loaded = true;
  }

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

  getMod(id: string): IModConfig | undefined {
    return this._mods.get(id);
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

  getAllMods(): IModConfig[] {
    return this._mods.getAll();
  }
}
