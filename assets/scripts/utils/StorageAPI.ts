/**
 * 本地存储 API
 * 优先 wx.setStorageSync，降级 localStorage
 */

/** 存储 API 接口 */
export interface IStorageAPI {
  setItem(key: string, value: string): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface IWxStorage {
  setStorageSync(key: string, data: string): void;
  getStorageSync(key: string): string;
  removeStorageSync(key: string): void;
}

function getWxStorage(): IWxStorage | null {
  const g = globalThis as unknown as { wx?: IWxStorage };
  return g.wx ?? null;
}

/** 浏览器 localStorage 实现 */
export class LocalStorageAPI implements IStorageAPI {
  setItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }

  removeItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}

/** 微信小游戏存储实现 */
export class WxStorageAPI implements IStorageAPI {
  setItem(key: string, value: string): void {
    try {
      getWxStorage()?.setStorageSync(key, value);
    } catch {
      // wx storage full or unavailable
    }
  }

  getItem(key: string): string | null {
    const wx = getWxStorage();
    if (!wx) {
      return null;
    }
    try {
      const v = wx.getStorageSync(key);
      return v === '' || v === undefined || v === null ? null : String(v);
    } catch {
      return null;
    }
  }

  removeItem(key: string): void {
    getWxStorage()?.removeStorageSync(key);
  }
}

export function createStorageAPI(): IStorageAPI {
  if (getWxStorage()) {
    return new WxStorageAPI();
  }
  return new LocalStorageAPI();
}

/** 内存存储（测试用） */
export class MemoryStorageAPI implements IStorageAPI {
  private readonly _store = new Map<string, string>();

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  clear(): void {
    this._store.clear();
  }
}
