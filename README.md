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
│   ├── systems/        战斗、商店、经济、救场
│   ├── ui/             BattleSceneView、ShopSceneView
│   └── platform/       微信适配（WeChatBridge、SafeArea、分包）
├── resources/config/   items / heroes / enemies
└── subpackages/
    └── later-assets/   后期资源分包（音效/特效占位）
build-templates/wechatgame/   微信 game.json / project.config.json 模板
tools/check-wechat-bundle-size.mjs   首包大小检查
Doc-BUILD/                    构建检查清单
```

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

## 仓库

https://github.com/xlfb8057/card-cd-game
