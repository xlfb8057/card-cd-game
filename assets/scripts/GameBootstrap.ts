import { _decorator, Component, JsonAsset, Label, resources } from 'cc';
import { GameApp } from './core/GameApp';
import { getGameApp, setGameApp } from './core/GameAppHolder';
import { IConfigLoader } from './core/ConfigTable';

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
  @property(Label)
  debugLabel: Label | null = null;

  private _app: GameApp | null = null;

  /** 供 BattleSceneView 等 UI 脚本读取游戏逻辑 */
  getApp(): GameApp | null {
    return this._app;
  }

  async onLoad() {
    const existing = getGameApp();
    if (existing) {
      this._app = existing;
      setGameApp(existing);
      return;
    }

    this._app = new GameApp(new CocosResourcesConfigLoader(), true);
    await this._app.initialize();
    this._app.selectHero('stelle');
    this._app.startNewGame();
    setGameApp(this._app);

    if (this.debugLabel) {
      this.debugLabel.string = '游戏已启动…';
    }
  }

  update(dt: number) {
    if (!this._app || this._app.getScene() !== 'battle') {
      return;
    }

    this._app.tick(dt);

    if (!this.debugLabel) {
      return;
    }

    const hud = this._app.getBattle().getHUD();
    this.debugLabel.string =
      `第${hud.round}回合  ` +
      `HP ${hud.playerHP}/${hud.playerMaxHP}  ` +
      `敌人 ${hud.enemyName} ${hud.enemyHP}/${hud.enemyMaxHP}  ` +
      `金币 ${hud.gold}`;
  }
}
