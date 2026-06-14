# card-cd-game

《大巴扎：像素乱斗》MVP — Cocos Creator 3.8 竖屏白盒原型。

## 技术栈

- Cocos Creator 3.8.8
- TypeScript
- 目标平台：微信小游戏（竖屏）

## 项目结构

```
assets/
├── scene/           # Battle.scene / shop.scene
├── scripts/         # 游戏逻辑 + Cocos 视图层
│   ├── core/        # GameApp、配置表、快照
│   ├── systems/     # 战斗、商店、经济、救场
│   └── ui/          # BattleSceneView、ShopSceneView
└── resources/config/  # items / heroes / enemies JSON
```

## 打开方式

1. Cocos Dashboard → 打开本项目目录
2. 启动场景：`assets/scene/Battle.scene`
3. 构建设置中需包含 `Battle` 与 `shop` 两个场景

## 设计分辨率

竖屏 **720 × 1280**，适配宽度（Fit Width）。

## 场景流程

```
Battle（战斗） → 胜利 → shop（商店） → 开始战斗 → Battle（下一回合）
失败 → 重试（回退快照） / 胜利 → 进入商店
```

## 开发说明

- 逻辑层与 Cocos 视图层分离：`GameApp` 不依赖 `cc` 模块
- 跨场景数据：`GameAppHolder` 保留进度
- 战斗视图：`BattleSceneView.ts`
- 商店视图：`ShopSceneView.ts`
