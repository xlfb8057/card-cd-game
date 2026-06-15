/**
 * CD 触顶 MAX 角标脉冲（§14.4，周期 1.0s）
 */

import {
  _decorator,
  Component,
  tween,
  Tween,
  UIOpacity,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CdMaxPulseController')
export class CdMaxPulseController extends Component {
  private _active = false;

  setActive(on: boolean): void {
    if (on) {
      this._startPulse();
    } else {
      this._stopPulse();
    }
  }

  private _startPulse(): void {
    if (this._active) {
      return;
    }
    this._active = true;
    this.node.active = true;

    const opacity =
      this.node.getComponent(UIOpacity) ??
      this.node.addComponent(UIOpacity);
    opacity.opacity = 128;

    tween(opacity)
      .repeatForever(
        tween()
          .to(0.5, { opacity: 255 })
          .to(0.5, { opacity: 128 }),
      )
      .start();
  }

  private _stopPulse(): void {
    this._active = false;
    Tween.stopAllByTarget(this.node);
    const opacity = this.node.getComponent(UIOpacity);
    if (opacity) {
      Tween.stopAllByTarget(opacity);
      opacity.opacity = 255;
    }
  }

  onDestroy(): void {
    this._stopPulse();
  }
}
