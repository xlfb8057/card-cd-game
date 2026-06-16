import { TestSuite } from './test-utils';
import { configRaritySuite } from './tests/config-rarity.test';
import { starValuesSuite } from './tests/star-values.test';
import { cardVmSuite } from './tests/card-vm.test';
import { detailVmSuite } from './tests/detail-vm.test';
import { cdDisplaySuite } from './tests/cd-display.test';
import { mergeHintSuite } from './tests/merge-hint.test';
import { emptySlotSuite } from './tests/empty-slot.test';
import { modDisplaySuite } from './tests/mod-display.test';
import { synergySuite } from './tests/synergy.test';
import { tagsSuite } from './tests/tags.test';
import { popoverLayoutSuite } from './tests/popover-layout.test';
import { gameFlowSuite } from './tests/game-flow.test';

/** 装备 CLI 测试套件注册表（新增功能时在此追加） */
export const ALL_EQUIPMENT_SUITES: TestSuite[] = [
  configRaritySuite,
  starValuesSuite,
  cardVmSuite,
  detailVmSuite,
  cdDisplaySuite,
  mergeHintSuite,
  emptySlotSuite,
  modDisplaySuite,
  synergySuite,
  tagsSuite,
  popoverLayoutSuite,
  gameFlowSuite,
];

export function resolveSuites(filter?: string): TestSuite[] {
  if (!filter) {
    return ALL_EQUIPMENT_SUITES;
  }
  const matched = ALL_EQUIPMENT_SUITES.filter(
    (s) => s.id === filter || s.id.startsWith(filter),
  );
  if (matched.length === 0) {
    const ids = ALL_EQUIPMENT_SUITES.map((s) => s.id).join(', ');
    throw new Error(`未知测试套件 "${filter}"。可用: ${ids}`);
  }
  return matched;
}
