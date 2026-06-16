/**
 * 通用装备卡片 — 7 层图层（L0-L7）
 */

import {
  _decorator,
  Button,
  Color,
  Component,
  Label,
  Node,
  Sprite,
  UITransform,
  view,
} from 'cc';
import { IItemCardViewModel } from '../ItemDisplayTypes';
import { ItemStarBadge } from './ItemStarBadge';
import { ItemModBadge } from './ItemModBadge';
import { TagIconStrip } from './TagIconStrip';
import { SynergyHighlightController } from './SynergyHighlightController';
import { CdMaxPulseController } from './CdMaxPulseController';
import { applySpriteFrame, loadSpriteFrame } from './ItemSpriteLoader';

const { ccclass, property } = _decorator;

export type ItemCardClickHandler = (vm: IItemCardViewModel) => void;

@ccclass('ItemCardWidget')
export class ItemCardWidget extends Component {
  @property(Sprite)
  rarityFrame: Sprite | null = null;

  @property(Sprite)
  iconSprite: Sprite | null = null;

  /** 技能名称（品质染色） */
  @property(Label)
  nameLabel: Label | null = null;

  @property(Node)
  cdOverlayNode: Node | null = null;

  @property(Sprite)
  cdOverlayBar: Sprite | null = null;

  /** CdOverlay 上的剩余 CD 秒数 */
  @property(Label)
  cdTimeLabel: Label | null = null;

  /** CdOverlay/CdReadyEffect — CD 就绪粒子特效节点 */
  @property(Node)
  cdReadyEffect: Node | null = null;

  @property(CdMaxPulseController)
  cdReadyEffectCtrl: CdMaxPulseController | null = null;

  @property(ItemStarBadge)
  starBadge: ItemStarBadge | null = null;

  @property(ItemModBadge)
  modBadge: ItemModBadge | null = null;

  @property(TagIconStrip)
  tagStrip: TagIconStrip | null = null;

  @property(Label)
  shopHintLabel: Label | null = null;

  @property(SynergyHighlightController)
  synergyPulse: SynergyHighlightController | null = null;

  @property(Button)
  clickButton: Button | null = null;

  @property(Node)
  emptySlotNode: Node | null = null;

  @property(Sprite)
  emptySlotSprite: Sprite | null = null;

  @property(Label)
  emptyHintLabel: Label | null = null;

  private _viewModel: IItemCardViewModel | null = null;
  private _onClick: ItemCardClickHandler | null = null;
  private _lastIconPath = '';
  private _lastEmptyLocked: boolean | null = null;
  private _lastNameColor = '';
  private readonly _nameColor = new Color();

  onLoad(): void {
    this._resolveBindings();
    const btn = this.clickButton ?? this.getComponent(Button);
    if (btn) {
      btn.node.on(Button.EventType.CLICK, this._handleClick, this);
    }
  }

  private _resolveBindings(): void {
    if (!this.nameLabel) {
      this.nameLabel =
        this.node.getChildByName('ItemNameLabel')?.getComponent(Label) ??
        null;
    }
    if (!this.tagStrip) {
      this.tagStrip = this.getComponentInChildren(TagIconStrip);
    }
    if (!this.cdOverlayNode) {
      this.cdOverlayNode = this.node.getChildByName('CdOverlay');
    }
    if (!this.cdOverlayBar && this.cdOverlayNode) {
      const barNode = this.cdOverlayNode.getChildByName('CdOverlayBar');
      this.cdOverlayBar = barNode?.getComponent(Sprite) ?? null;
    }
    if (!this.cdTimeLabel && this.cdOverlayNode) {
      this.cdTimeLabel =
        this.cdOverlayNode.getChildByName('CdTimeLabel')?.getComponent(Label) ??
        null;
    }
    if (!this.cdReadyEffect && this.cdOverlayNode) {
      this.cdReadyEffect =
        this.cdOverlayNode.getChildByName('CdReadyEffect') ??
        this.cdOverlayNode.getChildByName('CdMaxBadge');
    }
    if (!this.cdReadyEffectCtrl && this.cdReadyEffect) {
      this.cdReadyEffectCtrl =
        this.cdReadyEffect.getComponent(CdMaxPulseController);
    }
    if (!this.modBadge) {
      this.modBadge = this.getComponentInChildren(ItemModBadge);
    }
    if (!this.emptySlotSprite && this.emptySlotNode) {
      const bg =
        this.emptySlotNode.getChildByName('EmptyBg') ??
        this.emptySlotNode.children[0];
      this.emptySlotSprite = bg?.getComponent(Sprite) ?? null;
    }
  }

