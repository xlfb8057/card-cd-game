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
import { ITagDisplayInfo } from '../ItemTagRegistry';
import {
  computePopoverLayoutForMode,
  DEFAULT_POPOVER_HEIGHT,
  DEFAULT_POPOVER_WIDTH,
  PopoverPlacementMode,
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
  private _tagsRowNode: Node | null = null;
  private readonly _tagIconPool: Sprite[] = [];
  private readonly _tagTextPool: Label[] = [];

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
    options?: { placementMode?: PopoverPlacementMode },
  ): void {
    this._ensureDefaultUi();
    this._fillContent(detail);
    const layout = computePopoverLayoutForMode(
      anchorRect,
      screenRect,
      options?.placementMode ?? 'auto',
    );
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
    this._tagsRowNode =
      this._tagsRowNode ?? content.getChildByName('TagRow') ?? null;
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
        {
          name: 'EffectsLabel',
          y: -232,
          fontSize: 15,
          height: 20,
          overflow: Label.Overflow.RESIZE_HEIGHT,
        },
        {
          name: 'ModEffectsLabel',
          y: -308,
          fontSize: 14,
          height: 18,
          overflow: Label.Overflow.RESIZE_HEIGHT,
          color: new Color(165, 214, 167),
        },
        { name: 'MergeHintLabel', y: -360, fontSize: 14, height: 22, color: new Color(255, 183, 77) },
        { name: 'BuildPreviewLabel', y: -384, fontSize: 14, height: 22, color: new Color(128, 222, 234) },
      ];

      for (const spec of specs) {
        this._addPanelLabel(content, spec);
      }

      const tagRow = new Node('TagRow');
      tagRow.setParent(content);
      const tagRowUt = tagRow.addComponent(UITransform);
      tagRowUt.setAnchorPoint(0, 1);
      tagRowUt.setContentSize(POPOVER_WIDTH - CONTENT_INSET * 2, 24);
      this._tagsRowNode = tagRow;

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
    label.lineHeight = spec.fontSize + 5;
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
      this.nameLabel.color = this._colorFromHex(detail.rarityColor);
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
    this._renderTagRow(detail.tags);
    if (this.effectsLabel) {
      this.effectsLabel.string = detail.effects
        .map((e) => `【${e.typeLabel}】${e.description}`)
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

    this._reflowDetailRows();
    const panelHeight =
      this.panelNode?.getComponent(UITransform)?.contentSize.height ??
      POPOVER_HEIGHT;
    this._syncScrollContent(panelHeight);
  }

  /** 标签行：图标在前、文字在后 */
  private _renderTagRow(tags: ITagDisplayInfo[]): void {
    const row = this._tagsRowNode;
    if (!row) {
      return;
    }

    row.active = tags.length > 0;
    for (const sprite of this._tagIconPool) {
      sprite.node.active = false;
    }
    for (const label of this._tagTextPool) {
      label.node.active = false;
    }
    if (tags.length === 0) {
      return;
    }

    const innerWidth = POPOVER_WIDTH - CONTENT_INSET * 2;
    const iconSize = 20;
    const iconTextGap = 4;
    const tagGap = 10;
    let cursorX = 0;
    const rowHeight = 24;

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const icon = this._acquireTagIcon(i);
      const text = this._acquireTagText(i);
      const iconNode = icon.node;
      const textNode = text.node;

      iconNode.active = true;
      textNode.active = true;
      iconNode.setPosition(cursorX + iconSize / 2, -rowHeight / 2, 0);
      text.string = tag.label;
      text.fontSize = 14;
      text.lineHeight = 18;
      text.color = new Color(189, 189, 189, 255);
      text.updateRenderData(true);
      const textWidth = textNode.getComponent(UITransform)?.contentSize.width ?? 40;
      textNode.setPosition(cursorX + iconSize + iconTextGap, -rowHeight / 2, 0);
      textNode.getComponent(UITransform)?.setAnchorPoint(0, 0.5);

      const path = tag.iconPath;
      loadSpriteFrame(path).then((sf) => {
        if (icon.isValid && iconNode.active) {
          applySpriteFrame(icon, sf);
        }
      });

      cursorX += iconSize + iconTextGap + textWidth + tagGap;
    }

    row.getComponent(UITransform)?.setContentSize(
      Math.min(innerWidth, Math.max(cursorX - tagGap, iconSize)),
      rowHeight,
    );
  }

  private _acquireTagIcon(index: number): Sprite {
    while (this._tagIconPool.length <= index) {
      const node = new Node(`TagIcon_${this._tagIconPool.length}`);
      node.setParent(this._tagsRowNode!);
      const ut = node.addComponent(UITransform);
      ut.setContentSize(20, 20);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this._tagIconPool.push(sprite);
    }
    return this._tagIconPool[index];
  }

  private _acquireTagText(index: number): Label {
    while (this._tagTextPool.length <= index) {
      const node = new Node(`TagText_${this._tagTextPool.length}`);
      node.setParent(this._tagsRowNode!);
      node.addComponent(UITransform).setContentSize(80, 20);
      const label = node.addComponent(Label);
      label.horizontalAlign = Label.HorizontalAlign.LEFT;
      label.verticalAlign = Label.VerticalAlign.CENTER;
      label.overflow = Label.Overflow.NONE;
      this._tagTextPool.push(label);
    }
    return this._tagTextPool[index];
  }

  private _measureLabelHeight(label: Label | null): number {
    if (!label?.node.active) {
      return 0;
    }
    label.updateRenderData(true);
    return label.node.getComponent(UITransform)?.contentSize.height ?? label.lineHeight;
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

  /** §4.1：隐藏行不占位，避免战斗详情出现大块空行 */
  private _reflowDetailRows(): void {
    const topRows: Array<Label | null> = [
      this.nameLabel,
      this.rarityLabel,
      this.starLabel,
      this.modLabel,
      this.cdLabel,
      this.priceLabel,
      this.sellPriceLabel,
      this.affinityLabel,
    ];
    const bottomRows: Array<Label | null> = [
      this.effectsLabel,
      this.modEffectsLabel,
      this.mergeHintLabel,
      this.buildPreviewLabel,
    ];

    let y = -4;
    const gap = 4;

    const placeRow = (row: Label | null): void => {
      const node = row?.node;
      if (!node?.active) {
        return;
      }
      const height = this._measureLabelHeight(row);
      node.setPosition(0, y, 0);
      y -= height + gap;
    };

    for (const row of topRows) {
      placeRow(row);
    }

    if (this._tagsRowNode?.active) {
      this._tagsRowNode.setPosition(0, y, 0);
      const tagHeight =
        this._tagsRowNode.getComponent(UITransform)?.contentSize.height ?? 24;
      y -= tagHeight + gap;
    }

    for (const row of bottomRows) {
      placeRow(row);
    }

    if (this.buildSynergyBtn?.node.active) {
      this.buildSynergyBtn.node.setPosition(
        (POPOVER_WIDTH - CONTENT_INSET * 2) / 2,
        y - 8,
        0,
      );
    }
  }

  private _colorFromHex(hex: string): Color {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length < 6) {
      return new Color(255, 235, 120, 255);
    }
    return new Color(
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
      255,
    );
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
      const label = child.getComponent(Label);
      if (label) {
        label.updateRenderData(true);
      }
      const height = transform.contentSize.height;
      const bottom = child.position.y - height;
      lowestY = Math.min(lowestY, bottom);
    }

    if (this.buildSynergyBtn?.node.active) {
      const btnBottom = this.buildSynergyBtn.node.position.y - 16;
      lowestY = Math.min(lowestY, btnBottom);
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
