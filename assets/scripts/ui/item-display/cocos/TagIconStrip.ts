/**
 * 标签角标条 — 右下角 tags 小图标（24×24 Sprite，编辑器预置节点）
 */

import {
  _decorator,
  Component,
  Label,
  Node,
  Sprite,
} from 'cc';
import { ITagDisplayInfo } from '../ItemTagRegistry';
import {
  applySpriteFrame,
  loadSpriteFrame,
  peekSpriteFrame,
} from './ItemSpriteLoader';

const { ccclass, property } = _decorator;

@ccclass('TagIconStrip')
export class TagIconStrip extends Component {
  /** 图标容器；默认使用本节点 */
  @property(Node)
  tagIconContainer: Node | null = null;

  /** 在编辑器中预置的 TagIcon_0 ~ TagIcon_5 Sprite */
  @property({ type: [Sprite] })
  tagIcons: Sprite[] = [];

  /** @deprecated 不再显示文字 */
  @property(Label)
  fallbackLabel: Label | null = null;

  private _lastTagKey = '';
  private _slotTagIds: string[] = [];

  onLoad(): void {
    this._resolveContainer();
    this._collectPrefabIcons();
    if (this.fallbackLabel) {
      this.fallbackLabel.node.active = false;
    }
  }

  onEnable(): void {
    if (this.tagIcons.length === 0) {
      this._collectPrefabIcons();
    }
  }

  apply(tags: ITagDisplayInfo[]): void {
    const tagKey = tags.map((t) => t.tagId).join('|');
    this.node.active = tags.length > 0;

    if (tags.length === 0) {
      this._lastTagKey = '';
      this._slotTagIds = [];
      for (const sprite of this.tagIcons) {
        if (sprite?.node) {
          sprite.node.active = false;
        }
      }
      return;
    }

    const tagsChanged = tagKey !== this._lastTagKey;
    const slots = this.tagIcons;
    if (this._slotTagIds.length !== slots.length) {
      this._slotTagIds = new Array(slots.length).fill('');
    }

    if (this.fallbackLabel) {
      this.fallbackLabel.node.active = false;
      this.fallbackLabel.string = '';
    }

    for (let i = 0; i < slots.length; i++) {
      const sprite = slots[i];
      if (!sprite) {
        continue;
      }

      if (i >= tags.length) {
        sprite.node.active = false;
        this._slotTagIds[i] = '';
        continue;
      }

      sprite.node.active = true;
      const tag = tags[i];
      this._slotTagIds[i] = tag.tagId;

      const path = tag.iconPath.replace(/^textures\//, 'textures/');
      const needsLoad = tagsChanged || !sprite.spriteFrame;
      if (needsLoad) {
        this._applyIconSprite(sprite, path, i, tag.tagId);
      }
    }

    this._lastTagKey = tagKey;
  }

  private _applyIconSprite(
    sprite: Sprite,
    path: string,
    slotIndex: number,
    tagId: string,
  ): void {
    const cached = peekSpriteFrame(path);
    if (cached) {
      applySpriteFrame(sprite, cached);
      return;
    }

    loadSpriteFrame(path).then((sf) => {
      if (
        !sprite.isValid ||
        !sprite.node.active ||
        this._slotTagIds[slotIndex] !== tagId
      ) {
        return;
      }
      if (sf) {
        applySpriteFrame(sprite, sf);
      }
    });
  }

  private _resolveContainer(): void {
    if (!this.tagIconContainer) {
      this.tagIconContainer =
        this.node.getChildByName('TagContainer') ?? this.node;
    }
  }

  private _collectPrefabIcons(): void {
    this._resolveContainer();
    if (this.tagIcons.length > 0) {
      return;
    }

    const hosts = [this.tagIconContainer, this.node].filter(
      (node): node is Node => node !== null,
    );
    const found: Sprite[] = [];
    const seen = new Set<Sprite>();

    for (const host of hosts) {
      for (const child of host.children) {
        if (!child.name.startsWith('TagIcon')) {
          continue;
        }
        const sprite = child.getComponent(Sprite);
        if (sprite && !seen.has(sprite)) {
          seen.add(sprite);
          found.push(sprite);
        }
      }
    }

    found.sort((a, b) => a.node.name.localeCompare(b.node.name));
    this.tagIcons = found;
  }
}
