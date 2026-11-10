import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventTreeBuilder } from '../../core/eventgraph/EventTree';
import type { EventTreeDocument } from '../../core/eventgraph/EventTree';
import { WorldKind } from '../../core/world/types';

const primary = { worldId: 'w-primary', kind: WorldKind.Primary };
const secondary = { worldId: 'w-secondary', kind: WorldKind.Secondary };
const allWorlds = [primary, secondary];
const allWorldIds = allWorlds.map((world) => world.worldId);

function addPair(builder: EventTreeBuilder): void {
  builder.addNode({ nodeId: 'a', worldId: 'w-primary', position: { x: 0, y: 0 } });
  builder.addNode({ nodeId: 'b', worldId: 'w-secondary', position: { x: 100, y: 0 } });
}

describe('R3.2 EventTreeBuilder', () => {
  test('2 节点成环返回 cycle', () => {
    const builder = new EventTreeBuilder();
    addPair(builder);
    builder.addEdge('a', 'b');
    builder.addEdge('b', 'a');
    builder.setRoot('a');

    const diagnostics = builder.validate(allWorldIds, allWorlds);
    const cycle = diagnostics.find((item) => item.code === 'cycle');
    assert.ok(cycle);
    assert.deepEqual(cycle.nodeIds, ['a', 'b']);
  });

  test('3 节点成环返回 cycle', () => {
    const builder = new EventTreeBuilder();
    builder.addNode({ nodeId: 'a', worldId: 'w-primary' });
    builder.addNode({ nodeId: 'b', worldId: 'w-secondary' });
    builder.addNode({ nodeId: 'c', worldId: 'w-secondary' });
    builder.addEdge('a', 'b');
    builder.addEdge('b', 'c');
    builder.addEdge('c', 'a');
    builder.setRoot('a');

    const diagnostics = builder.validate(allWorldIds, allWorlds);
    assert.ok(diagnostics.some((item) => item.code === 'cycle'));
  });

  test('自环返回 self-loop 与 cycle', () => {
    const builder = new EventTreeBuilder();
    addPair(builder);
    builder.addEdge('a', 'a');
    builder.setRoot('a');

    const diagnostics = builder.validate(allWorldIds, allWorlds);
    assert.ok(diagnostics.some((item) => item.code === 'self-loop'));
    assert.ok(diagnostics.some((item) => item.code === 'cycle'));
  });

  test('0 根 / 2 根 / 正确 1 根', () => {
    const empty = new EventTreeBuilder();
    assert.ok(empty.validate([], []).some((item) => item.code === 'no-root'));

    const twoRoots = new EventTreeBuilder();
    addPair(twoRoots);
    twoRoots.setRoot('a');
    assert.ok(twoRoots.validate(allWorldIds, allWorlds).some((item) => item.code === 'multi-root'));

    const oneRoot = new EventTreeBuilder();
    addPair(oneRoot);
    oneRoot.addEdge('a', 'b');
    oneRoot.setRoot('a');
    assert.deepEqual(oneRoot.validate(allWorldIds, allWorlds), []);
  });

  test('Primary 唯一性与 root 指向', () => {
    const zeroPrimary = new EventTreeBuilder();
    addPair(zeroPrimary);
    zeroPrimary.addEdge('a', 'b');
    zeroPrimary.setRoot('a');
    assert.ok(
      zeroPrimary.validate(allWorldIds, [secondary])
        .some((item) => item.code === 'primary-count'),
    );

    const twoPrimary = new EventTreeBuilder();
    addPair(twoPrimary);
    twoPrimary.addEdge('a', 'b');
    twoPrimary.setRoot('a');
    assert.ok(
      twoPrimary.validate(allWorldIds, [primary, { worldId: 'w-other', kind: WorldKind.Primary }])
        .some((item) => item.code === 'primary-count'),
    );

    const mismatch = new EventTreeBuilder();
    mismatch.addNode({ nodeId: 'root', worldId: 'w-secondary' });
    mismatch.addNode({ nodeId: 'child', worldId: 'w-primary' });
    mismatch.addEdge('root', 'child');
    mismatch.setRoot('root');
    assert.ok(
      mismatch.validate(allWorldIds, allWorlds)
        .some((item) => item.code === 'primary-root-mismatch'),
    );
  });

  test('orphan 只标记，不级联删除节点/边', () => {
    const builder = new EventTreeBuilder();
    addPair(builder);
    builder.addEdge('a', 'b');
    builder.setRoot('a');

    builder.markOrphans(['w-primary']);
    const dag = builder.build();
    assert.equal(dag.nodes.length, 2);
    assert.equal(dag.edges.length, 1);
    const orphan = dag.nodes.find((node) => node.nodeId === 'b');
    assert.ok(orphan);
    assert.equal(orphan.orphan, true);

    builder.markOrphans(allWorldIds);
    const restored = builder.build();
    assert.equal(restored.nodes.find((node) => node.nodeId === 'b')?.orphan, false);
  });

  test('不可达节点给 WARN', () => {
    const builder = new EventTreeBuilder();
    builder.addNode({ nodeId: 'a', worldId: 'w-primary', position: { x: 0, y: 0 } });
    builder.addNode({ nodeId: 'b', worldId: 'w-secondary', position: { x: 100, y: 0 } });
    builder.addNode({ nodeId: 'c', worldId: 'w-secondary', position: { x: 0, y: 100 } });
    builder.addNode({ nodeId: 'd', worldId: 'w-secondary', position: { x: 100, y: 100 } });
    builder.addEdge('a', 'b');
    builder.addEdge('c', 'd');
    builder.setRoot('a');

    const diagnostics = builder.validate(allWorldIds, allWorlds);
    const unreachable = diagnostics.find((item) => item.code === 'unreachable');
    assert.ok(unreachable);
    assert.equal(unreachable.severity, 'WARN');
    assert.deepEqual(unreachable.nodeIds, ['c', 'd']);
  });

  test('重复 ID、缺失端点与 root 非源节点', () => {
    const base = { position: { x: 0, y: 0 }, orphan: false };
    const duplicateDoc: EventTreeDocument = {
      schemaVersion: 1,
      nodes: [
        { nodeId: 'a', worldId: 'w-primary', ...base },
        { nodeId: 'a', worldId: 'w-secondary', ...base },
      ],
      edges: [],
      rootNodeId: 'a',
    };
    assert.ok(
      new EventTreeBuilder(duplicateDoc).validate(allWorldIds, allWorlds)
        .some((item) => item.code === 'duplicate-node-id'),
    );

    const missingDoc: EventTreeDocument = {
      schemaVersion: 1,
      nodes: [{ nodeId: 'a', worldId: 'w-primary', ...base }],
      edges: [{ edgeId: 'edge-1', fromNodeId: 'a', toNodeId: 'missing' }],
      rootNodeId: 'a',
    };
    assert.ok(
      new EventTreeBuilder(missingDoc).validate(allWorldIds, allWorlds)
        .some((item) => item.code === 'missing-edge-endpoint'),
    );

    const duplicateEdgeDoc: EventTreeDocument = {
      schemaVersion: 1,
      nodes: [
        { nodeId: 'a', worldId: 'w-primary', ...base },
        { nodeId: 'b', worldId: 'w-secondary', ...base },
      ],
      edges: [
        { edgeId: 'edge-1', fromNodeId: 'a', toNodeId: 'b' },
        { edgeId: 'edge-1', fromNodeId: 'b', toNodeId: 'a' },
      ],
      rootNodeId: 'a',
    };
    assert.ok(
      new EventTreeBuilder(duplicateEdgeDoc).validate(allWorldIds, allWorlds)
        .some((item) => item.code === 'duplicate-edge-id'),
    );

    const builder = new EventTreeBuilder();
    addPair(builder);
    builder.addEdge('a', 'b');
    builder.setRoot('b');
    assert.ok(
      builder.validate(allWorldIds, allWorlds).some((item) => item.code === 'root-not-source'),
    );
  });
});
