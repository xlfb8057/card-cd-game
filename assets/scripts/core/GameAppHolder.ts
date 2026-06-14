/**
 * 跨场景保留 GameApp 实例（Battle ↔ Shop 切换时不丢失进度）
 */
import { GameApp } from './core/GameApp';

let _app: GameApp | null = null;

export function setGameApp(app: GameApp): void {
  _app = app;
}

export function getGameApp(): GameApp | null {
  return _app;
}

export function clearGameApp(): void {
  _app = null;
}
