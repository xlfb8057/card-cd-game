/**
 * 装备展示协调器 — Popover + 联动高亮 + 升星闪烁 + Build 面板
 */

import {
  _decorator,
  assetManager,
  Component,
  instantiate,
  Node,
  Prefab,
  UITransform,
  view,
} from 'cc';
import { ItemCardWidget } from './cocos/ItemCardWidget';
import { ItemDetailPopover } from './cocos/ItemDetailPopover';
import { BuildSynergyPanel } from './cocos/BuildSynergyPanel';
import { itemDisplayPresenter } from './ItemDisplayPresenter';
import { buildSynergyResolver } from './BuildSynergyResolver';
import { buildSynergyAnalyzer } from './BuildSynergyAnalyzer';
import { mergeHintResolver } from './MergeHintResolver';
import {
  buildItemContext,
  IItemDisplayDeps,
} from './ItemDisplayContextFactory';
import { ItemDisplayContextKind } from './ItemDisplayTypes';
import { IItemInstance } from '../../models/ItemInstance';
import { ALL_TAG_ICON_PATHS } from './ItemTagRegistry';
import {
  getCdReadyParticleKey,
  getEmptySlotFrameKey,
  getLockedSlotFrameKey,
} from './RarityDisplayUtil';
import { preloadItemDisplayFrames } from './cocos/ItemSpriteLoader';

const { ccclass, property } = _decorator;

/** assets/prefabs/ui/ItemCardWidget.prefab */
const ITEM_CARD_WIDGET_PREFAB_UUID = '4ddf9954-19a4-4d98-8e46-721fb70c3032';

@ccclass('ItemDisplayController')
export class ItemDisplayController extends Component {
  @property({ type: [ItemCardWidget] })
  slotCards: ItemCardWidget[] = [];

  /** 商店待购商品卡（与 slotCards 分开） */
  @property({ type: [ItemCardWidget] })
  shopCards: ItemCardWidget[] = [];

  @property(ItemDetailPopover)
  detailPopover: ItemDetailPopover | null = null;

  @property(BuildSynergyPanel)
  buildSynergyPanel: BuildSynergyPanel | null = null;

  private _deps: IItemDisplayDeps | null = null;
  private _activeContextKind: ItemDisplayContextKind = 'battle_equipped';
  private _toastWired = false;
  private _popoverWired = false;
  private _lastEquipped: (IItemInstance | null)[] = [];
  private _activeDetailCtx: ReturnType<typeof buildItemContext> | null = null;
  private _battleSettled = false;
  private _framesPreloaded = false;
  private _slotSpawnPending = false;
  private _slotSpawnDone = false;

  onLoad(): void {
    this._resolveSlotCards();
    this.ensureBattleSlotWidgets();
    this.ensureDetailPopover();
    this.ensureBuildSynergyPanel();
  }

  start(): void {
    this._resolveSlotCards();
    this.ensureBattleSlotWidgets();
    this.ensureDetailPopover();
    this.ensureBuildSynergyPanel();
  }

  /** 战斗场景：从 resources 实例化 6× ItemCardWidget，并隐藏 Legacy Slot0~5 */
  ensureBattleSlotWidgets(slotHost?: Node | null): void {
    if (this._slotSpawnDone || this._slotSpawnPending) {
      return;
    }
    if (this.slotCards.filter((c) => c != null).length >= 6) {
      this._slotSpawnDone = true;
      this._hideLegacySlotChildren(slotHost);
      return;
    }

    const host = slotHost ?? this._findItemSlotsNode();
    if (!host) {
      console.warn('[ItemDisplay] ItemSlots 未找到，无法生成 ItemCardWidget');
      return;
    }

    this._slotSpawnPending = true;
    assetManager.loadAny(
      { uuid: ITEM_CARD_WIDGET_PREFAB_UUID },
      Prefab,
      (err, prefab) => {
      this._slotSpawnPending = false;
      if (err || !prefab) {
        console.error('[ItemDisplay] 加载 ItemCardWidget 预制体失败', err);
        return;
      }

      const cards: Array<ItemCardWidget | null> = new Array(6).fill(null);
      for (let i = 0; i < 6; i++) {
        const existing =
          host.getChildByName(`ItemCardWidget_${i}`) ??
          this.node.getChildByName(`ItemCardWidget_${i}`);
        if (existing) {
          cards[i] = existing.getComponent(ItemCardWidget);
          continue;
        }

        const legacySlot = host.getChildByName(`Slot${i}`);
        const node = instantiate(prefab);
        node.name = `ItemCardWidget_${i}`;
        if (legacySlot) {
          node.setPosition(legacySlot.position);
          legacySlot.active = false;
        } else {
          const cols = 3;
          const col = i % cols;
          const row = Math.floor(i / cols);
          node.setPosition(-118 + col * 118, 138 - row * 118, 0);
        }
        host.addChild(node);
        cards[i] = node.getComponent(ItemCardWidget);
      }

      this.slotCards = cards as ItemCardWidget[];
      this._slotSpawnDone = this.slotCards.filter((c) => c != null).length >= 6;
      this._hideLegacySlotChildren(host);
      if (this._slotSpawnDone) {
        console.log('[ItemDisplay] 已生成 6× ItemCardWidget（v4 战斗装备栏）');
      }
    },
    );
  }

