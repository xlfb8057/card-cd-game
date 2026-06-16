# card-cd-game

《大巴扎：像素乱斗》MVP — Cocos Creator 3.8 竖屏白盒原型（微信小游戏目标平台）。

## 技术栈

- Cocos Creator 3.8.8
- TypeScript
- 微信小游戏（竖屏 720×1280）

## 项目结构

```
assets/
├── scene/              Battle.scene / shop.scene
├── scripts/
│   ├── core/           GameApp、配置、快照
│   ├── systems/        战斗、商店、经济、救场、改装、Buff/DOT（v3）
│   ├── ui/
│   │   ├── item-display/   装备展示 v4（Presenter + Cocos 组件）
│   │   ├── BattleSceneView、ShopSceneView
│   │   └── …
│   └── platform/       微信适配（WeChatBridge、SafeArea、分包）
├── resources/
│   ├── config/         items / heroes / enemies / mods
│   └── textures/
│       ├── item-display/   品质框、标签、Popover 等占位切图
│       └── items/          装备图标占位
└── subpackages/
    └── later-assets/   后期资源分包（音效/特效占位）
build-templates/wechatgame/   微信 game.json / project.config.json 模板
tools/                        验证脚本、切图生成
Doc-BUILD/                    构建检查清单（git）
Docs/                         策划 + 阶段文档（本地，已 gitignore）
.cursorrules.md               AI 编程规范
.cursor/rules/                Cursor alwaysApply 规则入口
```

> **Cursor**：请直接打开 **`NewProject/`** 本目录作为工作区，以便加载 `.cursor/rules/`。

## 本地预览

1. Cocos Dashboard → 打开本项目
2. 启动场景：`assets/scene/Battle.scene`
3. 点击 **预览 ▶**

## 微信小游戏构建（Prompt 7）

详细步骤见：**[Doc-BUILD/微信小游戏构建与发布检查清单.md](Doc-BUILD/微信小游戏构建与发布检查清单.md)**

### 快速步骤

1. **项目 → 构建发布** → 平台选 **微信小游戏**
2. **AppID** 填入你的小程序 ID
3. **Orientation** 选 **Portrait 竖屏**
4. 构建 → 产物在 `build/wechatgame/`
5. 用 **微信开发者工具** 导入 `build/wechatgame`
6. 检查包体：

```bash
npm run check:wechat-size
```

### 装备展示模块（v4）

- **需求**：`Docs/技能/需求第四版/装备前端显示需求_v4.md`
- **进度**：[`Docs/装备前端显示_实现进度_v4.md`](Docs/装备前端显示_实现进度_v4.md)
- **生成占位切图**：`npm run gen:item-display`（输出至 `assets/resources/textures/`）
- **离线验证**：`npm run verify:item-display`
- **启用新 UI**：在 Cocos 中挂接 `ItemDisplayController` + `ItemCardWidget` 预制体（见实现进度文档）

### Canvas 安全区（编辑器操作一次）

在 Battle / shop 场景的 **Canvas** 上添加 **SafeAreaAdapter**，将 **HUD** 节点拖到 **Hud Root**。

## 文档（第一阶段已交付）

| 文档 | 说明 |
|------|------|
| [AI 开发规范](Docs/AI开发规范_第一阶段_v1.0.md) | Cursor/AI 编码约束、架构、绑定清单 |
| [用户手册](Docs/用户手册_第一阶段_v1.0.md) | 预览、玩法、按钮说明 |
| [需求验收](Docs/需求文档_第一阶段验收_v1.0.md) | Prompt 1–7 功能与验收结果 |
| [配置数据说明](Docs/配置数据说明_v1.0.md) | items / heroes / enemies JSON 字段 |
| [CHANGELOG](CHANGELOG.md) | 版本与提交记录 |
| [装备前端 v4 实现进度](Docs/装备前端显示_实现进度_v4.md) | item-display 模块状态与验收 |

## 仓库

https://github.com/xlfb8057/card-cd-game
