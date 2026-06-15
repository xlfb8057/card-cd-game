/**
 * 改装三选一面板（Phase 3 基础骨架）
 */

import { _decorator, Button, Component, Label, Node, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

export interface IModCardViewModel {
  modId: string;
  name: string;
  tierLabel: string;
  description: string;
  locked: boolean;
  lockHint: string;
}

@ccclass('ModSelectPanel')
export class ModSelectPanel extends Component {
  @property(Label)
  titleLabel: Label | null = null;

  @property({ type: [Label] })
  modCardLabels: Label[] = [];

  @property({ type: [Button] })
  modCardButtons: Button[] = [];

  @property(Node)
  panelNode: Node | null = null;

  private _onPick: ((index: number) => void) | null = null;

  onLoad(): void {
    this.node.active = false;
    for (let i = 0; i < this.modCardButtons.length; i++) {
      const idx = i;
      this.modCardButtons[i]?.node.on(Button.EventType.CLICK, () => {
        this._onPick?.(idx);
      });
    }
  }

  setPickHandler(handler: ((index: number) => void) | null): void {
    this._onPick = handler;
  }

  show(itemName: string, star: number, cards: IModCardViewModel[]): void {
    this.node.active = true;
    if (this.titleLabel) {
      this.titleLabel.string = `为 ${itemName} ${'★'.repeat(star)} 选择改装`;
    }
    for (let i = 0; i < this.modCardLabels.length; i++) {
      const card = cards[i];
      const lbl = this.modCardLabels[i];
      const btn = this.modCardButtons[i];
      if (!lbl) {
        continue;
      }
      if (!card) {
        lbl.string = '';
        if (btn) btn.interactable = false;
        continue;
      }
      lbl.string = `[${card.tierLabel}] ${card.name}\n${card.description}`;
      if (btn) {
        btn.interactable = !card.locked;
      }
      if (card.locked) {
        lbl.string += `\n${card.lockHint}`;
      }
    }
    if (this.panelNode) {
      this.panelNode.setPosition(0, -200, 0);
      tween(this.panelNode)
        .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
        .start();
    }
  }

  hide(): void {
    this.node.active = false;
  }
}