  areBattleSlotsReady(): boolean {
    return (
      this._slotSpawnDone ||
      this.slotCards.filter((c) => c != null).length >= 6
    );
  }

  /** 战斗场景：运行时创建详情 Popover（避免损坏预制体脚本引用导致 setParent 崩溃） */
  ensureDetailPopover(): void {
    if (this.detailPopover?.isValid) {
      this._wirePopoverOnce();
      return;
    }

    const existing = this.node.getChildByName('ItemDetailPopover');
    if (existing?.isValid) {
      this.detailPopover = existing.getComponent(ItemDetailPopover);
      if (this.detailPopover) {
        this._bringOverlayToFront(existing);
        this._wirePopoverOnce();
        return;
      }
      existing.destroy();
    }

    const node = new Node('ItemDetailPopover');
    node.addComponent(UITransform).setContentSize(720, 1280);
    this.detailPopover = node.addComponent(ItemDetailPopover);
    node.setParent(this.node);
    this._bringOverlayToFront(node);
    this._wirePopoverOnce();
  }

  /** 战斗场景：运行时创建 Build 联动面板 */
  ensureBuildSynergyPanel(): void {
    if (this.buildSynergyPanel?.isValid) {
      return;
    }

    const existing = this.node.getChildByName('BuildSynergyPanel');
    if (existing?.isValid) {
      this.buildSynergyPanel = existing.getComponent(BuildSynergyPanel);
      if (this.buildSynergyPanel) {
        this._bringOverlayToFront(existing);
        return;
      }
      existing.destroy();
    }

    const node = new Node('BuildSynergyPanel');
    node.setPosition(160, 0, 0);
    node.addComponent(UITransform).setContentSize(280, 360);
    this.buildSynergyPanel = node.addComponent(BuildSynergyPanel);
    node.setParent(this.node);
    this._bringOverlayToFront(node);
  }

  private _bringOverlayToFront(node: Node): void {
    node.setSiblingIndex(this.node.children.length - 1);
  }

  private _findItemSlotsNode(): Node | null {
    const scene = this.node.scene;
    const canvas = scene?.getChildByName('Canvas');
    return (
      canvas?.getChildByName('ItemSlots') ??
      this.node.parent?.getChildByName('ItemSlots') ??
      null
    );
  }

  private _hideLegacySlotChildren(host: Node | null | undefined): void {
    if (!host) {
      return;
    }
    for (let i = 0; i < 6; i++) {
      const legacy = host.getChildByName(`Slot${i}`);
      if (legacy) {
        legacy.active = false;
      }
    }
  }

  setDeps(deps: IItemDisplayDeps): void {
    this._deps = deps;
    if (!this._framesPreloaded) {
      this._framesPreloaded = true;
      preloadItemDisplayFrames([
        ...ALL_TAG_ICON_PATHS,
        getCdReadyParticleKey(),
        getEmptySlotFrameKey(),
        getLockedSlotFrameKey(),
      ]);
    }
    this.ensureDetailPopover();
    this.ensureBuildSynergyPanel();
    this._wirePopoverOnce();
  }

  /** 更新运行时字段（如战斗中敌人毒层），避免每帧重复 setDeps */
  patchDeps(partial: Partial<IItemDisplayDeps>): void {
    if (!this._deps) {
      return;
    }
    this._deps = { ...this._deps, ...partial };
  }

