/**
 * 装备功能 CLI 测试共享工具（无 Cocos / 无 cc 依赖）
 */

import * as fs from 'fs';
import * as path from 'path';
import { MemoryConfigLoader, ConfigTable } from '../../assets/scripts/core/ConfigTable';
import { EventBus } from '../../assets/scripts/core/EventBus';
import { EconomySystem } from '../../assets/scripts/systems/EconomySystem';
import { InventorySystem } from '../../assets/scripts/systems/InventorySystem';
import { HeroSystem } from '../../assets/scripts/systems/HeroSystem';
import { ModSystem } from '../../assets/scripts/systems/ModSystem';
import {
  buildItemDisplayRuntime,
  IItemDisplayDeps,
} from '../../assets/scripts/ui/item-display/ItemDisplayContextFactory';

export const ROOT = path.resolve(__dirname, '..', '..');
export const CONFIG_DIR = path.join(ROOT, 'assets', 'resources', 'config');

export function loadJsonFile(name: string): unknown {
  const filePath = path.join(CONFIG_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`缺少配置文件: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function createConfigLoader(): MemoryConfigLoader {
  return new MemoryConfigLoader(
    new Map([
      ['config/items', loadJsonFile('items.json')],
      ['config/heroes', loadJsonFile('heroes.json')],
      ['config/enemies', loadJsonFile('enemies.json')],
      ['config/mods', loadJsonFile('mods.json')],
    ]),
  );
}

export async function loadConfigTable(): Promise<ConfigTable> {
  const table = new ConfigTable(createConfigLoader());
  await table.loadAll();
  return table;
}

export interface TestContext {
  configTable: ConfigTable;
  configLoader: MemoryConfigLoader;
  eventBus: EventBus;
  economy: EconomySystem;
  inventory: InventorySystem;
  heroSystem: HeroSystem;
  modSystem: ModSystem;
  deps: IItemDisplayDeps;
}

export async function createTestContext(
  heroId = 'jules',
): Promise<TestContext> {
  const configLoader = createConfigLoader();
  const configTable = new ConfigTable(configLoader);
  await configTable.loadAll();

  const eventBus = new EventBus();
  const economy = new EconomySystem(eventBus);
  const inventory = new InventorySystem(eventBus, configTable, economy);
  const heroSystem = new HeroSystem(eventBus, configTable);
  const modSystem = new ModSystem(eventBus, configTable);

  heroSystem.loadHeroById(heroId);

  const deps: IItemDisplayDeps = {
    configTable,
    heroSystem,
    modSystem,
    inventory,
    currentHeroId: heroId,
  };

  return {
    configTable,
    configLoader,
    eventBus,
    economy,
    inventory,
    heroSystem,
    modSystem,
    deps,
  };
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  OK  ${message}`);
}

export function buildRuntime(deps: IItemDisplayDeps) {
  return buildItemDisplayRuntime(deps);
}

export interface TestSuite {
  /** CLI 过滤用短 id，如 card-vm */
  id: string;
  name: string;
  run(ctx: TestContext): void | Promise<void>;
}
