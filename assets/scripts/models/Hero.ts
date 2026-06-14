/**
 * 角色运行时实例
 */

import { IHeroPassive, IHeroActiveSkill } from '../config/HeroConfig';

/** 角色实例接口 */
export interface IHero {
  id: string;
  name: string;
  passiveConfig: IHeroPassive;
  activeSkillConfig: IHeroActiveSkill;
  currentHP: number;
  maxHP: number;
  isAlive(): boolean;
  takeDamage(amount: number): number;
  heal(amount: number): void;
}

/** 创建角色参数 */
export interface ICreateHeroParams {
  id: string;
  name: string;
  passiveConfig: IHeroPassive;
  activeSkillConfig: IHeroActiveSkill;
  maxHP: number;
  currentHP?: number;
}

/**
 * 角色运行时数据
 */
export class Hero implements IHero {
  readonly id: string;
  readonly name: string;
  readonly passiveConfig: IHeroPassive;
  readonly activeSkillConfig: IHeroActiveSkill;
  currentHP: number;
  readonly maxHP: number;

  constructor(params: ICreateHeroParams) {
    this.id = params.id;
    this.name = params.name;
    this.passiveConfig = params.passiveConfig;
    this.activeSkillConfig = params.activeSkillConfig;
    this.maxHP = params.maxHP;
    this.currentHP = params.currentHP ?? params.maxHP;
  }

  isAlive(): boolean {
    return this.currentHP > 0;
  }

  takeDamage(amount: number): number {
    const dealt = Math.min(amount, Math.max(0, this.currentHP - 1));
    this.currentHP = Math.max(1, this.currentHP - amount);
    return dealt;
  }

  heal(amount: number): void {
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
  }

  /** 从配置创建 */
  static fromConfig(config: {
    id: string;
    name: string;
    maxHP: number;
    passive: IHeroPassive;
    activeSkill: IHeroActiveSkill;
  }): Hero {
    return new Hero({
      id: config.id,
      name: config.name,
      maxHP: config.maxHP,
      passiveConfig: config.passive,
      activeSkillConfig: config.activeSkill,
    });
  }
}
