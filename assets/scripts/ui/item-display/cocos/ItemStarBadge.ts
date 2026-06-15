/**
 * 星级徽章 — 空心↔实心闪烁（§14.3，周期 1.0s）
 */

import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

const PULSE_HALF_PERIOD = 0.5;

@ccclass('ItemStarBadge')
export class ItemStarBadge extends Component {
  @property(Label)
  starLabel: Label | null = null;

  private _star = 0;
  private _maxStar = 3;
  private _pulseActive = false;
  private _nextStarSolid = false;

  apply(star: number, maxStar: number, pulseNextStar = false): void {
    this._star = star;
    this._maxStar = maxStar;

    if (pulseNextStar && star < maxStar) {
      this._startPulse();
    } else {
      this._stopPulse();
      this._renderStars(false);
    }
  }

  private _renderStars(pulsing: boolean): void {
    if (!this.starLabel) {
      return;
    }
    let text = '';
    for (let i = 1; i <= this._maxStar; i++) {
      if (i <= this._star) {
        text += '★';
      } else if (i === this._star + 1 && pulsing) {
        text += this._nextStarSolid ? '★' : '☆';
      } else {
        text += '☆';
      }
    }
    this.starLabel.string = text;
  }

  private _startPulse(): void {
    if (this._pulseActive) {
      return;
    }
    this._pulseActive = true;
    this._nextStarSolid = false;
    this._renderStars(true);
    this.schedule(this._toggleNextStar, PULSE_HALF_PERIOD);
  }

  private _stopPulse(): void {
    if (!this._pulseActive) {
      return;
    }
    this._pulseActive = false;
    this.unschedule(this._toggleNextStar);
    this._nextStarSolid = false;
  }

  private _toggleNextStar = (): void => {
    this._nextStarSolid = !this._nextStarSolid;
    this._renderStars(true);
  };

  onDestroy(): void {
    this._stopPulse();
  }
}