  setClickHandler(handler: ItemCardClickHandler | null): void {
    this._onClick = handler;
  }

  bind(viewModel: IItemCardViewModel): void {
    const prev = this._viewModel;
    this._viewModel = viewModel;
    this._resolveBindings();

    if (viewModel.isEmpty) {
      this._showEmptySlot(viewModel);
      return;
    }

    if (this.emptySlotNode) {
      this.emptySlotNode.active = false;
    }
    this._lastEmptyLocked = null;
    if (this.iconSprite?.node) {
      this.iconSprite.node.active = true;
    }
    if (this.starBadge?.node) {
      this.starBadge.node.active = true;
    }

    const identityChanged =
      !prev || prev.isEmpty || prev.configId !== viewModel.configId;
    const modChanged =
      !prev || prev.isEmpty || prev.hasMod !== viewModel.hasMod;

    if (identityChanged) {
      this._applyRarityFrame(viewModel);
      this._applyIcon(viewModel);
      this._applyNameLabel(viewModel);
      this.starBadge?.apply(
        viewModel.star,
        viewModel.maxStar,
        viewModel.mergeStarPulse,
      );
      this.tagStrip?.apply(viewModel.tagIcons);

      if (this.shopHintLabel) {
        this.shopHintLabel.node.active = viewModel.showMergeHint;
        this.shopHintLabel.string = viewModel.mergeHintText;
      }

      this.synergyPulse?.setActive(viewModel.synergyPulse);

      const btn = this.clickButton ?? this.getComponent(Button);
      if (btn) {
        btn.interactable = viewModel.clickable;
      }
    } else {
      this._applyNameLabel(viewModel);
    }

    if (identityChanged || modChanged) {
      this.modBadge?.apply(viewModel.hasMod, viewModel.modNames);
    }

    this._applyCdOverlay(viewModel);
  }

  setSynergyPulse(on: boolean): void {
    this.synergyPulse?.setActive(on);
    if (this._viewModel) {
      this._viewModel.synergyPulse = on;
    }
  }

  private _showEmptySlot(vm: IItemCardViewModel): void {
    if (this.emptySlotNode) {
      this.emptySlotNode.active = true;
    }
    if (this.nameLabel?.node) {
      this.nameLabel.node.active = false;
    }
    if (this._lastEmptyLocked !== vm.slotLocked) {
      this._lastEmptyLocked = vm.slotLocked;
      this._applyEmptySlotFrame(vm.slotLocked);
    }
    if (this.rarityFrame?.node) {
      this.rarityFrame.node.active = false;
    }
    if (this.iconSprite?.node) {
      this.iconSprite.node.active = false;
    }
    if (this.cdOverlayNode) {
      this.cdOverlayNode.active = false;
    }
    this._setCdTimeVisible(false);
    this._setCdReadyEffect(false);
    if (this.starBadge?.node) {
      this.starBadge.node.active = false;
    }
    this.modBadge?.apply(false);
    this.tagStrip?.apply([]);
    if (this.shopHintLabel) {
      this.shopHintLabel.node.active = false;
      this.shopHintLabel.string = '';
    }
    this.synergyPulse?.setActive(false);
    if (this.emptyHintLabel) {
      this.emptyHintLabel.node.active = !!vm.slotLocked;
      this.emptyHintLabel.string = vm.slotLocked ? '锁定' : '';
    }
    const btn = this.clickButton ?? this.getComponent(Button);
    if (btn) {
      btn.interactable = !vm.slotLocked;
    }
  }

  private _applyNameLabel(vm: IItemCardViewModel): void {
    if (!this.nameLabel) {
      return;
    }
    this.nameLabel.node.active = true;
    this.nameLabel.string = vm.name;
    if (this._lastNameColor !== vm.rarityColor) {
      this._lastNameColor = vm.rarityColor;
      Color.fromHEX(this._nameColor, vm.rarityColor);
      this.nameLabel.color = this._nameColor;
    }
  }

