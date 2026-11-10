import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AtomicJsonFile } from '../adapters/node/AtomicJsonFile';
import { createTempProject, cleanupTempProject } from './helpers/temp-dir';

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(target: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
}

type HookName = 'beforeBakWrite' | 'afterBakWrite' | 'beforeRename' | 'afterRename';

describe('AC4-03 JSON 原子写 + .bak 回退', () => {
  test('首次写入不生成 .bak', async () => {
    const root = await createTempProject();
    try {
      const target = path.join(root, 'data.json');
      await new AtomicJsonFile(target).writeJson({ value: 1 });
      assert.equal(await exists(target + '.bak'), false);
    } finally {
      await cleanupTempProject(root);
    }
  });

  test('四种崩溃情形', async () => {
    const root = await createTempProject();
    try {
      const target = path.join(root, 'data.json');
      const cases: Array<{ hook: HookName; expectedTarget: number; expectBak: boolean }> = [
        { hook: 'beforeBakWrite', expectedTarget: 1, expectBak: false },
        { hook: 'afterBakWrite', expectedTarget: 1, expectBak: true },
        { hook: 'beforeRename', expectedTarget: 1, expectBak: true },
        { hook: 'afterRename', expectedTarget: 2, expectBak: true },
      ];

      for (const item of cases) {
        await fs.rm(target, { force: true });
        await fs.rm(target + '.bak', { force: true });
        await new AtomicJsonFile(target).writeJson({ value: 1 });

        const hooks: Partial<Record<HookName, () => void>> = {};
        hooks[item.hook] = () => {
          throw new Error('crash-' + item.hook);
        };

        await assert.rejects(
          new AtomicJsonFile(target, hooks).writeJson({ value: 2 }),
          /crash-/,
        );
        assert.deepEqual(await readJson(target), { value: item.expectedTarget });
        if (item.expectBak) {
          assert.deepEqual(await readJson(target + '.bak'), { value: 1 });
        } else {
          assert.equal(await exists(target + '.bak'), false);
        }
      }
    } finally {
      await cleanupTempProject(root);
    }
  });
});
