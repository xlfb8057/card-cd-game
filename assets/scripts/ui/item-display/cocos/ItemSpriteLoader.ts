/**
 * 从 resources 动态加载 SpriteFrame（装备 UI）
 */

import { ImageAsset, SpriteFrame, Texture2D, resources } from 'cc';

const cache = new Map<string, SpriteFrame>();

/** resources 下路径，不含扩展名，如 textures/item-display/frames/frame_common */
export function loadSpriteFrame(
  resourcePath: string,
): Promise<SpriteFrame | null> {
  const cached = cache.get(resourcePath);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    resources.load(`${resourcePath}/spriteFrame`, SpriteFrame, (err, sf) => {
      if (!err && sf) {
        cache.set(resourcePath, sf);
        resolve(sf);
        return;
      }

      resources.load(resourcePath, ImageAsset, (err2, image) => {
        if (err2 || !image) {
          resolve(null);
          return;
        }
        const tex = new Texture2D();
        tex.image = image;
        const frame = new SpriteFrame();
        frame.texture = tex;
        cache.set(resourcePath, frame);
        resolve(frame);
      });
    });
  });
}

export function applySpriteFrame(
  target: { spriteFrame: SpriteFrame | null } | null,
  sf: SpriteFrame | null,
): void {
  if (target && sf) {
    target.spriteFrame = sf;
  }
}

export function preloadItemDisplayFrames(paths: string[]): void {
  for (const p of paths) {
    loadSpriteFrame(p).catch(() => undefined);
  }
}
