/**
 * 微信 API 桥接（V1.0：登录留接口，分享/广告预留）
 */

import { getWx, isWxMiniGame } from './WxRuntime';

export interface IWxLoginPayload {
  code: string;
}

export interface IWeChatBridge {
  isAvailable(): boolean;
  login(): Promise<IWxLoginPayload | null>;
  shareAppMessage(title: string, imageUrl?: string): void;
  createRewardedVideoAd(adUnitId: string): unknown | null;
}

/**
 * 微信桥接实现
 * - login：调用 wx.login，V1.0 仅本地存档，不上传 code
 * - share / ad：预留接口，未配置时不报错
 */
export class WeChatBridge implements IWeChatBridge {
  private static _instance: WeChatBridge | null = null;

  static getInstance(): WeChatBridge {
    if (!WeChatBridge._instance) {
      WeChatBridge._instance = new WeChatBridge();
    }
    return WeChatBridge._instance;
  }

  isAvailable(): boolean {
    return isWxMiniGame();
  }

  login(): Promise<IWxLoginPayload | null> {
    const wx = getWx();
    if (!wx) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      wx.login({
        success: (res) => resolve({ code: res.code }),
        fail: () => resolve(null),
      });
    });
  }

  shareAppMessage(title: string, imageUrl?: string): void {
    const wx = getWx();
    if (!wx?.shareAppMessage) {
      return;
    }
    wx.shareAppMessage({ title, imageUrl });
  }

  createRewardedVideoAd(adUnitId: string): unknown | null {
    const wx = getWx();
    if (!wx?.createRewardedVideoAd) {
      return null;
    }
    try {
      return wx.createRewardedVideoAd({ adUnitId });
    } catch {
      return null;
    }
  }
}

/** 启动时静默登录（仅获取 code，V1.0 不做服务端校验） */
export async function initWeChatSession(): Promise<void> {
  if (!isWxMiniGame()) {
    return;
  }
  const bridge = WeChatBridge.getInstance();
  const result = await bridge.login();
  if (result?.code) {
    console.log('[WeChat] wx.login ok, code ready for future server auth');
  }
}
