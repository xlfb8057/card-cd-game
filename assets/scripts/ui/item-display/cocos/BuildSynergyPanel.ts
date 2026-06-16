/**
 * Build 联动展开面板（§7.2 / §14.6）
 */

import {
  _decorator,
  Color,
  Component,
  Label,
  Node,
  Sprite,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
import { IBuildSynergyLine } from '../BuildSynergyAnalyzer';
import { getPopoverBgKey } from '../RarityDisplayUtil';
import { applySpriteFrame, loadSpriteFrame } from './ItemSpriteLoader';

const { ccclass, property } = _decorator;

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 360;

@ccclass('BuildSynergyPanel')
export class BuildSynergyPanel extends Component {
  @property(Node)
  panelNode: Node | null = null;

  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  contentLabel: Label | null = null;

  private _uiReady = false;

  onLoad(): void {
    this.node.active = false;
    this._resolveBindings();
    this._ensureDefaultUi();
    if (this.titleLabel) {
      this.titleLabel.string = '该装备受到以下影响';
    }
  }

  show(lines: IBuildSynergyLine[]): void {
    this._ensureDefaultUi();
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

  private _resolveBindings(): void {
    this.panelNode = this.panelNode ?? this.node.getChildByName('Panel');
    const panel = this.panelNode;
    if (!panel) {
      return;
    }
    this.titleLabel =
      this.titleLabel ??
      panel.getChildByName('TitleLabel')?.getComponent(Label) ??
      null;
    this.contentLabel =
      this.contentLabel ??
      panel.getChildByName('ContentLabel')?.getComponent(Label) ??
      null;
  }

  private _ensureDefaultUi(): void {
    if (this._uiReady && this.panelNode) {
      return;
    }

    if (!this.node.getComponent(UITransform)) {
      this.node.addComponent(UITransform).setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
    }

    if (!this.panelNode) {
      const panel = new Node('Panel');
      panel.setParent(this.node);
      const panelTransform = panel.addComponent(UITransform);
      panelTransform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
      panelTransform.setAnchorPoint(0.5, 0.5);
      panel.addComponent(UIOpacity);
      const panelSprite = panel.addComponent(Sprite);
      panelSprite.type = Sprite.Type.SLICED;
      panelSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      loadSpriteFrame(getPopoverBgKey()).then((sf) => {
        applySpriteFrame(panelSprite, sf);
      });
      this.panelNode = panel;

      const titleNode = new Node('TitleLabel');
      titleNode.setParent(panel);
      titleNode.setPosition(0, PANEL_HEIGHT / 2 - 24, 0);
      titleNode.addComponent(UITransform).setContentSize(PANEL_WIDTH - 24, 28);
      this.titleLabel = titleNode.addComponent(Label);
      this.titleLabel.fontSize = 18;
      this.titleLabel.lineHeight = 24;
      this.titleLabel.color = new Color(255, 235, 120, 255);
      this.titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

      const contentNode = new Node('ContentLabel');
      contentNode.setParent(panel);
      contentNode.setPosition(0, -20, 0);
      const contentTransform = contentNode.addComponent(UITransform);
      contentTransform.setContentSize(PANEL_WIDTH - 24, PANEL_HEIGHT - 64);
      this.contentLabel = contentNode.addComponent(Label);
      this.contentLabel.fontSize = 14;
      this.contentLabel.lineHeight = 20;
      this.contentLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
      this.contentLabel.enableWrapText = true;
      this.contentLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
      this.contentLabel.verticalAlign = Label.VerticalAlign.TOP;
      this.contentLabel.color = new Color(220, 220, 220, 255);
    }

    this._resolveBindings();
    this._uiReady = true;
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
