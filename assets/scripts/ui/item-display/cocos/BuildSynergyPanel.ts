/**
 * Build 联动展开面板（§7.2 / §14.6）
 */

import { _decorator, Component, Label, Node, tween, UIOpacity, Vec3 } from 'cc';
import { IBuildSynergyLine } from '../BuildSynergyAnalyzer';

const { ccclass, property } = _decorator;

@ccclass('BuildSynergyPanel')
export class BuildSynergyPanel extends Component {
  @property(Node)
  panelNode: Node | null = null;

  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  contentLabel: Label | null = null;

  onLoad(): void {
    this.node.active = false;
    if (this.titleLabel) {
      this.titleLabel.string = '该装备受到以下影响';
    }
  }

  show(lines: IBuildSynergyLine[]): void {
    this.node.active = true;
    if (this.contentLabel) {
      if (lines.length === 0) {
        this.contentLabel.string = '当前无额外 Build 影响';
      } else {
        this.contentLabel.string = this._formatGrouped(lines);
      }
    }
    this._playOpen();
  }

  hide(): void {
    if (!this.panelNode) {
      this.node.active = false;
      return;
    }
    const opacity =
      this.panelNode.getComponent(UIOpacity) ??
      this.panelNode.addComponent(UIOpacity);
    tween(opacity)
      .to(0.15, { opacity: 0 })
      .call(() => {
        this.node.active = false;
        opacity.opacity = 255;
      })
      .start();
  }

  isVisible(): boolean {
    return this.node.active;
  }

  private _formatGrouped(lines: IBuildSynergyLine[]): string {
    const sections = new Map<string, IBuildSynergyLine[]>();
    for (const line of lines) {
      const list = sections.get(line.groupLabel) ?? [];
      list.push(line);
      sections.set(line.groupLabel, list);
    }

    const parts: string[] = [];
    for (const [group, groupLines] of sections) {
      parts.push(`【${group}】`);
      for (const l of groupLines) {
        if (l.group === 'base') {
          parts.push(
            `${l.source}：基础 ${l.baseValue}`,
          );
        } else {
          parts.push(
            `${l.source}（${l.effect}）：${l.baseValue} → ${l.effectiveValue}（+${l.delta}）`,
          );
        }
      }
    }
    return parts.join('\n');
  }

  private _playOpen(): void {
    if (!this.panelNode) {
      return;
    }
    const opacity =
      this.panelNode.getComponent(UIOpacity) ??
      this.panelNode.addComponent(UIOpacity);
    opacity.opacity = 0;
    this.panelNode.setPosition(20, 0, 0);
    tween(this.panelNode)
      .to(0.2, { position: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
      .start();
    tween(opacity).to(0.2, { opacity: 255 }).start();
  }
}