  refreshEquippedSlots(
    kind: 'battle_equipped' | 'shop_equipped',
    items: (IItemInstance | null)[],
    options?: { battleSettled?: boolean },
  ): void {
    if (!this._deps) {
      return;
    }
    this._resolveSlotCards();
    this._battleSettled = options?.battleSettled === true;
    this._activeContextKind = kind;
    this._lastEquipped = items;

    for (let i = 0; i < 6; i++) {
      this._bindSlotCard(i, kind, items[i] ?? null);
    }

    if (this.detailPopover?.isVisible() && this._activeDetailCtx) {
      this._refreshVisibleDetail();
    }
  }

  refreshShopCards(
    entries: {
      configId: string;
      sold: boolean;
      shopIndex: number;
    }[],
  ): void {
    if (!this._deps) {
      return;
    }

    const widgets =
      this.shopCards.length > 0 ? this.shopCards : [];

    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];
      const entry = entries[i];
      if (!widget || !entry) {
        continue;
      }

      const ctx = buildItemContext(
        'shop_for_sale',
        entry.configId,
        this._deps,
        { sold: entry.sold, shopIndex: entry.shopIndex },
      );
      const vm = itemDisplayPresenter.buildCard(ctx);
      vm.clickable = !entry.sold;
      widget.setClickHandler(() => {
        if (!entry.sold) {
          this._openDetail(ctx, widget);
        }
      });
      widget.bind(vm);
    }
  }

  hideDetail(): void {
    this.detailPopover?.hide();
    this.buildSynergyPanel?.hide();
    this._activeDetailCtx = null;
    this._clearHighlights();
    this._rebindEquippedSlots();
  }

  private _wirePopoverOnce(): void {
    if (this._popoverWired || !this.detailPopover) {
      return;
    }
    this._popoverWired = true;
    this.detailPopover.setHideHandler(() => {
      this._activeDetailCtx = null;
      this._clearHighlights();
      this._rebindEquippedSlots();
      this.buildSynergyPanel?.hide();
    });
    this.detailPopover.setBuildSynergyHandler(() => this._openBuildSynergy());
  }

  private _openDetail(
    ctx: ReturnType<typeof buildItemContext>,
    anchor: ItemCardWidget,
  ): void {
    if (!this._deps) {
      return;
    }
    this.ensureDetailPopover();
    if (!this.detailPopover) {
      return;
    }

    this._activeDetailCtx = ctx;
    const detail = itemDisplayPresenter.buildDetail(ctx);
    const anchorRect = anchor.getAnchorRect();
    const visible = view.getVisibleSize();
    const screenRect = {
      x: -visible.width / 2,
      y: -visible.height / 2,
      width: visible.width,
      height: visible.height,
    };

    this.detailPopover.show(detail, anchorRect, screenRect, {
      placementMode:
        ctx.kind === 'battle_equipped' ? 'battle' : 'auto',
    });
    this._applyDetailHighlights(ctx);
  }

  private _openBuildSynergy(): void {
    if (!this._activeDetailCtx) {
      return;
    }
    this.ensureBuildSynergyPanel();
    if (!this.buildSynergyPanel) {
      return;
    }
    const ctx = this._rebuildDetailContext(this._activeDetailCtx);
    this._activeDetailCtx = ctx;
    const lines = buildSynergyAnalyzer.analyze(ctx);
    this.buildSynergyPanel.show(lines);
  }

  private _refreshVisibleDetail(): void {
    if (!this._deps || !this._activeDetailCtx || !this.detailPopover) {
      return;
    }
    const ctx = this._rebuildDetailContext(this._activeDetailCtx);
    this._activeDetailCtx = ctx;
    this.detailPopover.updateContent(itemDisplayPresenter.buildDetail(ctx));
    this._applyDetailHighlights(ctx);
  }

  private _rebuildDetailContext(
    ctx: ReturnType<typeof buildItemContext>,
  ): ReturnType<typeof buildItemContext> {
    if (!this._deps) {
      return ctx;
    }
    return buildItemContext(ctx.kind, ctx.configId, this._deps, {
      instance: ctx.instance,
      slotIndex: ctx.slotIndex,
      sold: ctx.sold,
      shopIndex: ctx.shopIndex,
      codexStar: ctx.codexStar,
      battleSettled: ctx.battleSettled,
    });
  }

  private _applyDetailHighlights(
    ctx: ReturnType<typeof buildItemContext>,
  ): void {
    this._clearHighlights();

    const linkedSlots = buildSynergyResolver.getLinkedSlots(
      ctx,
      ctx.configId,
    );
    for (const slot of linkedSlots) {
      this.slotCards[slot]?.setSynergyPulse(true);
    }

    const mergeHint = mergeHintResolver.getMergeHint(ctx);
    if (
      mergeHint.canMerge &&
      mergeHint.mergeTarget === 'equipped' &&
      mergeHint.equippedSlotIndex !== undefined &&
      ctx.kind !== 'backpack'
    ) {
      this.slotCards[mergeHint.equippedSlotIndex]?.setMergeStarPulse(true);
    }
  }

  private _clearHighlights(): void {
    for (const card of this.slotCards) {
      card?.setSynergyPulse(false);
      card?.setMergeStarPulse(false);
    }
  }

  private _rebindEquippedSlots(): void {
    if (!this._deps || this._lastEquipped.length === 0) {
      return;
    }
    for (let i = 0; i < 6; i++) {
      this._bindSlotCard(i, this._activeContextKind, this._lastEquipped[i] ?? null);
    }
  }

  private _resolveSlotCards(): void {
    const bound = this.slotCards.filter((card) => card != null).length;
    if (bound >= 6) {
      return;
    }

    const scene = this.node.scene;
    if (!scene) {
      return;
    }

    const canvas = scene.getChildByName('Canvas');
    const itemSlots = canvas?.getChildByName('ItemSlots') ?? null;
    const roots: Node[] = [];

    if (itemSlots) {
      for (const child of itemSlots.children) {
        if (child.name.startsWith('ItemCardWidget_')) {
          roots.push(child);
        }
      }
    } else if (canvas) {
      this._collectNamedCardNodes(canvas, roots);
    }

    roots.sort((a, b) => a.name.localeCompare(b.name));

    const cards: Array<ItemCardWidget | null> = new Array(6).fill(null);
    for (let i = 0; i < 6; i++) {
      const named = roots.find((node) => node.name === `ItemCardWidget_${i}`);
      const slotNode = itemSlots?.getChildByName(`Slot${i}`) ?? null;
      cards[i] =
        named?.getComponent(ItemCardWidget) ??
        slotNode?.getComponent(ItemCardWidget) ??
        slotNode?.getComponentInChildren(ItemCardWidget) ??
        this.slotCards[i] ??
        roots[i]?.getComponent(ItemCardWidget) ??
        null;
    }

    if (cards.some((card) => card != null)) {
      this.slotCards = cards as ItemCardWidget[];
    }
  }

  private _collectNamedCardNodes(root: Node, out: Node[]): void {
    if (root.name.startsWith('ItemCardWidget_')) {
      out.push(root);
    }
    for (const child of root.children) {
      this._collectNamedCardNodes(child, out);
    }
  }

  private _bindSlotCard(
    index: number,
    kind: 'battle_equipped' | 'shop_equipped',
    item: IItemInstance | null,
  ): void {
    if (!this._deps) {
      return;
    }

    let card = this.slotCards[index];
    if (!card) {
      this._resolveSlotCards();
      card = this.slotCards[index];
    }
    if (!card) {
      return;
    }

    if (!item) {
      const emptyVm = itemDisplayPresenter.buildEmptyCard(index, false);
      card.setClickHandler(() => this._onEmptySlotClick());
      card.bind(emptyVm);
      return;
    }

    const ctx = buildItemContext(kind, item.configId, this._deps, {
      instance: item,
      slotIndex: index,
      battleSettled:
        kind === 'battle_equipped' ? this._battleSettled : undefined,
    });
    const vm = itemDisplayPresenter.buildCard(ctx);
    card.setClickHandler(() => this._openDetail(ctx, card));
    card.bind(vm);
  }

  private _onEmptySlotClick(): void {
    this._emitToast('请在商店或背包装备');
  }

  private _emitToast(message: string): void {
    this.node.emit('item-display-toast', message);
  }

  ensureToastListener(handler: (msg: string) => void): void {
    if (this._toastWired) {
      return;
    }
    this._toastWired = true;
    this.node.on('item-display-toast', handler);
  }
}
