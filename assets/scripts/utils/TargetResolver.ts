/**
 * 效果目标解析器（v3）
 */

import { IConfigTable } from '../core/ConfigTable';
import { EffectTarget } from '../config/ItemConfig';
import { IItemInstance } from '../models/ItemInstance';
import { getAdjacentPositions } from '../utils/MathUtil';

export class TargetResolver {
  /**
   * 根据目标类型返回实际装备实例列表（self/enemy 由 EffectResolver 直接处理）
   */
  static resolve(
    target: EffectTarget,
    sourceItem: IItemInstance,
    items: IItemInstance[],
    configTable: IConfigTable,
  ): IItemInstance[] {
    const idx = sourceItem.position;

    const hasTag = (item: IItemInstance, tag: string): boolean => {
      const cfg = configTable.getItem(item.configId);
      return cfg?.tags.includes(tag) ?? false;
    };

    const atPositions = (positions: number[]): IItemInstance[] =>
      items.filter((item) => positions.includes(item.position));

    const adjacent = (): IItemInstance[] =>
      atPositions(getAdjacentPositions(idx));

    switch (target) {
      case 'self':
        return [];
      case 'adjacent':
        return adjacent();
      case 'left':
        return idx > 0 ? atPositions([idx - 1]) : [];
      case 'right':
        return idx < 5 ? atPositions([idx + 1]) : [];
      case 'all_left':
        return items.filter((i) => i.position < idx);
      case 'all_right':
        return items.filter((i) => i.position > idx);
      case 'all_tools':
        return items.filter((i) => hasTag(i, 'tool'));
      case 'all_food':
        return items.filter((i) => hasTag(i, 'food'));
      case 'all_dot':
        return items.filter((i) => hasTag(i, 'dot'));
      case 'all_damage':
        return items.filter((i) => hasTag(i, 'damage'));
      case 'all_shield':
        return items.filter((i) => hasTag(i, 'shield'));
      case 'all_heal':
        return items.filter((i) => hasTag(i, 'heal'));
      case 'adjacent_tools':
        return adjacent().filter((i) => hasTag(i, 'tool'));
      case 'adjacent_food':
        return adjacent().filter((i) => hasTag(i, 'food'));
      case 'adjacent_dot':
        return adjacent().filter((i) => hasTag(i, 'dot'));
      case 'adjacent_damage':
        return adjacent().filter((i) => hasTag(i, 'damage'));
      case 'adjacent_shield':
        return adjacent().filter((i) => hasTag(i, 'shield'));
      case 'adjacent_heal':
        return adjacent().filter((i) => hasTag(i, 'heal'));
      case 'all_self_items':
        return [...items];
      case 'random_tool': {
        const tools = items.filter((i) => hasTag(i, 'tool'));
        return tools.length > 0
          ? [tools[Math.floor(Math.random() * tools.length)]]
          : [];
      }
      case 'random_item':
        return items.length > 0
          ? [items[Math.floor(Math.random() * items.length)]]
          : [];
      default:
        return [];
    }
  }
}
