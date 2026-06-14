/**
 * 微信胶囊 / 状态栏安全区适配
 * 挂到 Canvas 或 HUD 根节点，自动下移 UI 避免被遮挡
 */

import { _decorator, Component, Node, view, Widget } from 'cc';
import { getMenuButtonRect, getWxSystemInfo, isWxMiniGame } from './WxRuntime';

const { ccclass, property } = _decorator;

/** 编辑器 / 浏览器预览时的顶部留白（像素，设计分辨率坐标） */
const EDITOR_TOP_INSET = 0;

@ccclass('SafeAreaAdapter')
export class SafeAreaAdapter extends Component {
  /** 需要下移的 HUD 根节点（不填则调整本节点） */
  @property(Node)
  hudRoot: Node | null = null;

  /** 额外顶部间距 */
  @property
  extraTopPadding = 8;

  private _applied = false;

  onLoad() {
    this.scheduleOnce(() => this.applySafeArea(), 0);
  }

  applySafeArea(): void {
    if (this._applied) {
      return;
    }

    const topInset = calcWxTopInsetDesignPx(this.extraTopPadding);
    if (topInset <= 0) {
      return;
    }

    const target = this.hudRoot ?? this.node;
    const pos = target.position;
    target.setPosition(pos.x, pos.y - topInset, pos.z);
    this._applied = true;
  }
}

/** 计算微信顶部安全区（设计分辨率像素） */
export function calcWxTopInsetDesignPx(extraPadding = 8): number {
  if (!isWxMiniGame()) {
    return EDITOR_TOP_INSET;
  }

  const sys = getWxSystemInfo();
  const menu = getMenuButtonRect();
  if (!sys || !menu) {
    return EDITOR_TOP_INSET;
  }

  const frameSize = view.getFrameSize();
  const design = view.getDesignResolutionSize();
  if (frameSize.height <= 0 || design.height <= 0) {
    return EDITOR_TOP_INSET;
  }

  const scale = design.height / frameSize.height;
  const safeTopPx = Math.max(menu.bottom, sys.statusBarHeight ?? 0);
  return safeTopPx * scale + extraPadding;
}

/** 为节点添加 Widget 顶部对齐（可选工具） */
export function pinWidgetToSafeTop(node: Node, topOffset = 0): void {
  let widget = node.getComponent(Widget);
  if (!widget) {
    widget = node.addComponent(Widget);
  }
  widget.isAlignTop = true;
  widget.top = topOffset + calcWxTopInsetDesignPx();
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
}
