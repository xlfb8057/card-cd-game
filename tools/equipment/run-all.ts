/**
 * 装备功能 CLI 测试入口
 *
 * 用法:
 *   npm run test:equipment              # 全部装备展示测试
 *   npm run test:equipment -- cd-display  # 单个套件
 *   npx tsx tools/equipment/run-all.ts card-vm
 */
import './shim-cc';

import { createTestContext } from './test-utils';
import { resolveSuites } from './registry';

async function main(): Promise<void> {
  const filter = process.argv[2];
  const suites = resolveSuites(filter);

  console.log('\n=== 装备功能 CLI 测试（离线 / 无 Cocos UI）===\n');
  if (filter) {
    console.log(`过滤套件: ${filter}\n`);
  }

  let passed = 0;

  for (const suite of suites) {
    console.log(`--- ${suite.name} [${suite.id}] ---\n`);
    const suiteCtx = await createTestContext();
    await suite.run(suiteCtx);
    passed++;
    console.log('');
  }

  console.log(`=== 全部通过 (${passed}/${suites.length} 套件) ===\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
