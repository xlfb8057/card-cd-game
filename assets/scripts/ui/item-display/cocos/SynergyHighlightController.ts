/**
 * 联动/升星外边框闪烁 — SynergyPulse（§14.2）
 */

import {
  _decorator,
  Color,
  Component,
  Sprite,
  tween,
  Tween,
  UIOpacity,
} from 'cc';

const { ccclass, property } = _decorator;

const SYNERGY_COLOR = '#00BCD4';

@ccclass('SynergyHighlightController')
export class SynergyHighlightController extends Component {
  @property(Sprite)
  pulseSprite: Sprite | null = null;

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

    if (this.pulseSprite) {
      const c = new Color();
      Color.fromHEX(c, SYNERGY_COLOR);
      this.pulseSprite.color = c;
    }

    let opacity =
      this.pulseSprite?.node.getComponent(UIOpacity) ??
      this.pulseSprite?.node.addComponent(UIOpacity);
    if (!opacity && this.node) {
      opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    }
    if (!opacity) {
      return;
    }

    opacity.opacity = 76;
    tween(opacity)
      .repeatForever(
        tween()
          .to(0.75, { opacity: 255 })
          .to(0.75, { opacity: 76 }),
      )
      .start();
  }

  private _stopPulse(): void {
    this._active = false;
    this.node.active = false;
    Tween.stopAllByTarget(this.node);
    if (this.pulseSprite?.node) {
      Tween.stopAllByTarget(this.pulseSprite.node);
    }
  }

  onDestroy(): void {
    this._stopPulse();
  }
}
