import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Workspace } from '../../core/studio/workspace';
import { ProjectId } from '../../core/studio/projectTree';

interface SourceIo {
  readJson(relPath: string): Promise<unknown>;
  listFiles(relPath: string): Promise<readonly string[]>;
  readBytes(relPath: string): Promise<Uint8Array>;
  hashFile(relPath: string): Promise<string>;
}

interface TargetIo {
  readJson(relPath: string): Promise<unknown>;
  writeJsonAtomic(relPath: string, value: unknown): Promise<void>;
  ensureDir(relPath: string): Promise<void>;
  writeBytes(relPath: string, data: Uint8Array): Promise<void>;
  hashFile(relPath: string): Promise<string>;
  removeDir(relPath: string): Promise<void>;
}

function resolve(root: string, relPath: string): string {
  return path.join(root, ...relPath.split('/').filter(Boolean));
}

async function readJsonAt(root: string, relPath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(resolve(root, relPath), 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function hashAt(root: string, relPath: string): Promise<string> {
  const bytes = await fs.readFile(resolve(root, relPath));
  return createHash('sha256').update(bytes).digest('hex');
}

async function listFilesAt(root: string, relPath: string): Promise<readonly string[]> {
  const directory = resolve(root, relPath);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const child = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...await listFilesAt(root, child));
    } else {
      out.push(child);
    }
  }
  return out;
}

function sourceIo(root: string): SourceIo {
  return {
    readJson: (relPath) => readJsonAt(root, relPath),
    listFiles: (relPath) => listFilesAt(root, relPath),
    readBytes: (relPath) => fs.readFile(resolve(root, relPath)),
    hashFile: (relPath) => hashAt(root, relPath),
  };
}

function targetIo(root: string): TargetIo {
  return {
    readJson: (relPath) => readJsonAt(root, relPath),
    writeJsonAtomic: async (relPath, value) => {
      const target = resolve(root, relPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(value, null, 2), 'utf8');
    },
    ensureDir: async (relPath) => {
      await fs.mkdir(resolve(root, relPath), { recursive: true });
    },
    writeBytes: async (relPath, data) => {
      const target = resolve(root, relPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    },
    hashFile: (relPath) => hashAt(root, relPath),
    removeDir: async (relPath) => {
      await fs.rm(resolve(root, relPath), { recursive: true, force: true });
    },
  };
}

async function writeFixture(root: string): Promise<void> {
  await fs.mkdir(path.join(root, 'worlds/w1'), { recursive: true });
  await fs.mkdir(path.join(root, 'media'), { recursive: true });
  await fs.mkdir(path.join(root, 'drafts'), { recursive: true });
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify({
    schemaVersion: 1,
    projectId: 'legacy-p1',
    projectName: '旧项目',
    createdAt: 1_700_000_000_000,
    worldIds: ['w1'],
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(root, 'event-tree.json'), JSON.stringify({
    schemaVersion: 1,
    nodes: [],
    edges: [],
    rootNodeId: null,
  }), 'utf8');
  await fs.writeFile(path.join(root, 'worlds/w1/world.json'), JSON.stringify({ worldId: 'w1' }), 'utf8');
  await fs.writeFile(path.join(root, 'media/a.bin'), Uint8Array.from([1, 2, 3, 4]));
  await fs.writeFile(path.join(root, 'drafts/note.txt'), 'draft', 'utf8');
}

async function temp(tag: string): Promise<string> {
  return fs.mkdtemp(path.join(process.env.TEMP ?? '.', `neurou-r36-${tag}-`));
}

describe('R3.6a v1 → v2 迁移', () => {
  test('非破坏性复制、v2 元数据、逐文件 hash、可重入', async () => {
    const legacyRoot = await temp('legacy');
    const workspaceRoot = await temp('workspace');
    try {
      await writeFixture(legacyRoot);
      const legacyBytes = await fs.readFile(path.join(legacyRoot, 'project.json'));

      const legacyDigest = createHash('sha256').update('legacy-p1').digest('hex');
      const result = await Workspace.migrateLegacy(
        sourceIo(legacyRoot),
        targetIo(workspaceRoot),
        { legacyDigest, author: 'tester' },
      );

      assert.equal(result.status, 'Migrated');
      if (result.status !== 'Migrated') return;
      assert.equal(result.folderId, 'pf-0001');
      assert.equal(ProjectId.isValid(result.projectId), true);
      assert.equal(result.copiedFiles, 4);

      const projectPath = path.join(workspaceRoot, 'pf-0001', result.projectId);
      const migrated = JSON.parse(
        await fs.readFile(path.join(projectPath, 'project.json'), 'utf8'),
      ) as Record<string, unknown>;
      assert.equal(migrated.schemaVersion, 2);
      assert.equal(migrated.legacyProjectId, 'legacy-p1');
      assert.equal(migrated.author, 'tester');
      assert.deepEqual(migrated.worldIds, ['w1']);
      assert.deepEqual(migrated.prologue, { title: '', lines: [] });

      const manifest = JSON.parse(
        await fs.readFile(path.join(workspaceRoot, 'workspace.json'), 'utf8'),
      ) as {
        schemaVersion: number;
        folders: readonly { folderId: string; projectIds: readonly string[] }[];
        projectIds: readonly string[];
        tree: { nodes: readonly unknown[]; edges: readonly unknown[] };
      };
      assert.equal(manifest.schemaVersion, 2);
      assert.equal(manifest.folders.length, 1);
      assert.equal(manifest.folders[0].folderId, 'pf-0001');
      assert.deepEqual(manifest.folders[0].projectIds, [result.projectId]);
      assert.deepEqual(manifest.projectIds, [result.projectId]);
      assert.equal(manifest.tree.nodes.length, 2);
      assert.equal(manifest.tree.edges.length, 0);
      assert.equal(
        await fs.readFile(path.join(workspaceRoot, 'pf-0001', result.projectId, 'media/a.bin')).then((b) => b[0]),
        1,
      );
      assert.equal(
        await fs.readFile(path.join(legacyRoot, 'project.json')).then((b) => b.equals(legacyBytes)),
        true,
      );

      const again = await Workspace.migrateLegacy(
        sourceIo(legacyRoot),
        targetIo(workspaceRoot),
        { legacyDigest, author: 'tester' },
      );
      assert.equal(again.status, 'AlreadyMigrated');
      if (again.status === 'AlreadyMigrated') {
        assert.equal(again.projectId, result.projectId);
      }
    } finally {
      await fs.rm(legacyRoot, { recursive: true, force: true });
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('复制失败回滚，旧目录不动', async () => {
    const legacyRoot = await temp('legacy-fail');
    const workspaceRoot = await temp('workspace-fail');
    try {
      await writeFixture(legacyRoot);
      const session = targetIo(workspaceRoot);
      const failing: TargetIo = {
        ...session,
        writeBytes: async (relPath, data) => {
          if (relPath.endsWith('media/a.bin')) throw new Error('copy failed');
          await session.writeBytes(relPath, data);
        },
      };
      const legacyDigest = createHash('sha256').update('legacy-p1').digest('hex');
      await assert.rejects(
        Workspace.migrateLegacy(sourceIo(legacyRoot), failing, { legacyDigest }),
        /copy failed/,
      );
      assert.equal(await fs.stat(path.join(workspaceRoot, 'pf-0001')).then(() => true).catch(() => false), false);
      assert.equal(await fs.stat(path.join(legacyRoot, 'project.json')).then(() => true), true);
    } finally {
      await fs.rm(legacyRoot, { recursive: true, force: true });
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
