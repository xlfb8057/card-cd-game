/**
 * @deprecated 战斗场景已强制 v4 ItemCardWidget 自动生成，勿再清空 Legacy 绑定。
 * 保留此脚本仅打印提示。
 */
console.warn(
  '[skip] fix-battle-scene-legacy-slots.mjs 已废弃。\n' +
    '战斗装备栏由 ItemDisplayController.ensureBattleSlotWidgets() 自动生成 6× ItemCardWidget。\n' +
    '请勿清空 BattleSceneView 的 legacy slot 数组。',
);
