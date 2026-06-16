import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const emptySlotSuite: TestSuite = {
  id: 'empty-slot',
  name: '空槽位 / 空卡片 ViewModel',
  run(_ctx: TestContext): void {
    const emptySlot = itemDisplayPresenter.buildEmptySlot(2, false);
    assert(emptySlot.slotIndex === 2, '空槽 index=2');
    assert(emptySlot.clickable, '未锁定空槽可点击');
    assert(emptySlot.emptyFrameKey.includes('slot_empty'), '空槽边框');

    const lockedSlot = itemDisplayPresenter.buildEmptySlot(3, true);
    assert(!lockedSlot.clickable, '锁定槽不可点击');

    const emptyCard = itemDisplayPresenter.buildEmptyCard(1, false);
    assert(emptyCard.isEmpty, 'buildEmptyCard isEmpty=true');
    assert(emptyCard.clickable, '空卡片可点击（未锁定）');

    const lockedCard = itemDisplayPresenter.buildEmptyCard(4, true);
    assert(lockedCard.slotLocked, '锁定空卡片 slotLocked=true');
    assert(!lockedCard.showCdOverlay, '空卡片无 CD 层');
  },
};
