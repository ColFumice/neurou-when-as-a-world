import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { NodeProjectIo } from '../adapters/node/NodeProjectIo';
import { ProjectStore } from '../core/studio/ProjectStore';
import { createTempProject, cleanupTempProject } from './helpers/temp-dir';

describe('AC4-02 项目目录布局', () => {
  test('create 写入 project/event-tree 与三个目录，open 可读回', async () => {
    const root = await createTempProject();
    try {
      const io = new NodeProjectIo(root);
      const project = {
        schemaVersion: 1 as const,
        projectId: 'p1',
        projectName: 'P',
        createdAt: 1,
        worldIds: ['w1'],
      };
      const store = await ProjectStore.create(io, project);
      const eventTree = { schemaVersion: 1, nodes: [], edges: [], rootNodeId: null };

      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8')),
        project,
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(root, 'event-tree.json'), 'utf8')),
        eventTree,
      );
      for (const dir of ['worlds', 'media', 'drafts']) {
        assert.ok((await fs.stat(path.join(root, dir))).isDirectory());
      }

      const opened = await ProjectStore.open(io);
      assert.deepEqual(opened.getProject(), project);
      assert.deepEqual(opened.getEventTree(), eventTree);
      assert.deepEqual(store.getEventTree(), eventTree);
    } finally {
      await cleanupTempProject(root);
    }
  });
});
