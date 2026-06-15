/**
 * 装备标签 → 中文名 + 图标路径
 */

export interface ITagDisplayInfo {
  tagId: string;
  label: string;
  iconPath: string;
}

const TAG_REGISTRY: Record<string, Omit<ITagDisplayInfo, 'tagId'>> = {
  damage: { label: '伤害', iconPath: 'textures/item-display/tags/tag_damage' },
  dot: { label: '持续', iconPath: 'textures/item-display/tags/tag_dot' },
  poison: { label: '中毒', iconPath: 'textures/item-display/tags/tag_poison' },
  burn: { label: '灼烧', iconPath: 'textures/item-display/tags/tag_burn' },
  shield: { label: '护盾', iconPath: 'textures/item-display/tags/tag_shield' },
  heal: { label: '治疗', iconPath: 'textures/item-display/tags/tag_heal' },
  haste: { label: '加速', iconPath: 'textures/item-display/tags/tag_haste' },
  tool: { label: '工具', iconPath: 'textures/item-display/tags/tag_tool' },
  food: { label: '食物', iconPath: 'textures/item-display/tags/tag_food' },
  crit: { label: '暴击', iconPath: 'textures/item-display/tags/tag_crit' },
  scaling: { label: '缩放', iconPath: 'textures/item-display/tags/tag_scaling' },
  control: { label: '控制', iconPath: 'textures/item-display/tags/tag_control' },
  freeze: { label: '冻结', iconPath: 'textures/item-display/tags/tag_freeze' },
};

export function getTagDisplay(tagId: string): ITagDisplayInfo {
  const entry = TAG_REGISTRY[tagId];
  if (entry) {
    return { tagId, ...entry };
  }
  return {
    tagId,
    label: tagId,
    iconPath: `textures/item-display/tags/tag_${tagId}`,
  };
}

export function getTagsDisplay(tagIds: string[]): ITagDisplayInfo[] {
  return tagIds.map(getTagDisplay);
}
