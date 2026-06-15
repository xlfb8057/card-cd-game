# 《大巴扎：像素乱斗》AI 开发规范 — 第一阶段完成版 v1.0

> **适用范围**：第一阶段 MVP（Prompt 1–7）已交付，本文档供 Cursor / AI 辅助后续开发时读取。  
> **仓库**：https://github.com/xlfb8057/card-cd-game  
> **引擎**：Cocos Creator 3.8.8 · TypeScript · 竖屏 720×1280  
> **更新日期**：2026-06-15

---

## 1. 文档定位

| 文档 | 路径 | 用途 |
|------|------|------|
| **本文档** | `Docs/AI开发规范_第一阶段_v1.0.md` | AI 编码约束、架构、目录、扩展规则 |
| **需求验收** | `Docs/需求文档_第一阶段验收_v1.0.md` | 第一阶段功能清单与验收标准 |
| **用户手册** | `Docs/用户手册_第一阶段_v1.0.md` | 玩家/测试人员操作说明 |
| **配置说明** | `Docs/配置数据说明_v1.0.md` | JSON 配置表字段与示例 |
| **构建清单** | `Doc-BUILD/微信小游戏构建与发布检查清单.md` | 微信构建步骤 |
| **变更记录** | `CHANGELOG.md` | 版本与提交说明 |

---

## 2. 第一阶段交付范围（已完成）

### 2.1 逻辑层（纯 TS，禁止 `import 'cc'`）

| 模块 | 路径 | 职责 |
|------|------|------|
| GameApp | `core/GameApp.ts` | 总控：初始化、回合流转、战斗 tick、存档、**从头再来** |
| EventBus | `core/EventBus.ts` | 系统间事件通信 |
| StateManager | `core/StateManager.ts` | 全局单例状态 |
| ConfigTable | `core/ConfigTable.ts` | JSON 配置加载（Cocos / Memory 双模式） |
| SnapshotManager | `core/SnapshotManager.ts` | 战前快照，失败可重试 |
| GameAppHolder | `core/GameAppHolder.ts` | 跨场景持久化 GameApp 实例 |
| BattleSystem | `systems/BattleSystem.ts` | CD 触发、伤害、护盾、加速、胜负 |
| CDSystem | `systems/CDSystem.ts` | 懒更新 CD 追踪 |
| EconomySystem | `systems/EconomySystem.ts` | 金币、工资、连胜/连败 |
| ShopSystem | `systems/ShopSystem.ts` | 商店刷新与购买池 |
| InventorySystem | `systems/InventorySystem.ts` | 6 格装备栏 + 背包 |
| HeroSystem | `systems/HeroSystem.ts` | 3 角色被动/主动 |
| RescueSystem | `systems/RescueSystem.ts` | 救场三技能 |
| SaveManager | `systems/SaveManager.ts` | 本地存档 |
| GameSession | `systems/GameSession.ts` | 会话状态、**clearAllProgress** |
| BattleScene / ShopScene | `ui/*.ts` | ViewModel，不含 Cocos 依赖 |

### 2.2 表现层（Cocos 组件）

| 组件 | 路径 | 职责 |
|------|------|------|
| GameBootstrap | `GameBootstrap.ts` | 创建 GameApp、每帧 tick、wx 存储 |
| BattleSceneView | `ui/BattleSceneView.ts` | 绑定 HUD、槽位、日志、救场、结算、**RestartBtn** |
| ShopSceneView | `ui/ShopSceneView.ts` | 商店卡片、刷新、进入战斗 |
| SafeAreaAdapter | `platform/SafeAreaAdapter.ts` | 竖屏安全区 |
| WeChatBridge | `platform/WeChatBridge.ts` | 微信 API 封装 |

### 2.3 场景与配置

- 场景：`assets/scene/Battle.scene`（启动场景）、`assets/scene/shop.scene`
- 配置：`assets/resources/config/items.json`（15 件）、`heroes.json`（3 人）、`enemies.json`（5 个）
- 微信模板：`build-templates/wechatgame/`

### 2.4 第一阶段**未实现**（禁止 AI 假装已完成）

- 升星系统、改装系统、事件节点、分支路线
- 角色选择界面、背包拖拽装备 UI
- 皮格马利翁 / 凡妮莎
- 10 回合主线（当前 **5 回合**）
- 微信云开发、广告、埋点

---

## 3. 架构原则（强制）

```
View (BattleSceneView / ShopSceneView)
  ↓ 只读 ViewModel
Controller (BattleScene / ShopScene)
  ↓ 调用
Model (GameApp → Systems)
  ↓ 读
Data (ConfigTable + SaveManager)
```

1. **逻辑与 View 分离**：`ui/BattleScene.ts` 等不得 `import 'cc'`；Cocos 绑定只在 `*View.ts`。
2. **事件驱动**：System 间通过 `EventBus`，禁止直接读其他 System 私有字段。
3. **依赖注入**：System 构造函数接收依赖，禁止 `window` / 全局单例（测试用 `StateManager.resetForTest()` 除外）。
4. **配置驱动**：数值来自 JSON，常量集中在 `utils/MathUtil.ts`、`config/RoundConfig.ts`。
5. **接口优先**：公共能力用 `I` 前缀接口（如 `IGameApp`、`IBattleSettlementView`）。
6. **跨场景状态**：`GameAppHolder.set/getGameApp()`，场景切换用 `director.loadScene(SceneNames.xxx)`。

---

