/**
 * 装备展示协调器 — Popover + 联动高亮 + 升星闪烁 + Build 面板
 */

import { _decorator, Component, view } from 'cc';
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

const { ccclass, property } = _decorator;

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

  setDeps(deps: IItemDisplayDeps): void {
    this._deps = deps;
    this._wirePopoverOnce();
  }

  refreshEquippedSlots(
    kind: 'battle_equipped' | 'shop_equipped',
    items: (IItemInstance | null)[],
  ): void {
    if (!this._deps) {
      return;
    }
    this._activeContextKind = kind;
    this._lastEquipped = items;

    for (let i = 0; i < 6; i++) {
      this._bindSlotCard(i, kind, items[i] ?? null);
    }

    if (this.detailPopover?.isVisible() && this._activeDetailCtx) {
      this._applyDetailHighlights(this._activeDetailCtx);
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
    if (!this._deps || !this.detailPopover) {
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

    this.detailPopover.show(detail, anchorRect, screenRect);
    this._applyDetailHighlights(ctx);
  }

  private _openBuildSynergy(): void {
    if (!this._activeDetailCtx || !this.buildSynergyPanel) {
      return;
    }
    const lines = buildSynergyAnalyzer.analyze(this._activeDetailCtx);
    this.buildSynergyPanel.show(lines);
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

  private _bindSlotCard(
    index: number,
    kind: 'battle_equipped' | 'shop_equipped',
    item: IItemInstance | null,
  ): void {
    const card = this.slotCards[index];
    if (!card || !this._deps) {
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
