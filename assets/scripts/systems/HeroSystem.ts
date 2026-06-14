/**
 * 角色系统
 * 被动加成、主动技能、CD 修正
 */

import { IEventBus } from '../core/EventBus';
import { IConfigTable } from '../core/ConfigTable';
import { EffectType } from '../config/ItemConfig';
import { IHero, Hero } from '../models/Hero';
import { IItemInstance } from '../models/ItemInstance';
import { calculateRealCD } from '../utils/MathUtil';

/** 主动技能执行上下文（由 BattleSystem 注入） */
export interface IHeroSkillContext {
  getItems(): IItemInstance[];
  triggerItemImmediately(item: IItemInstance): void;
  removeItem(item: IItemInstance): void;
  getPlayerHP(): number;
  setPlayerHP(hp: number): void;
}

/** HeroSystem 对外接口 */
export interface IHeroSystem {
  setHero(hero: IHero): void;
  getHero(): IHero | null;
  resetForBattle(): void;
  update(dt: number): void;
  getEffectMultiplier(
    itemTags: string[],
    effectType: EffectType,
  ): number;
  getModifiedCD(baseCD: number, itemTags: string[]): number;
  activateSkill(context: IHeroSkillContext): boolean;
  getRemainingSkillUses(): number;
  isOverloadActive(): boolean;
  onOverloadEnd(callback: () => void): void;
}

const PASSIVE_FOOD_BOOST = 'food_boost';
const PASSIVE_DOT_BOOST = 'dot_boost';
const PASSIVE_TOOL_CD = 'tool_cd';

const SKILL_TRIGGER_ALL_FOOD = 'trigger_all_food';
const SKILL_ADRENALINE = 'adrenaline';
const SKILL_OVERLOAD = 'overload';

/**
 * 角色系统实现
 */
export class HeroSystem implements IHeroSystem {
  private readonly _eventBus: IEventBus;
  private readonly _configTable: IConfigTable;

  private _hero: IHero | null = null;
  private _skillUsesLeft = 0;
  private _foodBoostTimer = 0;
  private _dotBoostTimer = 0;
  private _overloadTimer = 0;
  private _overloadEndCallback: (() => void) | null = null;

  constructor(eventBus: IEventBus, configTable: IConfigTable) {
    this._eventBus = eventBus;
    this._configTable = configTable;
  }

  setHero(hero: IHero): void {
    this._hero = hero;
    this.resetForBattle();
  }

  getHero(): IHero | null {
    return this._hero;
  }

  resetForBattle(): void {
    if (!this._hero) {
      return;
    }
    this._skillUsesLeft = this._hero.activeSkillConfig.usesPerBattle;
    this._foodBoostTimer = 0;
    this._dotBoostTimer = 0;
    this._overloadTimer = 0;
  }

  update(dt: number): void {
    const wasOverload = this._overloadTimer > 0;

    this._foodBoostTimer = Math.max(0, this._foodBoostTimer - dt);
    this._dotBoostTimer = Math.max(0, this._dotBoostTimer - dt);
    this._overloadTimer = Math.max(0, this._overloadTimer - dt);

    if (wasOverload && this._overloadTimer <= 0 && this._overloadEndCallback) {
      this._overloadEndCallback();
      this._overloadEndCallback = null;
    }
  }

  getEffectMultiplier(
    itemTags: string[],
    effectType: EffectType,
  ): number {
    if (!this._hero) {
      return 1;
    }

    let mult = 1;
    const passive = this._hero.passiveConfig;

    if (passive.type === PASSIVE_FOOD_BOOST && itemTags.includes('food')) {
      if (
        effectType === 'damage' ||
        effectType === 'heal' ||
        effectType === 'shield'
      ) {
        mult *= 1 + passive.value;
      }
    }

    if (passive.type === PASSIVE_DOT_BOOST && effectType === 'dot') {
      mult *= 1 + passive.value;
    }

    if (this._foodBoostTimer > 0 && itemTags.includes('food')) {
      mult *= 2;
    }

    if (this._dotBoostTimer > 0 && effectType === 'dot') {
      mult *= 2;
    }

    return mult;
  }

  getModifiedCD(baseCD: number, itemTags: string[]): number {
    if (!this._hero) {
      return baseCD;
    }

    if (this._overloadTimer > 0 && itemTags.includes('tool')) {
      return 0.5;
    }

    let mod = 1;
    const passive = this._hero.passiveConfig;

    if (passive.type === PASSIVE_TOOL_CD && itemTags.includes('tool')) {
      mod = 1 - passive.value;
    }

    return calculateRealCD(baseCD, 0, mod);
  }

  getRemainingSkillUses(): number {
    return this._skillUsesLeft;
  }

  isOverloadActive(): boolean {
    return this._overloadTimer > 0;
  }

  onOverloadEnd(callback: () => void): void {
    this._overloadEndCallback = callback;
  }

  activateSkill(context: IHeroSkillContext): boolean {
    if (!this._hero || this._skillUsesLeft <= 0) {
      return false;
    }

    const skill = this._hero.activeSkillConfig;
    let success = false;

    switch (skill.effect) {
      case SKILL_TRIGGER_ALL_FOOD:
        success = this._activateJulesFeast(context, skill.duration);
        break;
      case SKILL_ADRENALINE:
        success = this._activateMakAdrenaline(context, skill.duration);
        break;
      case SKILL_OVERLOAD:
        success = this._activateStelleOverload(skill.duration);
        break;
      default:
        break;
    }

    if (success) {
      this._skillUsesLeft--;
      this._eventBus.emit('hero_skill_activated', {
        heroId: this._hero.id,
        skill: skill.name,
        usesLeft: this._skillUsesLeft,
      });
    }

    return success;
  }

  private _activateJulesFeast(
    context: IHeroSkillContext,
    duration: number,
  ): boolean {
    const foodItems = context.getItems().filter((item) => {
      const cfg = this._configTable.getItem(item.configId);
      return cfg?.tags.includes('food');
    });

    for (const item of foodItems) {
      context.triggerItemImmediately(item);
    }

    this._foodBoostTimer = duration;
    return true;
  }

  private _activateMakAdrenaline(
    context: IHeroSkillContext,
    duration: number,
  ): boolean {
    if (!this._hero) {
      return false;
    }

    const selfDamage = Math.floor(this._hero.maxHP * 0.15);
    const currentHP = context.getPlayerHP();
    const newHP = Math.max(1, currentHP - selfDamage);
    context.setPlayerHP(newHP);
    this._hero.currentHP = newHP;

    this._dotBoostTimer = duration;
    this._eventBus.emit('hero_self_damage', {
      heroId: this._hero.id,
      damage: currentHP - newHP,
      hp: newHP,
    });

    return true;
  }

  private _activateStelleOverload(duration: number): boolean {
    this._overloadTimer = duration;
    return true;
  }

  loadHeroById(heroId: string): boolean {
    const config = this._configTable.getHero(heroId);
    if (!config) {
      return false;
    }
    this.setHero(Hero.fromConfig(config));
    return true;
  }
}
