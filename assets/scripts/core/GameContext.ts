/**
 * 游戏上下文（依赖注入容器）
 * 统一管理 EventBus、StateManager、ConfigTable 等核心服务
 */

import { EventBus, IEventBus } from './EventBus';
import { StateManager, IStateManager } from './StateManager';
import { ConfigTable, IConfigTable, IConfigLoader } from './ConfigTable';

/** 游戏上下文接口 */
export interface IGameContext {
  readonly eventBus: IEventBus;
  readonly stateManager: IStateManager;
  readonly configTable: IConfigTable;
}

/** 创建上下文所需依赖 */
export interface IGameContextDeps {
  configLoader: IConfigLoader;
  eventBus?: IEventBus;
  stateManager?: IStateManager;
}

/**
 * 游戏上下文
 * 禁止全局变量，所有系统通过构造函数注入 IGameContext
 */
export class GameContext implements IGameContext {
  readonly eventBus: IEventBus;
  readonly stateManager: IStateManager;
  readonly configTable: IConfigTable;

  constructor(deps: IGameContextDeps) {
    this.eventBus = deps.eventBus ?? new EventBus();
    this.stateManager = deps.stateManager ?? StateManager.getInstance();
    this.configTable = new ConfigTable(deps.configLoader);
  }

  /** 初始化：加载配置表 */
  async initialize(): Promise<void> {
    await this.configTable.loadAll();
  }
}
