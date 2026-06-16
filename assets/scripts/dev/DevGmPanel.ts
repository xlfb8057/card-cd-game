/**
 * 开发用 GM 浮动按钮（运行时自动创建，无需在编辑器拼 UI）
 */

import {
  _decorator,
  Button,
  Color,
  Component,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  UITransform,
  Widget,
} from 'cc';
import {
  devGmAddGold,
  devGmGoBattle,
  devGmJumpToRound5Shop,
  devGmSkipToComplete,
  isDevGmEnabled,
  registerDevGmCommands,
} from './DevGmBridge';

const { ccclass } = _decorator;

const GM_ROOT_NAME = 'DevGmRoot';

@ccclass('DevGmPanel')
export class DevGmPanel extends Component {
  onLoad(): void {
    if (!isDevGmEnabled()) {
      return;
    }

    registerDevGmCommands();
    this._buildButtons();
    input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  }

  onEnable(): void {
    this._bringToFront();
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
  }

  private _onKeyDown(event: { keyCode: KeyCode }): void {
    if (event.keyCode === KeyCode.F9) {
      devGmSkipToComplete();
    }
  }

  private _buildButtons(): void {
    if (this.node.getChildByName(GM_ROOT_NAME)) {
      this._bringToFront();
      return;
    }

    const root = new Node(GM_ROOT_NAME);
    root.setParent(this.node);
    root.layer = this.node.layer;

    const rootTransform = root.addComponent(UITransform);
    rootTransform.setContentSize(140, 160);

    const widget = root.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignLeft = true;
    widget.top = 12;
    widget.left = 12;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    this._addGmButton(root, 'GM:直接通关', 0, () => devGmSkipToComplete());
    this._addGmButton(root, 'GM:第5关商店', -36, () => devGmJumpToRound5Shop());
    this._addGmButton(root, 'GM:进战斗', -72, () => devGmGoBattle());
    this._addGmButton(root, 'GM:+999金', -108, () => devGmAddGold());

    this._bringToFront();
  }

  private _bringToFront(): void {
    const root = this.node.getChildByName(GM_ROOT_NAME);
    if (!root?.isValid) {
      return;
    }
    root.active = true;
    root.setSiblingIndex(this.node.children.length - 1);
  }

  private _addGmButton(
    parent: Node,
    text: string,
    y: number,
    handler: () => void,
  ): void {
    const btnNode = new Node(text);
    btnNode.setParent(parent);
    btnNode.setPosition(0, y, 0);

    const transform = btnNode.addComponent(UITransform);
    transform.setContentSize(132, 36);

    const label = btnNode.addComponent(Label);
    label.string = text;
    label.fontSize = 16;
    label.lineHeight = 20;
    label.color = new Color(255, 235, 120, 255);
    label.overflow = Label.Overflow.SHRINK;

    const button = btnNode.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.95;
    btnNode.on(Button.EventType.CLICK, handler, this);
  }
}
