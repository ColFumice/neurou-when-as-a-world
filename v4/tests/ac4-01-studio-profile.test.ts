import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { StudioProfile } from '../core/studio/types';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

async function readCoreSources(): Promise<string> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  }
  await walk(path.join(REPO_ROOT, 'v4', 'core'));
  const texts = await Promise.all(files.map((file) => fs.readFile(file, 'utf8')));
  return texts.join('\n');
}

describe('AC4-01 单机无账号', () => {
  test('StudioProfile 是单例且默认值固定', async () => {
    assert.equal(StudioProfile.instance, StudioProfile.instance);
    const again = await import('../core/studio/types');
    assert.equal(again.StudioProfile, StudioProfile);
    assert.equal(StudioProfile.instance.displayName, '');
    assert.equal(StudioProfile.instance.interfaceLanguage, 'zh-CN');
    assert.equal(StudioProfile.instance.defaultExportDirectory, '');
  });

  test('core 与 namebook 工具无 Account/Login/Auth，无网络 API', async () => {
    const core = await readCoreSources();
    assert.doesNotMatch(core, /Account|Login|Auth/);
    assert.doesNotMatch(core, /fetch|WebSocket|XMLHttpRequest/);
    const namebookTool = await fs.readFile(
      path.join(REPO_ROOT, 'tools', 'lib', 'namebook-v4.cjs'),
      'utf8',
    );
    assert.doesNotMatch(namebookTool, /Account|Login|Auth/);
  });
});
