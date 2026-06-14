/**
 * 从配置创建敌人实例
 */

import { IEnemyConfig } from '../config/EnemyConfig';
import { Enemy, IEnemy } from './Enemy';

/** 根据配置 ID 创建敌人 */
export function createEnemyFromConfig(config: IEnemyConfig): IEnemy {
  return new Enemy({
    configId: config.id,
    name: config.name,
    hp: config.hp,
    attackCD: config.attackCD,
    damage: config.damage,
    timeLimit: config.timeLimit,
  });
}
