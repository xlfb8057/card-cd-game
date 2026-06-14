/**
 * 微信小游戏运行时检测与 wx 对象访问
 */

export interface IWxMenuButtonRect {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface IWxSystemInfo {
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  safeArea?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
}

export interface IWxLoginResult {
  code: string;
}

/** 微信 API 最小子集（V1.0 预留） */
export interface IWxAPI {
  login(options: {
    success?: (res: IWxLoginResult) => void;
    fail?: (err: unknown) => void;
  }): void;
  getMenuButtonBoundingClientRect(): IWxMenuButtonRect;
  getSystemInfoSync(): IWxSystemInfo;
  shareAppMessage?(options: { title?: string; imageUrl?: string }): void;
  createRewardedVideoAd?(options: { adUnitId: string }): unknown;
  setStorageSync(key: string, data: string): void;
  getStorageSync(key: string): string;
  removeStorageSync(key: string): void;
}

export function getWx(): IWxAPI | null {
  const g = globalThis as unknown as { wx?: IWxAPI };
  return g.wx ?? null;
}

/** 是否运行在微信小游戏环境 */
export function isWxMiniGame(): boolean {
  return getWx() !== null;
}

/** 获取胶囊按钮区域（用于 HUD 安全区） */
export function getMenuButtonRect(): IWxMenuButtonRect | null {
  const wx = getWx();
  if (!wx) {
    return null;
  }
  try {
    return wx.getMenuButtonBoundingClientRect();
  } catch {
    return null;
  }
}

/** 获取系统信息 */
export function getWxSystemInfo(): IWxSystemInfo | null {
  const wx = getWx();
  if (!wx) {
    return null;
  }
  try {
    return wx.getSystemInfoSync();
  } catch {
    return null;
  }
}
