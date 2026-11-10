import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('AC4-27 逻辑层零引擎', () => {
  test('check-zero-engine 真实运行 exit 0', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'check-zero-engine-v4.cjs')],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.match(result.stdout || '', /汇总: 0 ERROR/);
  });
});
