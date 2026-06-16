import { calcStarValue } from '../../../assets/scripts/utils/StarCalculator';
import { getBaseStarValue } from '../../../assets/scripts/ui/item-display/ItemValueCalculator';
import { formatDisplayNumber } from '../../../assets/scripts/ui/item-display/RarityDisplayUtil';
import { assert, TestContext, TestSuite } from '../test-utils';

export const starValuesSuite: TestSuite = {
  id: 'star-values',
  name: '升星数值与展示格式化',
  run(ctx: TestContext): void {
    const star2 = calcStarValue(10, 0.5, 2);
    assert(star2 === 15, `calcStarValue(10, 0.5, 2) = ${star2}`);

    const spike = ctx.configTable.getItem('spike_trap');
    assert(!!spike, 'spike_trap 存在');

    for (const effect of spike!.effects) {
      for (let star = 1; star <= 3; star++) {
        const expected = formatDisplayNumber(
          calcStarValue(effect.value, effect.starScale, star),
        );
        const computed = formatDisplayNumber(getBaseStarValue(effect, star));
        assert(
          expected === computed,
          `${spike!.id} ${effect.type} ${star}星 = ${computed}`,
        );
      }
    }
  },
};
