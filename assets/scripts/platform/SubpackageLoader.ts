/**
 * 微信分包 Asset Bundle 懒加载
 * 主包启动后，按需加载 later-assets 分包（音效/特效/后期图标）
 */

import { assetManager, AssetManager } from 'cc';
import { isWxMiniGame } from './WxRuntime';

export const SUBPACKAGE_LATER_ASSETS = 'later-assets';

let _laterBundle: AssetManager.Bundle | null = null;

/** 是否已加载后期资源分包 */
export function isLaterAssetsLoaded(): boolean {
  return _laterBundle !== null;
}

/**
 * 加载 later-assets 分包（第 4 回合及以后可调用）
 * 浏览器预览时若 Bundle 不存在则静默跳过
 */
export function loadLaterAssets(): Promise<AssetManager.Bundle | null> {
  if (_laterBundle) {
    return Promise.resolve(_laterBundle);
  }

  return new Promise((resolve) => {
    assetManager.loadBundle(SUBPACKAGE_LATER_ASSETS, (err, bundle) => {
      if (err || !bundle) {
        if (!isWxMiniGame()) {
          console.log('[Subpackage] later-assets skip (not in wx build)');
        } else {
          console.warn('[Subpackage] later-assets load failed:', err);
        }
        resolve(null);
        return;
      }
      _laterBundle = bundle;
      console.log('[Subpackage] later-assets loaded');
      resolve(bundle);
    });
  });
}

/** 第 4 回合进入战斗前预加载后期分包 */
export function preloadLaterAssetsIfNeeded(round: number): void {
  if (round >= 4) {
    void loadLaterAssets();
  }
}
