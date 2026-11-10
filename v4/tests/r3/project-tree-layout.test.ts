import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFolder, ProjectMeta } from '../../core/studio/projectTree';
import type { Project, ProjectTheme } from '../../core/studio/projectTree';
import { Workspace } from '../../core/studio/workspace';
import { ProjectTreeLayout } from '../../core/presentation/projecttree/ProjectTreeLayout';

function meta(projectId: string, theme: ProjectTheme): Project {
  return {
    folderId: 'pf-0001',
    meta: {
      schemaVersion: 2,
      projectId,
      projectName: projectId,
      author: 'tester',
      createdAt: 1,
      completedAt: null,
      theme,
      prologue: { title: '', lines: [] },
      worldIds: ['w1'],
    },
  };
}

function workspace(): Workspace {
  const projects: Project[] = [
    meta('10000001', { r: 0, g: 0, b: 0 }),
    meta('10000002', { r: 255, g: 255, b: 255 }),
    meta('10000003', { r: 255, g: 0, b: 0 }),
    meta('10000004', { r: 0, g: 255, b: 0 }),
    meta('10000005', { r: 0, g: 0, b: 255 }),
  ];
  const folder = ProjectFolder.create(
    'pf-0001',
    'A Try',
    projects.map((project) => project.meta.projectId),
  );
  return Workspace.create('D:/workspace', [folder], projects);
}

function compute(
  ws: Workspace,
  timeMs: number,
  mouseX = 480,
  mouseY = 270,
  previousCamera?: { panX: number; panY: number; dolly: number },
  worldThemes?: ReadonlyMap<string, readonly ProjectTheme[]>,
  selectedNodeId?: string | null,
  pinnedWander?: { nodeId: string; x: number; y: number } | null,
) {
  return ProjectTreeLayout.compute({
    workspace: ws,
    timeMs,
    width: 960,
    height: 540,
    mouseX,
    mouseY,
    previousCamera,
    worldThemes,
    selectedNodeId,
    pinnedWander,
  });
}

describe('R3.6b ProjectTreeLayout', () => {
  test('RGB→XYZ 边界与近大远小', () => {
    const layout = compute(workspace(), 0);
    const black = layout.nodes.find((node) => node.nodeId === 'project:10000001');
    const white = layout.nodes.find((node) => node.nodeId === 'project:10000002');
    const red = layout.nodes.find((node) => node.nodeId === 'project:10000003');
    const green = layout.nodes.find((node) => node.nodeId === 'project:10000004');
    const blue = layout.nodes.find((node) => node.nodeId === 'project:10000005');
    assert.ok(black && white && red && green && blue);
    for (const node of [black, white, red, green, blue]) {
      assert.equal(Number.isFinite(node.screenX), true);
      assert.equal(Number.isFinite(node.screenY), true);
      assert.ok(node.scale >= 0.55 && node.scale <= 1.5);
    }
    assert.ok(white.scale > black.scale);
    assert.ok(white.depth < black.depth);
    assert.notEqual(red.screenX, green.screenX);
    assert.notEqual(green.screenY, blue.screenY);
  });

  test('Folder 平均色', () => {
    const layout = compute(workspace(), 0);
    const folder = layout.nodes.find((node) => node.nodeId === 'folder:pf-0001');
    assert.ok(folder);
    assert.deepEqual(folder.color, { r: 102, g: 102, b: 102 });
  });

  test('jitter 确定性', () => {
    const first = compute(workspace(), 1200);
    const second = compute(workspace(), 1200);
    assert.deepEqual(first, second);
  });

  test('Catmull-Rom 闭合与单世界圆轨道', () => {
    const ws = workspace();
    const themes = new Map<string, readonly ProjectTheme[]>([
      ['10000001', [{ r: 10, g: 20, b: 30 }, { r: 200, g: 40, b: 60 }]],
      ['10000002', [{ r: 120, g: 120, b: 120 }]],
    ]);
    const early = compute(ws, 0, 480, 270, undefined, themes);
    const later = compute(ws, 4000, 480, 270, undefined, themes);
    const earlyNode = early.nodes.find((node) => node.nodeId === 'project:10000001');
    const laterNode = later.nodes.find((node) => node.nodeId === 'project:10000001');
    assert.ok(earlyNode && laterNode);
    assert.notDeepEqual(
      { x: earlyNode.screenX, y: earlyNode.screenY },
      { x: laterNode.screenX, y: laterNode.screenY },
    );

    const single = compute(ws, 0, 480, 270, undefined, new Map([
      ['10000002', [{ r: 120, g: 120, b: 120 }]],
    ]));
    const singleLater = compute(ws, 4000, 480, 270, undefined, new Map([
      ['10000002', [{ r: 120, g: 120, b: 120 }]],
    ]));
    const singleNode = single.nodes.find((node) => node.nodeId === 'project:10000002');
    const singleLaterNode = singleLater.nodes.find((node) => node.nodeId === 'project:10000002');
    assert.ok(singleNode && singleLaterNode);
    assert.notEqual(singleNode.screenX, singleLaterNode.screenX);
  });

  test('相机 pan 平滑插值', () => {
    const ws = workspace();
    const first = compute(ws, 0, 960, 540);
    const second = compute(ws, 0, 960, 540, first.camera);
    const third = compute(ws, 0, 960, 540, second.camera);
    assert.ok(first.camera.panX > 0);
    assert.ok(second.camera.panX > first.camera.panX);
    assert.ok(third.camera.panX > second.camera.panX);
    assert.ok(third.camera.panX <= 140);
    assert.ok(third.camera.dolly >= 0.7 && third.camera.dolly <= 1.6);
  });

  test('选中节点冻结 wander，相机 pan 归零', () => {
    const ws = workspace();
    const selected = 'project:10000001';
    const early = compute(ws, 0, 960, 540, undefined, undefined, selected, {
      nodeId: selected,
      x: 12,
      y: -7,
    });
    const later = compute(ws, 4000, 960, 540, undefined, undefined, selected, {
      nodeId: selected,
      x: 12,
      y: -7,
    });
    const earlyNode = early.nodes.find((node) => node.nodeId === selected);
    const laterNode = later.nodes.find((node) => node.nodeId === selected);
    assert.ok(earlyNode && laterNode);
    assert.equal(earlyNode.screenX, laterNode.screenX);
    assert.equal(earlyNode.screenY, laterNode.screenY);
    assert.equal(earlyNode.wanderX, 12);
    assert.equal(earlyNode.wanderY, -7);

    const camera = { panX: 140, panY: 90, dolly: 1 };
    const centered = compute(ws, 0, 960, 540, camera, undefined, selected, {
      nodeId: selected,
      x: 12,
      y: -7,
    });
    assert.ok(centered.camera.panX < 140);
    assert.ok(centered.camera.panY < 90);
  });

  test('空 Folder 使用确定性 24px 圆轨道', () => {
    const emptyFolder = ProjectFolder.create('pf-0002', 'Empty', []);
    const ws = Workspace.create('D:/workspace-empty', [emptyFolder], []);
    const layout = compute(ws, 1000);
    const node = layout.nodes.find((item) => item.nodeId === 'folder:pf-0002');
    assert.ok(node);
    assert.ok(Math.abs(Math.hypot(node.wanderX, node.wanderY) - 24) < 0.001);

    const later = compute(ws, 3000);
    const laterNode = later.nodes.find((item) => item.nodeId === 'folder:pf-0002');
    assert.ok(laterNode);
    assert.notEqual(node.screenX, laterNode.screenX);
    assert.notEqual(node.screenY, laterNode.screenY);
  });
});
