/**
 * 商店可用性判定（v3）
 */

import { IItemConfig } from '../config/ItemConfig';

/** v3: 商店判定只看 shopAvailable，与 price/rarity 无关 */
export function isShopAvailable(itemConfig: IItemConfig): boolean {
  return itemConfig.shopAvailable === true;
}
