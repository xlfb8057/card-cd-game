/**
 * 标签角标条 — 右下角全部 tags 小图标
 */

import { _decorator, Component, Label, Node } from 'cc';
import { ITagDisplayInfo } from '../ItemTagRegistry';

const { ccclass, property } = _decorator;

@ccclass('TagIconStrip')
export class TagIconStrip extends Component {
  @property(Node)
  container: Node | null = null;

  @property(Label)
  fallbackLabel: Label | null = null;

  apply(tags: ITagDisplayInfo[]): void {
    if (this.fallbackLabel) {
      this.fallbackLabel.string = tags.map((t) => t.label).join(' ');
    }
    this.node.active = tags.length > 0;
  }
}
