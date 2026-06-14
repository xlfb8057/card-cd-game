/**
 * 游戏运行时状态管理
 * 单例，存储 HP、金币、回合数等核心数据
 */

/** 运行时游戏状态接口 */
export interface IGameState {
  round: number;
  hp: number;
  maxHP: number;
  gold: number;
  heroId: string;
}

/** StateManager 对外接口 */
export interface IStateManager {
  getState(): Readonly<IGameState>;
  setState(partial: Partial<IGameState>): void;
  reset(initial?: Partial<IGameState>): void;
  get round(): number;
  get hp(): number;
  get maxHP(): number;
  get gold(): number;
  get heroId(): string;
}

/** 默认初始状态 */
const DEFAULT_STATE: IGameState = {
  round: 1,
  hp: 100,
  maxHP: 100,
  gold: 0,
  heroId: '',
};

/**
 * 游戏状态管理器（单例）
 * 所有系统通过此管理器读写运行时状态
 */
export class StateManager implements IStateManager {
  private static _instance: StateManager | null = null;

  private _state: IGameState;

  private constructor() {
    this._state = { ...DEFAULT_STATE };
  }

  /** 获取单例 */
  static getInstance(): StateManager {
    if (!StateManager._instance) {
      StateManager._instance = new StateManager();
    }
    return StateManager._instance;
  }

  /** 重置单例（测试用） */
  static resetForTest(): void {
    StateManager._instance = null;
  }

  /** 获取完整状态快照（只读） */
  getState(): Readonly<IGameState> {
    return { ...this._state };
  }

  /** 部分更新状态 */
  setState(partial: Partial<IGameState>): void {
    this._state = { ...this._state, ...partial };
  }

  /** 重置为初始状态 */
  reset(initial?: Partial<IGameState>): void {
    this._state = { ...DEFAULT_STATE, ...initial };
  }

  get round(): number {
    return this._state.round;
  }

  get hp(): number {
    return this._state.hp;
  }

  get maxHP(): number {
    return this._state.maxHP;
  }

  get gold(): number {
    return this._state.gold;
  }

  get heroId(): string {
    return this._state.heroId;
  }
}
