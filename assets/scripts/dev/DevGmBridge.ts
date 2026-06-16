/**
 * 开发用 GM 命令（浏览器预览 / 编辑器；微信正式包不注册）
 *
 * 文档：Docs/GM指令说明.md（新增 GM 时必须同步更新）
 */

import { director } from 'cc';
import { DEV, PREVIEW } from 'cc/env';
import { getGameApp } from '../core/GameAppHolder';
import { SCENE_SHOP, SCENE_BATTLE } from '../config/SceneNames';
import { MAX_ROUND } from '../config/RoundConfig';
import { isWxMiniGame } from '../platform/WxRuntime';

export interface IDevGmCommands {
  /** 直接通关并打开通关页（shop 场景） */
  complete(): void;
  /** 跳到第 5 关商店（未通关，可继续买装备） */
  round5Shop(): void;
  /** 进入战斗场景（当前回合） */
  battle(): void;
  /** 加 999 金币 */
  gold(): void;
  help(): void;
}

/** 预览 / 编辑器 / 非微信环境下启用 GM */
export function isDevGmEnabled(): boolean {
  return (DEV || PREVIEW) && !isWxMiniGame();
}

export function devGmSkipToComplete(): void {
  const app = getGameApp();
  if (!app) {
    console.warn('[GM] GameApp 未就绪，请等场景加载完成');
    return;
  }

  app.debugSkipToGameComplete();

  const sceneName = director.getScene()?.name ?? '';
  if (sceneName !== SCENE_SHOP) {
    director.loadScene(SCENE_SHOP);
  }
}

export function devGmJumpToRound5Shop(): void {
  const app = getGameApp();
  if (!app) {
    console.warn('[GM] GameApp 未就绪');
    return;
  }
  app.debugJumpToRound(MAX_ROUND);
  app.enterShop(false);

  const sceneName = director.getScene()?.name ?? '';
  if (sceneName !== SCENE_SHOP) {
    director.loadScene(SCENE_SHOP);
  }
}

export function devGmGoBattle(): void {
  const app = getGameApp();
  if (!app) {
    console.warn('[GM] GameApp 未就绪');
    return;
  }
  if (app.isGameComplete()) {
    console.warn('[GM] 已通关，请用 gm.complete() 或重新开始');
    return;
  }

  const sceneName = director.getScene()?.name ?? '';
  if (sceneName === SCENE_BATTLE) {
    return;
  }

  if (app.getScene() === 'shop') {
    app.getShop().onEnterBattle();
    app.startBattle();
  }
  director.loadScene(SCENE_BATTLE);
}

export function devGmAddGold(amount = 999): void {
  const app = getGameApp();
  if (!app) {
    console.warn('[GM] GameApp 未就绪');
    return;
  }
  app.getEconomy().addGold(amount);
  console.log(`[GM] +${amount} 金币，当前 ${app.getEconomy().currentGold}`);
}

const COMMANDS: IDevGmCommands = {
  complete: () => devGmSkipToComplete(),
  round5Shop: () => devGmJumpToRound5Shop(),
  battle: () => devGmGoBattle(),
  gold: () => devGmAddGold(),
  help: () => {
    console.info(
      '[GM] 可用命令:\n' +
        '  gm.complete()     — 直接通关并打开通关页\n' +
        '  gm.round5Shop()   — 跳到第5关商店（未通关）\n' +
        '  gm.battle()       — 进入战斗场景\n' +
        '  gm.gold()         — +999 金币\n' +
        '  gm.help()         — 显示本帮助\n' +
        '快捷键: F9 直接通关',
    );
  },
};

export function registerDevGmCommands(): void {
  if (!isDevGmEnabled()) {
    return;
  }
  const g = globalThis as unknown as { gm?: IDevGmCommands };
  g.gm = COMMANDS;
}
