/**
 * 救场技能 UI 逻辑层
 * 三按钮状态 + 紧急充能选装备模式
 */

import { IRescueSystem, RescueButtonState } from '../systems/RescueSystem';
import { IItemInstance } from '../models/ItemInstance';
import { IHero } from '../models/Hero';
import { IEventBus } from '../core/EventBus';

/** 按钮视图数据 */
export interface IRescueButtonView {
  id: 'charge' | 'overload' | 'reposition';
  label: string;
  state: RescueButtonState;
  usesLeft: number;
  cooldownSec?: number;
}

/** RescuePanel 对外接口 */
export interface IRescuePanel {
  enterBattle(round: number): void;
  leaveBattle(): void;
  getButtons(round: number): IRescueButtonView[];
  onChargeButtonClick(): void;
  onOverloadButtonClick(hero: IHero): boolean;
  onRepositionButtonClick(): boolean;
  isSelectingChargeTarget(): boolean;
  onItemSlotClick(item: IItemInstance | null): boolean;
  onSwapSlots(posA: number, posB: number): boolean;
}

/**
 * 救场面板控制器
 */
export class RescuePanel implements IRescuePanel {
  private _chargeSelectMode = false;

  constructor(
    private readonly _eventBus: IEventBus,
    private readonly _rescue: IRescueSystem,
  ) {}

  enterBattle(_round: number): void {
    this._chargeSelectMode = false;
    this._rescue.setInBattle(true);
  }

  leaveBattle(): void {
    this._chargeSelectMode = false;
    this._rescue.setInBattle(false);
  }

  getButtons(round: number): IRescueButtonView[] {
    const uses = this._rescue.getUses();
    const cd = this._rescue.getCooldowns();

    return [
      {
        id: 'charge',
        label: '紧急充能',
        state: this._rescue.getChargeButtonState(),
        usesLeft: uses.charge,
        cooldownSec: cd.charge > 0 ? Math.ceil(cd.charge) : undefined,
      },
      {
        id: 'overload',
        label: '手动超载',
        state: this._rescue.getOverloadButtonState(),
        usesLeft: uses.overload,
      },
      {
        id: 'reposition',
        label: '时停调整',
        state: this._rescue.getRepositionButtonState(round),
        usesLeft: uses.reposition,
      },
    ];
  }

  onChargeButtonClick(): void {
    if (this._rescue.getChargeButtonState() !== 'available') {
      return;
    }
    this._chargeSelectMode = true;
    this._eventBus.emit('rescue_select_charge_target', {});
  }

  onOverloadButtonClick(hero: IHero): boolean {
    return this._rescue.useOverload(hero);
  }

  onRepositionButtonClick(): boolean {
    return this._rescue.useReposition();
  }

  isSelectingChargeTarget(): boolean {
    return this._chargeSelectMode;
  }

  onItemSlotClick(item: IItemInstance | null): boolean {
    if (!this._chargeSelectMode || !item) {
      return false;
    }

    const ok = this._rescue.useCharge(item);
    if (ok) {
      this._chargeSelectMode = false;
    }
    return ok;
  }

  onSwapSlots(posA: number, posB: number): boolean {
    if (!this._rescue.isRepositionActive()) {
      return false;
    }
    return this._rescue.tryRepositionSwap(posA, posB);
  }
}
