# Changelog

本文件记录《大巴扎：像素乱斗》MVP 仓库的重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [0.4.0] - 2026-06-15

### 新增

- **从头再来**：战斗失败结算面板增加「从头再来」按钮（`restartBtn`）
  - `GameApp.restartFromBeginning()`：清空存档与快照，回到第 1 回合并恢复教学装备
  - `GameSession.clearAllProgress()`：删除磁盘存档与快照
  - `IBattleSettlementView.canRestart`：失败时为 `true`
- **第一阶段文档体系**（`Docs/`）：
  - `AI开发规范_第一阶段_v1.0.md` — AI/Cursor 编码规范与架构说明
  - `用户手册_第一阶段_v1.0.md` — 玩家与测试操作手册
  - `需求文档_第一阶段验收_v1.0.md` — Prompt 1–7 验收清单
  - `配置数据说明_v1.0.md` — items/heroes/enemies JSON 字段说明

### 变更

- `Battle.scene`：绑定 `restartBtn` 至 `BattleSceneView`
- `README.md`：增加文档目录链接

---

## [0.3.0] - 2026-06-14

### 修复

- 核心运行时稳定性（`ac62776`）：
  - 战前快照：`startRound()` 内 `takeRoundSnapshot()`，修复重试无效
  - 商店 HUD：`ShopSceneView` 从 `GameAppHolder` 取状态并在 `onEnable` 刷新
  - 结算文案：`messageLabel` 在结算展示时更新提示
  - `GameBootstrap.ts` 文件名与类名修正

---

## [0.2.0] - 2026-06-14

### 新增

- 微信小游戏打包与竖屏 UI（`52dc757`）：
  - `build-templates/wechatgame/`（`game.json` 竖屏、`project.config.json`）
  - 平台层：`WeChatBridge`、`SafeAreaAdapter`、`SubpackageLoader`、`WxRuntime`
  - 分包占位：`assets/subpackages/later-assets/`
  - 首包检查：`tools/check-wechat-bundle-size.mjs`、`npm run check:wechat-size`
  - 构建文档：`Doc-BUILD/微信小游戏构建与发布检查清单.md`
  - 竖屏场景：`Battle.scene`、`shop.scene` 与 `BattleSceneView` / `ShopSceneView`

---

## [0.1.0] - 2026-06-14

### 新增

- 初始 MVP 提交（`ad03cd4`）：
  - 纯 TS 逻辑层：战斗、CD、经济、商店、背包、英雄、救场、存档、快照
  - 配置：15 装备、3 英雄、5 敌人（`resources/config/`）
  - UI ViewModel：`BattleScene`、`ShopScene`、`ItemSlot`、`BattleLog`、`RescuePanel`
  - Cocos 入口：`GameBootstrap`、`GameAppHolder`
  - 5 回合主线：`RoundConfig`（史莱姆 → BOSS 岩石巨像）

---

## 第一阶段交付摘要

| 里程碑 | 内容 | 提交 |
|--------|------|------|
| Prompt 1–5 | 逻辑层 + 配置 + 测试架构 | ad03cd4 |
| Prompt 6 | Cocos UI 绑定与场景 | 52dc757 |
| Prompt 7 | 微信构建模板与平台适配 | 52dc757 |
| 集成修复 | 快照、商店 HUD、Bootstrap | ac62776 |
| 阶段收尾 | 从头再来 + 文档 + 验收 | 0.4.0 |

**第一阶段范围外（Phase 2）**：升星、改装、角色选择 UI、10 回合、云开发、正式美术音效。
