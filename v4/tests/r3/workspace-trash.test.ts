import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Workspace } from '../../core/studio/workspace';

async function temp(tag: string): Promise<string> {
  return fs.mkdtemp(path.join(process.env.TEMP ?? '.', `neurou-r36-trash-${tag}-`));
}

function resolve(root: string, relPath: string): string {
  return path.join(root, ...relPath.split('/').filter(Boolean));
}

interface TrashIo {
  moveToTrash(relPath: string): Promise<string>;
  restoreFromTrash(trashRelPath: string, relPath: string): Promise<void>;
}

function trashIo(root: string): TrashIo {
  return {
    moveToTrash: async (relPath) => {
      const source = resolve(root, relPath);
      const trashRoot = path.join(root, '.trash');
      await fs.mkdir(trashRoot, { recursive: true });
      const name = `trash-${Date.now()}-${path.basename(source)}`;
      await fs.rename(source, path.join(trashRoot, name));
      return `.trash/${name}`;
    },
    restoreFromTrash: async (trashRelPath, relPath) => {
      const source = resolve(root, trashRelPath);
      const destination = resolve(root, relPath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    },
  };
}

describe('R3.6a workspace trash', () => {
  test('软删除到 .trash 并可撤销恢复', async () => {
    const root = await temp('round');
    try {
      const projectFile = path.join(root, 'pf-0001', '12345678', 'project.json');
      await fs.mkdir(path.dirname(projectFile), { recursive: true });
      await fs.writeFile(projectFile, '{"schemaVersion":2}', 'utf8');

      const io = trashIo(root);
      const trashPath = await Workspace.trash(io, 'pf-0001/12345678');
      assert.equal(trashPath.startsWith('.trash/'), true);
      assert.equal(await fs.stat(projectFile).then(() => true).catch(() => false), false);
      assert.equal(await fs.stat(resolve(root, trashPath)).then(() => true), true);

      await Workspace.restoreTrash(io, trashPath, 'pf-0001/12345678');
      assert.equal(await fs.readFile(projectFile, 'utf8'), '{"schemaVersion":2}');
      assert.equal(await fs.stat(resolve(root, trashPath)).then(() => true).catch(() => false), false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test('拒绝 .trash 自身与父目录逃逸', async () => {
    const root = await temp('reject');
    try {
      const io = trashIo(root);
      await assert.rejects(Workspace.trash(io, '.trash'), /safe workspace-relative/);
      await assert.rejects(Workspace.trash(io, '../outside'), /safe workspace-relative/);
      await assert.rejects(
        Workspace.restoreTrash(io, 'outside/trash', 'pf-0001/12345678'),
        /under .trash/,
      );
      await assert.rejects(
        Workspace.restoreTrash(io, '.trash/trash-1', '../outside'),
        /safe workspace-relative/,
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
