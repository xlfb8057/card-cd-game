/**
 * 装备格子 UI 视图模型
 */

import { IConfigTable } from '../core/ConfigTable';
import { IItemInstance } from '../models/ItemInstance';
import { getRarityColor, HASTE_MAX_COLOR } from '../utils/RarityUtil';
import { CD_MIN } from '../utils/MathUtil';

export interface IItemSlotView {
  position: number;
  isEmpty: boolean;
  name: string;
  cdText: string;
  starText: string;
  borderColor: string;
  isMaxHaste: boolean;
  showMaxLabel: boolean;
  pulseRed: boolean;
  scaleAnim: boolean;
  detailText: string;
}

export interface IItemSlotController {
  bindItem(item: IItemInstance | null, position: number): void;
  getView(): IItemSlotView;
  tickAnim(dt: number): void;
  triggerScaleAnim(): void;
  setPulseRed(on: boolean): void;
}

const HASTE_PULSE_THRESHOLD = 0.5;

export class ItemSlotController implements IItemSlotController {
  private _item: IItemInstance | null = null;
  private _position = 0;
  private _scaleAnim = false;
  private _scaleAnimTimer = 0;
  private _pulseRed = false;

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
    const isMaxHaste = cd <= HASTE_PULSE_THRESHOLD && cd > CD_MIN;
    const atFloor = cd <= CD_MIN + 0.01;

    return {
      position: this._position,
      isEmpty: false,
      name: config?.name ?? this._item.configId,
      cdText: cd.toFixed(1),
      starText: '★'.repeat(this._item.star),
      borderColor: atFloor
        ? HASTE_MAX_COLOR
        : isMaxHaste
          ? HASTE_MAX_COLOR
          : getRarityColor(rarity),
      isMaxHaste,
      showMaxLabel: atFloor,
      pulseRed: this._pulseRed || isMaxHaste,
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

  setPulseRed(on: boolean): void {
    this._pulseRed = on;
  }
}