## 4. 编码约束

| 规则 | 要求 |
|------|------|
| 单文件行数 | ≤ 500 行（BattleSystem 等核心循环可 ≤ 800） |
| 单函数行数 | ≤ 80 行 |
| 魔法数字 | 禁止；使用 `RoundConfig` / `MathUtil` 常量 |
| update 循环 | 禁止每帧 new 对象；飘字/粒子需对象池（后续补齐） |
| 微信 API | 必须经 `StorageAPI` / `WeChatBridge`，测试用 `MemoryStorageAPI` |
| Cocos @property | 避免 `@property(GameBootstrap)` 等复杂类型，用 `@property(Node)` 再 `getComponent` |
| 测试 | 修改核心逻辑后运行 `npm test`（若项目已配置） |

### 4.1 数值安全线（不可擅自修改）

```typescript
CD_MIN = 0.3              // 装备 CD 硬下限
SHIELD_MAX_RATIO = 2.5    // 护盾上限 = maxHP × 2.5
SLOT_COUNT = 6            // 装备栏格数
BASE_WAGE = 5             // 回合工资
SELL_RATIO = 0.7          // 出售比例
MAX_ROUND = 5             // MVP 主线回合数
CHARGE_COOLDOWN = 10      // 紧急充能全局 CD（秒）
```

### 4.2 命名约定

| 类型 | 格式 | 示例 |
|------|------|------|
| 接口 | `IXxx` | `IBattleSystem` |
| 事件 | snake_case | `battle_end`, `gold_changed` |
| 配置字段 | camelCase | `baseCD`, `heroAffinity` |
| 场景名 | 见 SceneNames | `Battle`, `shop` |

---

## 5. 关键流程（AI 修改时须保持）

### 5.1 单局循环

```
Battle 场景 → startRound() → takeRoundSnapshot() → startBattle()
  → 自动战斗 → 结算
  → 胜利：enterShopBtn → shop 场景 → 购买/刷新 → 下一回合 Battle
  → 失败：retryBtn（恢复快照）或 restartBtn（清空进度从头开始）
  → 第 5 回合 BOSS 胜利 → game_complete
```

### 5.2 快照与重试

- **战前快照**：`BattleScene.startRound()` 内必须先 `takeRoundSnapshot()`，否则 `retryBtn` 无效。
- **重试**：`GameApp.retryCurrentRound()` 恢复快照，保留装备与金币。
- **从头再来**：`GameApp.restartFromBeginning()` → `GameSession.clearAllProgress()`，回到第 1 回合 + 教学装备。

### 5.3 商店进入战斗

- `ShopSceneView` 在 `start()` / `onEnable()` 从 `GameAppHolder` 取 GameApp 并刷新 HUD。
- 默认英雄：`stelle`（在 `GameBootstrap` 硬编码，第二阶段改角色选择）。

---

## 6. Cocos 编辑器绑定清单

### BattleSceneView（Canvas 组件）

| 属性 | 说明 |
|------|------|
| bootstrapNode | 挂 GameBootstrap 的节点 |
| playerHpLabel / enemyHpLabel / roundLabel / goldLabel | HUD 文本 |
| playerHpFill / enemyHpFill | HP 条 fill 节点 |
| slotNodes[6] / slotCdLabels[6] / slotNameLabels[6] | 装备槽 |
| logScrollView / logContent | 战斗日志 |
| chargeBtn / overloadBtn / repositionBtn | 救场技能 |
| settlementPanel / resultLabel / messageLabel | 结算 |
| enterShopBtn / retryBtn / **restartBtn** | 胜利进商店 / 失败重试 / 失败从头再来 |

### ShopSceneView

| 属性 | 说明 |
|------|------|
| bootstrapNode | GameBootstrap 节点 |
| shopItemNodes[6]、refreshBtn、startBattleBtn | 商店 UI |

---

## 7. AI 开发工作流

```
1. 阅读 需求文档_第一阶段验收 + 配置数据说明
2. 确认改动不在「未实现」列表，或先更新需求文档
3. 逻辑改 ui/*.ts 或 systems/*；表现改 *View.ts
4. 配置变更同步 items/heroes/enemies.json + ItemConfig 类型
5. npm test（如有）+ Cocos 预览 + 微信开发者工具抽测
6. 更新 CHANGELOG.md
```

### 7.1 常见陷阱

| 现象 | 原因 | 修复 |
|------|------|------|
| Retry 无反应 | 未 takeRoundSnapshot | startRound 开头补快照 |
| 商店金币显示默认 | GameApp 未就绪 | onEnable 从 Holder 取 app |
| EPERM / 绑定失败 | @property 复杂类型 | 改为 Node + getComponent |
| 加速死循环 | 缺 CD_MIN | MathUtil.calculateRealCD |
| wx 测试报错 | 直接调 wx | 走 StorageAPI 抽象 |

---

## 8. 第二阶段扩展入口（预留）

| 功能 | 建议入口文件 |
|------|-------------|
| 升星 | `InventorySystem` + `ItemInstance.star` |
| 改装 | 新 `ModificationSystem` + `mods.json` |
| 角色选择 | 新场景 `HeroSelect.scene` + GameBootstrap 参数化 heroId |
| 10 回合 | `RoundConfig.ts` MAX_ROUND + enemies.json |
| 云存档 | `SaveManager` + 云函数 |

---

*文档版本：v1.0 · 第一阶段 MVP 交付 · 2026-06-15*
