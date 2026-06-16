/**
 * 装备详情悬浮层 — 非全屏 Popover（§4）
 */

import {
  _decorator,
  BlockInputEvents,
  Button,
  Color,
  Component,
  Label,
  Mask,
  Node,
  ScrollView,
  Sprite,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { IItemDetailViewModel } from '../ItemDisplayTypes';
import {
  computePopoverLayout,
  DEFAULT_POPOVER_HEIGHT,
  DEFAULT_POPOVER_WIDTH,
} from '../PopoverLayoutUtil';
import { getPopoverBgKey } from '../RarityDisplayUtil';
import { applySpriteFrame, loadSpriteFrame } from './ItemSpriteLoader';

const { ccclass, property } = _decorator;

const POPOVER_WIDTH = DEFAULT_POPOVER_WIDTH;
const POPOVER_HEIGHT = DEFAULT_POPOVER_HEIGHT;
const CONTENT_INSET = 8;
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1280;

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
  private _uiReady = false;
  private _scrollView: ScrollView | null = null;
  private _contentNode: Node | null = null;

  onLoad(): void {
    this.node.active = false;
    this._resolveBindings();
    this._ensureDefaultUi();
    this._wireInteractions();
  }

  setBuildSynergyHandler(handler: (() => void) | null): void {
    this._onBuildSynergy = handler;
  }

  setHideHandler(handler: (() => void) | null): void {
    this._onHide = handler;
  }

  updateContent(detail: IItemDetailViewModel): void {
    this._fillContent(detail);
    const panelHeight =
      this.panelNode?.getComponent(UITransform)?.contentSize.height ??
      POPOVER_HEIGHT;
    this._syncScrollContent(panelHeight);
  }

  show(
    detail: IItemDetailViewModel,
    anchorRect: { x: number; y: number; width: number; height: number },
    screenRect: { x: number; y: number; width: number; height: number },
  ): void {
    this._ensureDefaultUi();
    this._fillContent(detail);
    const layout = computePopoverLayout(anchorRect, screenRect);
    if (this.panelNode) {
      const transform = this.panelNode.getComponent(UITransform);
      if (transform) {
        transform.setContentSize(POPOVER_WIDTH, layout.maxHeight);
      }
      this.panelNode.setPosition(layout.x, layout.y, 0);
      this._syncScrollContent(layout.maxHeight);
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

  private _wireInteractions(): void {
    if (this.backdropNode) {
      this.backdropNode.off(Node.EventType.TOUCH_END, this._onBackdropTap, this);
      this.backdropNode.on(Node.EventType.TOUCH_END, this._onBackdropTap, this);
    }
    if (this.buildSynergyBtn) {
      this.buildSynergyBtn.node.off(
        Button.EventType.CLICK,
        this._onBuildSynergyClick,
        this,
      );
      this.buildSynergyBtn.node.on(
        Button.EventType.CLICK,
        this._onBuildSynergyClick,
        this,
      );
    }
  }

  private _onBuildSynergyClick(): void {
    this._onBuildSynergy?.();
  }

  private _resolveBindings(): void {
    this.backdropNode =
      this.backdropNode ?? this.node.getChildByName('Backdrop');
    this.panelNode = this.panelNode ?? this.node.getChildByName('Panel');
    const panel = this.panelNode;
    if (!panel) {
      return;
    }
    const content = panel.getChildByName('Content') ?? panel;

    this.nameLabel =
      this.nameLabel ?? content.getChildByName('NameLabel')?.getComponent(Label) ?? null;
    this.rarityLabel =
      this.rarityLabel ??
      content.getChildByName('RarityLabel')?.getComponent(Label) ??
      null;
    this.starLabel =
      this.starLabel ?? content.getChildByName('StarLabel')?.getComponent(Label) ?? null;
    this.modLabel =
      this.modLabel ?? content.getChildByName('ModLabel')?.getComponent(Label) ?? null;
    this.cdLabel =
      this.cdLabel ?? content.getChildByName('CdLabel')?.getComponent(Label) ?? null;
    this.priceLabel =
      this.priceLabel ??
      content.getChildByName('PriceLabel')?.getComponent(Label) ??
      null;
    this.sellPriceLabel =
      this.sellPriceLabel ??
      content.getChildByName('SellPriceLabel')?.getComponent(Label) ??
      null;
    this.affinityLabel =
      this.affinityLabel ??
      content.getChildByName('AffinityLabel')?.getComponent(Label) ??
      null;
    this.tagsLabel =
      this.tagsLabel ?? content.getChildByName('TagsLabel')?.getComponent(Label) ?? null;
    this.effectsLabel =
      this.effectsLabel ??
      content.getChildByName('EffectsLabel')?.getComponent(Label) ??
      null;
    this.modEffectsLabel =
      this.modEffectsLabel ??
      content.getChildByName('ModEffectsLabel')?.getComponent(Label) ??
      null;
    this.mergeHintLabel =
      this.mergeHintLabel ??
      content.getChildByName('MergeHintLabel')?.getComponent(Label) ??
      null;
    this.buildPreviewLabel =
      this.buildPreviewLabel ??
      content.getChildByName('BuildPreviewLabel')?.getComponent(Label) ??
      null;
    this.buildSynergyBtn =
      this.buildSynergyBtn ??
      content.getChildByName('BuildSynergyBtn')?.getComponent(Button) ??
      null;
    this._contentNode = content;
    this._scrollView = panel.getComponent(ScrollView);
  }

  private _ensureDefaultUi(): void {
    if (this._uiReady && this.panelNode && this.backdropNode) {
      return;
    }

    let rootTransform = this.node.getComponent(UITransform);
    if (!rootTransform) {
      rootTransform = this.node.addComponent(UITransform);
    }
    rootTransform.setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    if (!this.backdropNode) {
      const backdrop = new Node('Backdrop');
      backdrop.setParent(this.node);
      backdrop.setSiblingIndex(0);
      const backdropTransform = backdrop.addComponent(UITransform);
      backdropTransform.setContentSize(SCREEN_WIDTH, SCREEN_HEIGHT);
      backdrop.addComponent(BlockInputEvents);
      const backdropSprite = backdrop.addComponent(Sprite);
      backdropSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      backdropSprite.color = new Color(0, 0, 0, 120);
      loadSpriteFrame(getPopoverBgKey()).then((sf) => {
        applySpriteFrame(backdropSprite, sf);
      });
      this.backdropNode = backdrop;
    }

    if (!this.panelNode) {
      const panel = new Node('Panel');
      panel.setParent(this.node);
      panel.setSiblingIndex(1);
      const panelTransform = panel.addComponent(UITransform);
      panelTransform.setContentSize(POPOVER_WIDTH, POPOVER_HEIGHT);
      panelTransform.setAnchorPoint(0, 1);
      panel.addComponent(UIOpacity);
      panel.addComponent(Mask);
      const panelSprite = panel.addComponent(Sprite);
      panelSprite.type = Sprite.Type.SLICED;
      panelSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      loadSpriteFrame(getPopoverBgKey()).then((sf) => {
        applySpriteFrame(panelSprite, sf);
      });

      const scrollView = panel.addComponent(ScrollView);
      scrollView.vertical = true;
      scrollView.horizontal = false;
      scrollView.inertia = true;
      scrollView.brake = 0.75;
      this._scrollView = scrollView;

      const content = new Node('Content');
      content.setParent(panel);
      content.setPosition(CONTENT_INSET, -CONTENT_INSET, 0);
      const contentTransform = content.addComponent(UITransform);
      contentTransform.setAnchorPoint(0, 1);
      contentTransform.setContentSize(
        POPOVER_WIDTH - CONTENT_INSET * 2,
        POPOVER_HEIGHT - CONTENT_INSET * 2,
      );
      scrollView.content = content;
      this._contentNode = content;
      this.panelNode = panel;

      const specs: Array<{
        name: string;
        y: number;
        fontSize: number;
        height: number;
        color?: Color;
        overflow?: number;
      }> = [
        { name: 'NameLabel', y: -12, fontSize: 22, height: 28, color: new Color(255, 235, 120) },
        { name: 'RarityLabel', y: -40, fontSize: 18, height: 24 },
        { name: 'StarLabel', y: -64, fontSize: 18, height: 24, color: new Color(255, 213, 79) },
        { name: 'ModLabel', y: -88, fontSize: 16, height: 22, color: new Color(129, 199, 132) },
        { name: 'CdLabel', y: -112, fontSize: 16, height: 22 },
        { name: 'PriceLabel', y: -136, fontSize: 16, height: 22 },
        { name: 'SellPriceLabel', y: -160, fontSize: 16, height: 22 },
        { name: 'AffinityLabel', y: -184, fontSize: 16, height: 22, color: new Color(144, 202, 249) },
        { name: 'TagsLabel', y: -208, fontSize: 14, height: 20, color: new Color(189, 189, 189) },
        {
          name: 'EffectsLabel',
          y: -232,
          fontSize: 15,
          height: 72,
          overflow: Label.Overflow.RESIZE_HEIGHT,
        },
        {
          name: 'ModEffectsLabel',
          y: -308,
          fontSize: 14,
          height: 48,
          overflow: Label.Overflow.RESIZE_HEIGHT,
          color: new Color(165, 214, 167),
        },
        { name: 'MergeHintLabel', y: -360, fontSize: 14, height: 22, color: new Color(255, 183, 77) },
        { name: 'BuildPreviewLabel', y: -384, fontSize: 14, height: 22, color: new Color(128, 222, 234) },
      ];

      for (const spec of specs) {
        this._addPanelLabel(content, spec);
      }

      const btnNode = new Node('BuildSynergyBtn');
      btnNode.setParent(content);
      btnNode.setPosition((POPOVER_WIDTH - CONTENT_INSET * 2) / 2, -418, 0);
      const btnTransform = btnNode.addComponent(UITransform);
      btnTransform.setContentSize(120, 32);
      const btnLabel = btnNode.addComponent(Label);
      btnLabel.string = 'Build 详情';
      btnLabel.fontSize = 16;
      btnLabel.lineHeight = 20;
      btnLabel.color = new Color(255, 255, 255, 255);
      this.buildSynergyBtn = btnNode.addComponent(Button);
      this.buildSynergyBtn.transition = Button.Transition.SCALE;
      this.buildSynergyBtn.zoomScale = 0.95;
    }

    this._resolveBindings();
    this._wireInteractions();
    this._uiReady = true;
  }

  private _addPanelLabel(
    panel: Node,
    spec: {
      name: string;
      y: number;
      fontSize: number;
      height: number;
      color?: Color;
      overflow?: number;
    },
  ): Label {
    const node = new Node(spec.name);
    node.setParent(panel);
    node.setPosition(0, spec.y, 0);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(POPOVER_WIDTH - CONTENT_INSET * 2, spec.height);
    transform.setAnchorPoint(0, 1);
    const label = node.addComponent(Label);
    label.fontSize = spec.fontSize;
    label.lineHeight = spec.height;
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.TOP;
    label.overflow = spec.overflow ?? Label.Overflow.CLAMP;
    label.enableWrapText = true;
    label.color = spec.color ?? new Color(230, 230, 230, 255);
    return label;
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

  /** §4.1：缩小 maxHeight 后同步可滚动内容高度 */
  private _syncScrollContent(viewHeight: number): void {
    const content = this._contentNode;
    if (!content) {
      return;
    }

    let lowestY = 0;
    for (const child of content.children) {
      if (!child.active) {
        continue;
      }
      const transform = child.getComponent(UITransform);
      if (!transform) {
        continue;
      }
      const bottom = child.position.y - transform.height;
      lowestY = Math.min(lowestY, bottom);
    }

    const innerWidth = POPOVER_WIDTH - CONTENT_INSET * 2;
    const contentHeight = Math.max(
      viewHeight - CONTENT_INSET * 2,
      -lowestY + 16,
    );
    const contentTransform = content.getComponent(UITransform);
    contentTransform?.setContentSize(innerWidth, contentHeight);

    this._scrollView?.scrollToTop(0.01);
  }
}
