/**
 * 全局事件总线
 * 发布/订阅模式，用于模块间解耦通信
 */

/** 事件回调函数类型 */
export type EventCallback<T = unknown> = (payload: T) => void;

/** EventBus 对外接口 */
export interface IEventBus {
  on<T>(event: string, callback: EventCallback<T>): void;
  off<T>(event: string, callback: EventCallback<T>): void;
  emit<T>(event: string, payload?: T): void;
  once<T>(event: string, callback: EventCallback<T>): void;
  clear(event?: string): void;
}

/** 内部监听器包装，支持 once 自动移除 */
interface ListenerEntry {
  callback: EventCallback;
  once: boolean;
}

/**
 * 全局事件总线实现
 * 支持类型安全的事件订阅与发布
 */
export class EventBus implements IEventBus {
  private readonly _listeners: Map<string, ListenerEntry[]> = new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param callback 回调函数
   */
  on<T>(event: string, callback: EventCallback<T>): void {
    this.addListener(event, callback as EventCallback, false);
  }

  /**
   * 订阅一次性事件，触发后自动取消订阅
   * @param event 事件名称
   * @param callback 回调函数
   */
  once<T>(event: string, callback: EventCallback<T>): void {
    this.addListener(event, callback as EventCallback, true);
  }

  /**
   * 取消订阅
   * @param event 事件名称
   * @param callback 要移除的回调（不传则移除该事件全部监听）
   */
  off<T>(event: string, callback?: EventCallback<T>): void {
    if (!callback) {
      this._listeners.delete(event);
      return;
    }

    const entries = this._listeners.get(event);
    if (!entries) {
      return;
    }

    const filtered = entries.filter((e) => e.callback !== callback);
    if (filtered.length === 0) {
      this._listeners.delete(event);
    } else {
      this._listeners.set(event, filtered);
    }
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param payload 事件数据
   */
  emit<T>(event: string, payload?: T): void {
    const entries = this._listeners.get(event);
    if (!entries || entries.length === 0) {
      return;
    }

    const toRemove: EventCallback[] = [];

    for (const entry of entries) {
      try {
        entry.callback(payload);
      } catch (err) {
        console.error(`[EventBus] listener failed for "${event}"`, err);
      }
      if (entry.once) {
        toRemove.push(entry.callback);
      }
    }

    for (const cb of toRemove) {
      this.off(event, cb);
    }
  }

  /**
   * 清除监听器
   * @param event 指定事件名，不传则清除全部
   */
  clear(event?: string): void {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  private addListener(
    event: string,
    callback: EventCallback,
    once: boolean,
  ): void {
    const entries = this._listeners.get(event) ?? [];
    entries.push({ callback, once });
    this._listeners.set(event, entries);
  }
}
