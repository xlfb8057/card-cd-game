/**
 * CD 就绪通用特效 — 金色光晕 + 简易粒子 burst（v4.1，无 MAX 文字）
 */

import {
  _decorator,
  Color,
  Component,
  Node,
  Sprite,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { applySpriteFrame, loadSpriteFrame } from './ItemSpriteLoader';
import { getCdReadyParticleKey } from '../RarityDisplayUtil';

const { ccclass, property } = _decorator;

const BURST_COUNT = 8;
const BURST_RADIUS = 36;

interface BurstParticle {
  node: Node;
  opacity: UIOpacity;
}

@ccclass('CdMaxPulseController')
export class CdMaxPulseController extends Component {
  @property(Sprite)
  glowSprite: Sprite | null = null;

  private _active = false;
  private _burstPool: BurstParticle[] = [];
  private _particleFrame: Awaited<ReturnType<typeof loadSpriteFrame>> = null;
  private _burstScheduled = false;

  onLoad(): void {
    if (!this.glowSprite) {
      this.glowSprite = this.getComponent(Sprite);
    }
    if (!this.glowSprite) {
      const glowNode = new Node('CdGlow');
      glowNode.setParent(this.node);
      const transform = glowNode.addComponent(UITransform);
      transform.setContentSize(112, 112);
      this.glowSprite = glowNode.addComponent(Sprite);
      this.glowSprite.color = new Color(255, 213, 79, 90);
      this.glowSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      loadSpriteFrame(getCdReadyParticleKey()).then((sf) => {
        if (sf && this.glowSprite?.isValid) {
          applySpriteFrame(this.glowSprite, sf);
        }
      });
    }
    this._ensureBurstPool();
    this.node.active = false;
  }

  setActive(on: boolean): void {
    if (on) {
      this._startEffect();
    } else {
      this._stopEffect();
    }
  }

  private _startEffect(): void {
    if (this._active) {
      return;
    }
    this._active = true;
    this.node.active = true;
    this._startGlowPulse();
    this._ensureBurstPool();
    this._playBurstCycle();
  }

  private _stopEffect(): void {
    if (!this._active) {
      return;
    }
    this._active = false;
    this._burstScheduled = false;
    this.unscheduleAllCallbacks();
    Tween.stopAllByTarget(this.node);
    const opacity = this.node.getComponent(UIOpacity);
    if (opacity) {
      Tween.stopAllByTarget(opacity);
      opacity.opacity = 255;
    }
    for (const particle of this._burstPool) {
      Tween.stopAllByTarget(particle.node);
      Tween.stopAllByTarget(particle.opacity);
      particle.node.active = false;
      particle.node.setPosition(0, 0, 0);
      particle.opacity.opacity = 0;
    }
    this.node.active = false;
  }

  private _startGlowPulse(): void {
    const opacity =
      this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    opacity.opacity = 80;
    Tween.stopAllByTarget(opacity);
    tween(opacity)
      .repeatForever(
        tween().to(0.5, { opacity: 220 }).to(0.5, { opacity: 80 }),
      )
      .start();
  }

  private _ensureBurstPool(): void {
    if (this._burstPool.length >= BURST_COUNT) {
      return;
    }

    loadSpriteFrame(getCdReadyParticleKey()).then((sf) => {
      if (!sf) {
        return;
      }
      this._particleFrame = sf;
      while (this._burstPool.length < BURST_COUNT) {
        const index = this._burstPool.length;
        const particle = new Node(`CdParticle_${index}`);
        particle.setParent(this.node);
        const transform = particle.addComponent(UITransform);
        transform.setContentSize(12, 12);
        const sprite = particle.addComponent(Sprite);
        applySpriteFrame(sprite, sf);
        sprite.color = new Color(255, 213, 79, 220);
        const opacity = particle.addComponent(UIOpacity);
        opacity.opacity = 0;
        particle.active = false;
        this._burstPool.push({ node: particle, opacity });
      }
    });
  }

  private _playBurstCycle(): void {
    if (!this._active || !this._particleFrame) {
      loadSpriteFrame(getCdReadyParticleKey()).then((sf) => {
        if (!sf || !this._active) {
          return;
        }
        this._particleFrame = sf;
        this._ensureBurstPool();
        this._playBurstCycle();
      });
      return;
    }

    for (let i = 0; i < this._burstPool.length; i++) {
      this._animateBurstParticle(this._burstPool[i], i);
    }

    if (!this._burstScheduled) {
      this._burstScheduled = true;
      this.schedule(() => {
        if (this._active) {
          this._playBurstCycle();
        }
      }, 0.6);
    }
  }

  private _animateBurstParticle(particle: BurstParticle, index: number): void {
    const { node, opacity } = particle;
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);

    node.setPosition(0, 0, 0);
    node.active = true;
    opacity.opacity = 220;

    const angle = (Math.PI * 2 * index) / BURST_COUNT;
    const target = new Vec3(
      Math.cos(angle) * BURST_RADIUS,
      Math.sin(angle) * BURST_RADIUS,
      0,
    );

    tween(node)
      .to(0.55, { position: target })
      .call(() => {
        if (node.isValid) {
          node.active = false;
          node.setPosition(0, 0, 0);
        }
      })
      .start();

    tween(opacity)
      .to(0.55, { opacity: 0 })
      .start();
  }

  onDisable(): void {
    this._stopEffect();
  }

  onDestroy(): void {
    this._stopEffect();
  }
}
