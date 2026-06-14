/**
 * 单例基类
 * 子类实现 static getInstance()，内部调用 resolveInstance
 */

export abstract class Singleton {
  private static readonly _instances = new Map<string, Singleton>();

  /**
   * 获取或创建单例（子类 getInstance 中调用）
   * @param key 唯一标识，通常用类名
   * @param factory 实例工厂
   */
  protected static resolveInstance<T extends Singleton>(
    key: string,
    factory: () => T,
  ): T {
    const existing = Singleton._instances.get(key);
    if (existing) {
      return existing as T;
    }
    const instance = factory();
    Singleton._instances.set(key, instance);
    return instance;
  }

  /** 重置单例（仅用于测试） */
  protected static clearInstance(key: string): void {
    Singleton._instances.delete(key);
  }
}
