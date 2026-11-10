import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProjectFolder,
  ProjectFolderId,
  ProjectId,
  ProjectMeta,
  ProjectPrologue,
  ProjectTheme,
  ProjectTree,
} from '../../core/studio/projectTree';
import type {
  Project,
  ProjectMeta as ProjectMetaType,
} from '../../core/studio/projectTree';
import { Workspace } from '../../core/studio/workspace';

function meta(projectId = '12345678'): ProjectMetaType {
  return {
    schemaVersion: 2,
    projectId,
    projectName: '雨若项目',
    author: 'tester',
    createdAt: 1_700_000_000_000,
    completedAt: null,
    theme: { r: 32, g: 96, b: 160 },
    prologue: { title: '序', lines: ['第一行'] },
    worldIds: ['w1'],
  };
}

function project(projectId = '12345678', folderId = 'pf-0001'): Project {
  return { meta: meta(projectId), folderId };
}

describe('R3.6a Workspace schema v2', () => {
  test('ProjectId / ProjectFolderId 格式与显示', () => {
    assert.equal(ProjectId.isValid('12345678'), true);
    assert.equal(ProjectId.isValid('1234 5678'), false);
    assert.equal(ProjectId.format('12345678'), '1234 5678');
    assert.equal(ProjectId.parse('1234 5678'), '12345678');
    assert.equal(ProjectId.parse('12345678'), '12345678');
    assert.equal(ProjectId.parse('1234-5678'), null);

    const digest = 'a3f19c2d00000000000000000000000000000000000000000000000000000000';
    assert.equal(ProjectId.fromDigest(digest).length, 8);
    assert.equal(ProjectId.fromDigest(digest, [ProjectId.fromDigest(digest)]).length, 8);
    assert.notEqual(
      ProjectId.fromDigest(digest),
      ProjectId.fromDigest(digest, [ProjectId.fromDigest(digest)]),
    );

    assert.equal(ProjectFolderId.format('pf-0001'), '0001');
    assert.equal(ProjectFolderId.parse('0001'), 'pf-0001');
    assert.equal(ProjectFolderId.parse('pf-0002'), 'pf-0002');
    assert.equal(ProjectFolderId.next(['pf-0001', 'pf-0003']), 'pf-0002');
  });

  test('ProjectMeta / ProjectFolder / ProjectTheme 校验', () => {
    assert.equal(ProjectMeta.validate(meta()), true);
    assert.equal(ProjectMeta.validate({ ...meta(), schemaVersion: 1 }), false);
    assert.equal(ProjectMeta.validate({ ...meta(), projectName: '' }), false);
    assert.equal(ProjectMeta.validate({ ...meta(), worldIds: ['w1', 'w1'] }), false);
    assert.equal(ProjectTheme.validate({ r: 0, g: 128, b: 255 }), true);
    assert.equal(ProjectTheme.validate({ r: 256, g: 0, b: 0 }), false);
    assert.deepEqual(ProjectTheme.average([
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ]), { r: 128, g: 128, b: 128 });
    assert.deepEqual(ProjectPrologue.empty(), { title: '', lines: [] });

    const folder = ProjectFolder.create('pf-0001', '示例文件夹', ['12345678']);
    assert.equal(ProjectFolder.validate(folder), true);
    assert.equal(ProjectFolder.validate({ ...folder, projectIds: ['bad'] }), false);
  });

  test('ProjectTree 只存 Link，包含关系派生', () => {
    const folders = [ProjectFolder.create('pf-0001', '示例文件夹', ['12345678'])];
    const projects = [project()];
    const tree = ProjectTree.create(folders, projects);
    assert.equal(tree.nodes.length, 2);
    assert.equal(tree.edges.length, 0);
    assert.equal(tree.nodes[0].kind, 'Folder');
    assert.equal(tree.nodes[1].kind, 'Project');

    const link = {
      edgeId: 'link-1',
      fromNodeId: ProjectTree.projectNodeId('12345678'),
      toNodeId: ProjectTree.folderNodeId('pf-0001'),
    };
    const linked = ProjectTree.create(folders, projects, [link]);
    assert.equal(linked.edges.length, 1);
    assert.equal(linked.edges[0].kind, 'Link');
    assert.equal(ProjectTree.validate(linked, folders, projects), true);

    const containment = ProjectTree.deriveContainment(folders, projects);
    assert.equal(containment.length, 1);
    assert.equal(containment[0].kind, 'Contains');
    assert.equal(containment[0].fromNodeId, 'folder:pf-0001');
    assert.equal(containment[0].toNodeId, 'project:12345678');

    assert.throws(() => ProjectTree.create(folders, projects, [{
      edgeId: 'bad',
      fromNodeId: 'folder:pf-0001',
      toNodeId: 'folder:pf-0001',
    }]), /invalid ProjectTree/);
  });

  test('Workspace 聚合与 folder/project 一致性', () => {
    const folders = [ProjectFolder.create('pf-0001', '示例文件夹', ['12345678'])];
    const projects = [project()];
    const workspace = Workspace.create('D:/neurou-workspace', folders, projects);
    assert.equal(Workspace.validate(workspace), true);
    assert.equal(workspace.tree.nodes.length, 2);

    const mismatched: Project = { meta: meta('87654321'), folderId: 'pf-0001' };
    assert.throws(
      () => Workspace.create('D:/neurou-workspace', folders, [mismatched]),
      /invalid Workspace|invalid ProjectTree/,
    );
  });

  test('Workspace.materialize 写 folder + 两个 project 元数据', async () => {
    const files = new Map<string, unknown>();
    const dirs = new Set<string>();
    const target = {
      readJson: async () => null,
      writeJsonAtomic: async (relPath: string, value: unknown) => {
        files.set(relPath, value);
      },
      ensureDir: async (relPath: string) => {
        dirs.add(relPath);
      },
      writeBytes: async () => undefined,
      hashFile: async () => '',
      removeDir: async () => undefined,
    };
    const folders = [ProjectFolder.create('pf-0001', '双项目', ['12345678', '87654321'])];
    const projects = [project('12345678'), project('87654321')];
    await Workspace.materialize(target, 'D:/neurou-workspace', folders, projects);

    assert.equal(files.has('workspace.json'), true);
    assert.equal(files.has('pf-0001/folder.json'), true);
    assert.equal(files.has('pf-0001/12345678/project.json'), true);
    assert.equal(files.has('pf-0001/87654321/project.json'), true);
    assert.equal(dirs.has('pf-0001/12345678/worlds'), true);
    assert.equal(dirs.has('pf-0001/87654321/media'), true);
  });
});
