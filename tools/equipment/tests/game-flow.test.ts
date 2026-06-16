import { GameApp } from '../../../assets/scripts/core/GameApp';
import { MAX_ROUND } from '../../../assets/scripts/config/RoundConfig';
import { buildItemContext } from '../../../assets/scripts/ui/item-display/ItemDisplayContextFactory';
import { itemDisplayPresenter } from '../../../assets/scripts/ui/item-display/ItemDisplayPresenter';
import { assert, TestContext, TestSuite } from '../test-utils';

export const gameFlowSuite: TestSuite = {
  id: 'game-flow',
  name: 'GameApp 通关状态与展示依赖注入',
  async run(ctx: TestContext): Promise<void> {
    const app = new GameApp(ctx.configLoader, true);
    await app.initialize();
    assert(app.selectHero('jules'), '选择朱尔斯');
    app.startNewGame();

    assert(app.getScene() === 'battle', '新游戏初始场景=battle');
    assert(!app.isGameComplete(), '新游戏未通关');

    app.debugJumpToRound(MAX_ROUND);
    assert(app.getScene() === 'shop', 'debugJumpToRound 场景=shop');
    assert(
      app.getState().getState().round === MAX_ROUND,
      `debugJumpToRound round=${MAX_ROUND}`,
    );
    assert(!app.isGameComplete(), '第 5 关商店未标记通关');

    const depsRound5 = app.getItemDisplayDeps(3);
    const detailRound5 = itemDisplayPresenter.buildDetail(
      buildItemContext('shop_for_sale', 'venom_heart', depsRound5),
    );
    assert(detailRound5.name === '毒龙之心', 'GameApp deps 可构建详情');

    app.debugSkipToGameComplete();
    assert(app.isGameComplete(), 'debugSkipToGameComplete 标记通关');
    assert(app.getScene() === 'gameover', '通关后 scene=gameover');

    const depsPoison = app.getItemDisplayDeps(8);
    assert(depsPoison.enemyPoisonStacks === 8, 'getItemDisplayDeps 传递 enemyPoisonStacks');
  },
};
