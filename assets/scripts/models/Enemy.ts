/**
 * 敌人实例数据模型
 * MVP 阶段：仅 HP + 攻击 CD + 伤害
 */

/** 敌人实例接口 */
export interface IEnemy {
  configId: string;
  name: string;
  hp: number;
  maxHP: number;
  attackCD: number;
  currentAttackCD: number;
  damage: number;
  timeLimit?: number;
  elapsedTime: number;
  isAlive(): boolean;
  takeDamage(amount: number): number;
  resetAttackCD(): void;
  tickAttackCD(dt: number): boolean;
}

/** 创建敌人所需参数 */
export interface ICreateEnemyParams {
  configId: string;
  name: string;
  hp: number;
  attackCD: number;
  damage: number;
  timeLimit?: number;
}

/**
 * 敌人运行时实例
 */
export class Enemy implements IEnemy {
  readonly configId: string;
  readonly name: string;
  hp: number;
  readonly maxHP: number;
  readonly attackCD: number;
  currentAttackCD: number;
  readonly damage: number;
  readonly timeLimit?: number;
  elapsedTime: number;

  constructor(params: ICreateEnemyParams) {
    this.configId = params.configId;
    this.name = params.name;
    this.hp = params.hp;
    this.maxHP = params.hp;
    this.attackCD = params.attackCD;
    this.currentAttackCD = params.attackCD;
    this.damage = params.damage;
    this.timeLimit = params.timeLimit;
    this.elapsedTime = 0;
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  /** 受到伤害，返回实际扣血量 */
  takeDamage(amount: number): number {
    const actual = Math.min(amount, this.hp);
    this.hp -= actual;
    return actual;
  }

  resetAttackCD(): void {
    this.currentAttackCD = this.attackCD;
  }

  /**
   * 更新攻击 CD
   * @returns 是否到达攻击时机
   */
  tickAttackCD(dt: number): boolean {
    this.currentAttackCD -= dt;
    return this.currentAttackCD <= 0;
  }
}
