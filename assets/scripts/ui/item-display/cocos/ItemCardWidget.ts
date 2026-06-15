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

  @property(Node)
  cdOverlayNode: Node | null = null;

  @property(Sprite)
  cdOverlayBar: Sprite | null = null;

  @property(Node)
  cdMaxBadge: Node | null = null;

  @property(CdMaxPulseController)
  cdMaxPulse: CdMaxPulseController | null = null;

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

  @property(Label)
  emptyHintLabel: Label | null = null;

  private _viewModel: IItemCardViewModel | null = null;
  private _onClick: ItemCardClickHandler | null = null;

  onLoad(): void {
    const btn = this.clickButton ?? this.getComponent(Button);
    if (btn) {
      btn.node.on(Button.EventType.CLICK, this._handleClick, this);
    }
  }

  setClickHandler(handler: ItemCardClickHandler | null): void {
    this._onClick = handler;
  }

  bind(viewModel: IItemCardViewModel): void {
    this._viewModel = viewModel;

    if (viewModel.isEmpty) {
      this._showEmptySlot(viewModel);
      return;
    }

    if (this.emptySlotNode) {
      this.emptySlotNode.active = false;
    }

    this._applyRarityFrame(viewModel);
    this._applyIcon(viewModel);
    this._applyCdOverlay(viewModel);
    this.starBadge?.apply(
      viewModel.star,
      viewModel.maxStar,
      viewModel.mergeStarPulse,
    );
    this.modBadge?.apply(viewModel.hasMod, viewModel.modNames);
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
    if (this.rarityFrame?.node) {
      this.rarityFrame.node.active = false;
    }
    if (this.emptyHintLabel) {
      this.emptyHintLabel.string = vm.slotLocked ? '锁定' : '';
    }
    const btn = this.clickButton ?? this.getComponent(Button);
    if (btn) {
      btn.interactable = !vm.slotLocked;
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
    loadSpriteFrame(vm.iconPath.replace(/^textures\//, 'textures/')).then(
      (sf) => {
        if (sf && this._viewModel?.configId === vm.configId) {
          applySpriteFrame(this.iconSprite, sf);
        }
      },
    );
    loadSpriteFrame('textures/item-display/frames/icon_placeholder').then(
      (sf) => {
        if (!this.iconSprite?.spriteFrame && sf) {
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
      return;
    }

    if (this.cdOverlayBar) {
      this.cdOverlayBar.fillRange = 1 - vm.cdProgress;
    }
    if (this.cdMaxBadge) {
      this.cdMaxBadge.active = vm.cdAtMax;
    }
    this.cdMaxPulse?.setActive(vm.cdAtMax);
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
    const w = transform?.contentSize.width ?? 112;
    const h = transform?.contentSize.height ?? 112;
    return { x: world.x - w / 2, y: world.y - h / 2, width: w, height: h };
  }
}
