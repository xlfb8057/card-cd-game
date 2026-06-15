/**
 * 标签 Buff 系统（v3: buff_multiplier）
 * 例：盛宴装备 → 全场 food 效果 ×1.5，持续 15 秒
 */

import { EffectTarget } from '../config/ItemConfig';

export interface ITagBuff {
  id: string;
  tags: string[];
  multiplier: number;
  remaining: number;
}

export interface IBuffSystem {
  addTagBuff(target: EffectTarget, multiplier: number, duration: number): void;
  getTagMultiplier(itemTags: string[]): number;
  update(dt: number): void;
  clearAll(): void;
  getActiveBuffs(): Readonly<ITagBuff[]>;
}

const TARGET_TAG_MAP: Partial<Record<EffectTarget, string>> = {
  all_food: 'food',
  all_tools: 'tool',
  all_dot: 'dot',
  all_damage: 'damage',
  all_shield: 'shield',
  all_heal: 'heal',
};

let _buffId = 0;

export class BuffSystem implements IBuffSystem {
  private readonly _buffs: ITagBuff[] = [];

  addTagBuff(target: EffectTarget, multiplier: number, duration: number): void {
    const tag = TARGET_TAG_MAP[target];
    if (!tag || duration <= 0 || multiplier <= 0) {
      return;
    }

    this._buffs.push({
      id: `buff_${++_buffId}`,
      tags: [tag],
      multiplier,
      remaining: duration,
    });
  }

  getTagMultiplier(itemTags: string[]): number {
    let mult = 1;
    for (const buff of this._buffs) {
      if (buff.tags.some((t) => itemTags.includes(t))) {
        mult *= buff.multiplier;
      }
    }
    return mult;
  }

  update(dt: number): void {
    for (let i = this._buffs.length - 1; i >= 0; i--) {
      this._buffs[i].remaining -= dt;
      if (this._buffs[i].remaining <= 0) {
        this._buffs.splice(i, 1);
      }
    }
  }

  clearAll(): void {
    this._buffs.length = 0;
  }

  getActiveBuffs(): Readonly<ITagBuff[]> {
    return this._buffs;
  }
}

export function resetBuffIdCounter(): void {
  _buffId = 0;
}
