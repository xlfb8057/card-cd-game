/**
 * Node CLI 环境下 mock Cocos `cc` 模块，使 GameApp 等可离线初始化。
 * 必须在任何 import GameApp 之前加载（run-all.ts 首行 import）。
 */
import Module from 'node:module';

const mockCc = {
  assetManager: {
    loadBundle: (
      _name: string,
      cb: (err: Error | null, bundle: unknown) => void,
    ) => {
      cb(null, null);
    },
  },
  director: {
    getScene: () => null,
    loadScene: () => {},
  },
};

const originalRequire = Module.prototype.require;

Module.prototype.require = function (
  this: NodeModule,
  id: string,
): unknown {
  if (id === 'cc') {
    return mockCc;
  }
  if (id === 'cc/env') {
    return { DEV: true, PREVIEW: true, BUILD: false };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (originalRequire as any).apply(this, arguments);
};
