/**
 * 装备详情悬浮层 — 非全屏 Popover（§4）
 */

import {
  _decorator,
  Button,
  Color,
  Component,
  Label,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { IItemDetailViewModel } from '../ItemDisplayTypes';
import { computePopoverLayout } from '../PopoverLayoutUtil';

const { ccclass, property } = _decorator;

@ccclass('ItemDetailPopover')
export class ItemDetailPopover extends Component {
  @property(Node)
  panelNode: Node | null = null;

  @property(Label)
  nameLabel: Label | null = null;

  @property(Label)
  rarityLabel: Label | null = null;

  @property(Label)
  starLabel: Label | null = null;

  @property(Label)
  modLabel: Label | null = null;

  @property(Label)
  cdLabel: Label | null = null;

  @property(Label)
  priceLabel: Label | null = null;

  @property(Label)
  sellPriceLabel: Label | null = null;

  @property(Label)
  affinityLabel: Label | null = null;

  @property(Label)
  tagsLabel: Label | null = null;

  @property(Label)
  effectsLabel: Label | null = null;

  @property(Label)
  modEffectsLabel: Label | null = null;

  @property(Label)
  mergeHintLabel: Label | null = null;

  @property(Label)
  buildPreviewLabel: Label | null = null;

  @property(Button)
  buildSynergyBtn: Button | null = null;

  @property(Node)
  backdropNode: Node | null = null;

  private _visible = false;
  private _onBuildSynergy: (() => void) | null = null;
  private _onHide: (() => void) | null = null;

  onLoad(): void {
    this.node.active = false;
    if (this.backdropNode) {
      this.backdropNode.on(Node.EventType.TOUCH_END, this._onBackdropTap, this);
    }
    if (this.buildSynergyBtn) {
      this.buildSynergyBtn.node.on(
        Button.EventType.CLICK,
        () => this._onBuildSynergy?.(),
        this,
      );
    }
  }

  setBuildSynergyHandler(handler: (() => void) | null): void {
    this._onBuildSynergy = handler;
  }

  setHideHandler(handler: (() => void) | null): void {
    this._onHide = handler;
  }

  show(
    detail: IItemDetailViewModel,
    anchorRect: { x: number; y: number; width: number; height: number },
    screenRect: { x: number; y: number; width: number; height: number },
  ): void {
    this._fillContent(detail);
    const layout = computePopoverLayout(anchorRect, screenRect);
    if (this.panelNode) {
      this.panelNode.setPosition(layout.x, layout.y, 0);
      const transform = this.panelNode.getComponent(UITransform);
      if (transform) {
        transform.height = layout.maxHeight;
      }
    }

    this.node.active = true;
    this._visible = true;
    this._playOpenAnim();
  }

  hide(): void {
    if (!this._visible) {
      return;
    }
    this._visible = false;

    const opacity =
      this.panelNode?.getComponent(UIOpacity) ??
      this.panelNode?.addComponent(UIOpacity);
    if (!opacity) {
      this.node.active = false;
      return;
    }

    tween(opacity)
      .to(0.15, { opacity: 0 })
      .call(() => {
        this.node.active = false;
        opacity.opacity = 255;
        this._onHide?.();
      })
      .start();
  }

  isVisible(): boolean {
    return this._visible;
  }

  private _fillContent(detail: IItemDetailViewModel): void {
    if (this.nameLabel) {
      this.nameLabel.string = detail.name;
    }
    if (this.rarityLabel) {
      this.rarityLabel.string = detail.rarityLabel;
    }
    if (this.starLabel) {
      this.starLabel.string = '★'.repeat(detail.star);
    }
    if (this.modLabel) {
      this.modLabel.node.active = detail.modNames.length > 0;
      this.modLabel.string =
        detail.modNames.length > 0
          ? `[改装] ${detail.modNames.join(' ')}`
          : '';
    }
    if (this.cdLabel) {
      this.cdLabel.string = `基础 CD：${detail.baseCdText}`;
    }
    if (this.priceLabel) {
      this.priceLabel.node.active = detail.showPrice;
      this.priceLabel.string = `价格：${detail.priceText}`;
      if (detail.priceText === '免费') {
        this.priceLabel.color = new Color(76, 175, 80);
      }
    }
    if (this.sellPriceLabel) {
      this.sellPriceLabel.node.active = detail.showSellPrice;
      this.sellPriceLabel.string = `出售：${detail.sellPriceText}（即将开放）`;
    }
    if (this.affinityLabel) {
      this.affinityLabel.node.active = !!detail.affinityLabel;
      this.affinityLabel.string = detail.affinityLabel;
    }
    if (this.tagsLabel) {
      this.tagsLabel.string = detail.tags
        .map((t) => t.label)
        .join(' · ');
    }
    if (this.effectsLabel) {
      this.effectsLabel.string = detail.effects
        .map((e) => {
          let line = `【${e.typeLabel}】${e.description}`;
          if (e.showStarArrow && e.nextValueText) {
            line = `【${e.typeLabel}】${e.currentValueText} → ${e.nextValueText}`;
          }
          if (e.valueHighlighted && e.baseValueHint) {
            line += ` (${e.baseValueHint})`;
          }
          return line;
        })
        .join('\n');
    }
    if (this.modEffectsLabel) {
      this.modEffectsLabel.node.active = detail.modEffects.length > 0;
      this.modEffectsLabel.string = detail.modEffects
        .map((m) => `【${m.modName}】${m.description}`)
        .join('\n');
    }
    if (this.mergeHintLabel) {
      this.mergeHintLabel.node.active = detail.showMergeHint;
      this.mergeHintLabel.string = detail.mergeHintText;
    }
    if (this.buildPreviewLabel) {
      const preview = detail.buildPreview;
      if (preview.linkedItemNames.length === 0) {
        this.buildPreviewLabel.node.active = false;
      } else {
        this.buildPreviewLabel.node.active = true;
        const prefix = preview.isPreview
          ? preview.previewPrefix
          : '联动：';
        const names = preview.linkedItemNames.join('、');
        this.buildPreviewLabel.string = preview.isPreview
          ? `装备后将与${prefix}${names}联动`
          : `${prefix}${names}`;
      }
    }
  }

  private _playOpenAnim(): void {
    if (!this.panelNode) {
      return;
    }
    const opacity =
      this.panelNode.getComponent(UIOpacity) ??
      this.panelNode.addComponent(UIOpacity);
    opacity.opacity = 0;
    this.panelNode.setScale(0.9, 0.9, 1);

    tween(this.panelNode)
      .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
      .start();
    tween(opacity).to(0.2, { opacity: 255 }, { easing: 'quadOut' }).start();
  }

  private _onBackdropTap(): void {
    this.hide();
  }
}