  private _applyRarityFrame(vm: IItemCardViewModel): void {
    if (!this.rarityFrame) {
      return;
    }
    this.rarityFrame.node.active = true;
    const c = new Color();
    Color.fromHEX(c, vm.rarityColor);
    this.rarityFrame.color = c;

    const path = vm.rarityFrameKey.replace(/^textures\//, 'textures/');
    loadSpriteFrame(path).then((sf) => {
      if (sf && this._viewModel?.configId === vm.configId) {
        applySpriteFrame(this.rarityFrame, sf);
        this.rarityFrame!.color = Color.WHITE;
      }
    });
  }

  private _applyIcon(vm: IItemCardViewModel): void {
    if (!this.iconSprite) {
      return;
    }
    const path = vm.iconPath.replace(/^textures\//, 'textures/');
    if (this._lastIconPath !== path) {
      this._lastIconPath = path;
      this.iconSprite.spriteFrame = null;
    }
    loadSpriteFrame(path).then((sf) => {
      if (this._lastIconPath !== path || this._viewModel?.configId !== vm.configId) {
        return;
      }
      if (sf) {
        applySpriteFrame(this.iconSprite, sf);
      } else {
        this._applyIconPlaceholder(path, vm.configId);
      }
    });
  }

  private _applyIconPlaceholder(requestPath: string, configId: string): void {
    loadSpriteFrame('textures/item-display/frames/icon_placeholder').then(
      (sf) => {
        if (
          this._lastIconPath === requestPath &&
          this._viewModel?.configId === configId &&
          sf
        ) {
          applySpriteFrame(this.iconSprite, sf);
        }
      },
    );
  }

  private _applyCdOverlay(vm: IItemCardViewModel): void {
    if (!this.cdOverlayNode) {
      return;
    }

    this.cdOverlayNode.active = vm.showCdOverlay;
    if (!vm.showCdOverlay) {
      this._setCdTimeVisible(false);
      this._setCdReadyEffect(false);
      if (this.cdOverlayBar) {
        this.cdOverlayBar.fillRange = 0;
      }
      return;
    }

    if (this.cdOverlayBar) {
      this.cdOverlayBar.fillRange = vm.cdProgress;
    }

    this._setCdTimeVisible(vm.showCdTime, vm.cdText);
    this._setCdReadyEffect(vm.cdAtMax);

    if (this.starBadge?.node) {
      this.starBadge.node.active = true;
    }
  }

  private _setCdTimeVisible(visible: boolean, text = ''): void {
    if (!this.cdTimeLabel) {
      return;
    }
    this.cdTimeLabel.node.active = visible;
    if (visible) {
      this.cdTimeLabel.string = text;
    } else {
      this.cdTimeLabel.string = '';
    }
  }

  private _setCdReadyEffect(on: boolean): void {
    const host = this.cdReadyEffect;
    if (host) {
      host.active = on;
    }

    const ctrl =
      this.cdReadyEffectCtrl ??
      host?.getComponent(CdMaxPulseController) ??
      null;
    ctrl?.setActive(on);
  }

  private _applyEmptySlotFrame(locked: boolean): void {
    const sprite =
      this.emptySlotSprite ??
      this.emptySlotNode?.getChildByName('EmptyBg')?.getComponent(Sprite) ??
      this.emptySlotNode?.getComponent(Sprite) ??
      this.emptySlotNode?.getComponentInChildren(Sprite) ??
      null;
    if (!sprite) {
      return;
    }
    sprite.node.active = true;
    const path = locked
      ? 'textures/item-display/frames/slot_locked'
      : 'textures/item-display/frames/slot_empty';
    loadSpriteFrame(path).then((sf) => {
      if (sf && this._viewModel?.isEmpty) {
        applySpriteFrame(sprite, sf);
      }
    });
  }

  setMergeStarPulse(on: boolean): void {
    if (!this._viewModel || this._viewModel.isEmpty) {
      return;
    }
    this._viewModel.mergeStarPulse = on;
    this.starBadge?.apply(
      this._viewModel.star,
      this._viewModel.maxStar,
      on,
    );
  }

  private _handleClick(): void {
    if (!this._viewModel?.clickable || !this._onClick) {
      return;
    }
    this._onClick(this._viewModel);
  }

  getAnchorRect(): { x: number; y: number; width: number; height: number } {
    const transform = this.node.getComponent(UITransform);
    const world = this.node.worldPosition;
    const visible = view.getVisibleSize();
    const w = transform?.contentSize.width ?? 112;
    const h = transform?.contentSize.height ?? 112;
    return {
      x: world.x - visible.width / 2 - w / 2,
      y: world.y - visible.height / 2 - h / 2,
      width: w,
      height: h,
    };
  }
}
