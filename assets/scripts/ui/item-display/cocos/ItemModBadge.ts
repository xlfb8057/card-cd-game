/**
 * [改装] 标记
 */

import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ItemModBadge')
export class ItemModBadge extends Component {
  @property(Label)
  modLabel: Label | null = null;

  apply(visible: boolean, modNames: string[] = []): void {
    this.node.active = visible;
    if (!visible || !this.modLabel) {
      return;
    }
    this.modLabel.string =
      modNames.length > 0 ? `[改装] ${modNames[0]}` : '[改装]';
  }
}
