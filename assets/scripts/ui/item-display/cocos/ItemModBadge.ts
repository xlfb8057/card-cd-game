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
    if (!visible) {
      if (this.modLabel?.node) {
        this.modLabel.node.active = false;
      }
      return;
    }

    const label = this.modLabel ?? this.getComponentInChildren(Label);
    if (!label) {
      return;
    }

    label.node.active = true;
    label.string =
      modNames.length > 0 ? `[改装] ${modNames[0]}` : '[改装]';
  }
}
