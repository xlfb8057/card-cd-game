import { _decorator, Component, JsonAsset, Label, resources } from 'cc';
import { GameApp } from './core/GameApp';
import { getGameApp, setGameApp } from './core/GameAppHolder';
import { IConfigLoader } from './core/ConfigTable';
import { initWeChatSession } from './platform/WeChatBridge';
import { isWxMiniGame } from './platform/WxRuntime';
import { DevGmPanel } from './dev/DevGmPanel';
import { isDevGmEnabled } from './dev/DevGmBridge';

const { ccclass, property } = _decorator;

/** 用 Cocos resources 目录加载 config/*.json */
class CocosResourcesConfigLoader implements IConfigLoader {
  async loadJson<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err || !asset) {
          reject(err ?? new Error(`Config not found: ${path}`));
          return;
        }
        resolve(asset.json as T);
      });
    });
  }
}

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  /** 加载提示（场景里 Canvas/DebugLabel；未绑定时自动查找） */
  @property(Label)
  debugLabel: Label | null = null;

  private _loadingLabel: Label | null = null;

  /** 供 BattleSceneView 等 UI 脚本读取游戏逻辑 */
  getApp(): GameApp | null {
    return this._app;
  }

  async onLoad() {
    this._resolveLoadingLabel();

    if (isWxMiniGame()) {
      await initWeChatSession();
    }

    const existing = getGameApp();
    if (existing) {
      this._app = existing;
      setGameApp(existing);
      this._hideLoading();
      this._ensureDevGmPanel();
      return;
    }

    this._showLoading('加载中...');
    try {
      this._app = new GameApp(new CocosResourcesConfigLoader(), false);
      await this._app.initialize();
      this._app.selectHero('stelle');
      this._app.startNewGame();
      setGameApp(this._app);
    } finally {
      this._hideLoading();
    }
    this._ensureDevGmPanel();
  }

  /** 从存档继续（供菜单/按钮调用） */
  async continueFromSave(): Promise<boolean> {
    this._resolveLoadingLabel();
    this._showLoading('读取存档…');

    try {
      if (!this._app) {
        this._app = new GameApp(new CocosResourcesConfigLoader(), false);
        await this._app.initialize();
        setGameApp(this._app);
      }
      const ok = this._app.continueGame();
      return ok;
    } finally {
      this._hideLoading();
    }
  }

  private _resolveLoadingLabel(): void {
    if (this.debugLabel?.node?.isValid) {
      this._loadingLabel = this.debugLabel;
      return;
    }
    const node =
      this.node.getChildByName('DebugLabel') ??
      this.node.getChildByName('LoadingLabel');
    this._loadingLabel = node?.getComponent(Label) ?? null;
    this.debugLabel = this._loadingLabel;
  }

  private _showLoading(text: string): void {
    const label = this._loadingLabel;
    if (!label?.node?.isValid) {
      return;
    }
    label.node.active = true;
    label.string = text;
  }

  private _hideLoading(): void {
    const label = this._loadingLabel;
    if (!label?.node?.isValid) {
      return;
    }
    label.string = '';
    label.node.active = false;
  }

  private _ensureDevGmPanel(): void {
    if (!isDevGmEnabled()) {
      return;
    }
    if (this.node.getComponent(DevGmPanel)) {
      return;
    }
    this.node.addComponent(DevGmPanel);
  }

  update(dt: number) {
    if (!this._app || this._app.getScene() !== 'battle') {
      return;
    }

    this._app.tick(dt);
  }
}
