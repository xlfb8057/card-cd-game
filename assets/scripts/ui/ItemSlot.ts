/**
 * 装备格子 UI 视图模型（Legacy 降级路径；战斗/商店优先 v4 ItemCardWidget）
 */

import { IConfigTable } from '../core/ConfigTable';
import { IItemInstance } from '../models/ItemInstance';
import { getRarityColor } from '../utils/RarityUtil';

export interface IItemSlotView {
  position: number;
  isEmpty: boolean;
  name: string;
  cdText: string;
  starText: string;
  borderColor: string;
  /** @deprecated v4 不再使用加速红框，恒为 false */
  isMaxHaste: boolean;
  /** @deprecated v4 使用 CdReadyEffect 粒子，Legacy 不再显示 MAX 角标 */
  showMaxLabel: boolean;
  /** @deprecated 已移除加速红脉冲 */
  pulseRed: boolean;
  scaleAnim: boolean;
  detailText: string;
}

export interface IItemSlotController {
  bindItem(item: IItemInstance | null, position: number): void;
  getView(): IItemSlotView;
  tickAnim(dt: number): void;
  triggerScaleAnim(): void;
  /** @deprecated 无效果，保留接口兼容 */
  setPulseRed(_on: boolean): void;
}

export class ItemSlotController implements IItemSlotController {
  private _item: IItemInstance | null = null;
  private _position = 0;
  private _scaleAnim = false;
  private _scaleAnimTimer = 0;

  constructor(private readonly _configTable: IConfigTable) {}

  bindItem(item: IItemInstance | null, position: number): void {
    this._item = item;
    this._position = position;
  }

  getView(): IItemSlotView {
    if (!this._item) {
      return {
        position: this._position,
        isEmpty: true,
        name: '空',
        cdText: '',
        starText: '',
        borderColor: '#666666',
        isMaxHaste: false,
        showMaxLabel: false,
        pulseRed: false,
        scaleAnim: false,
        detailText: '',
      };
    }

    const config = this._configTable.getItem(this._item.configId);
    const rarity = config?.rarity ?? 'common';
    const cd = this._item.currentCD;

    return {
      position: this._position,
      isEmpty: false,
      name: config?.name ?? this._item.configId,
      cdText: cd.toFixed(1),
      starText: '★'.repeat(this._item.star),
      borderColor: getRarityColor(rarity),
      isMaxHaste: false,
      showMaxLabel: false,
      pulseRed: false,
      scaleAnim: this._scaleAnim,
      detailText: config
        ? config.effects.map((e) => `${e.type}:${e.value}`).join(' | ')
        : '',
    };
  }

  tickAnim(dt: number): void {
    if (this._scaleAnim) {
      this._scaleAnimTimer -= dt;
      if (this._scaleAnimTimer <= 0) {
        this._scaleAnim = false;
      }
    }
  }

  triggerScaleAnim(): void {
    this._scaleAnim = true;
    this._scaleAnimTimer = 0.2;
  }

  setPulseRed(_on: boolean): void {
    // 已移除「加速变红框」外显
  }
}
