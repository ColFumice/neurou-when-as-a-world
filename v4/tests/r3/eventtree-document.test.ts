import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventTreeBuilder } from '../../core/eventgraph/EventTree';
import type { EventTreeDocument } from '../../core/eventgraph/EventTree';

describe('R3.2 EventTreeDocument', () => {
  test('空文档与 R2 占位同形', () => {
    const document = new EventTreeBuilder().toDocument();
    assert.deepEqual(document, {
      schemaVersion: 1,
      nodes: [],
      edges: [],
      rootNodeId: null,
    });
    assert.equal('updatedAt' in document, false);
  });

  test('toDocument / build 往返一致', () => {
    const builder = new EventTreeBuilder();
    builder.addNode({ nodeId: 'root', worldId: 'w-primary', position: { x: 10, y: 20 } });
    builder.addNode({
      nodeId: 'child',
      worldId: 'w-secondary',
      position: { x: 120, y: 80 },
      entryAnchor: { timelineMs: 500, lateral: 1.5 },
    });
    builder.addEdge('root', 'child');
    builder.setRoot('root');
    builder.markOrphans(['w-primary']);

    const document = builder.toDocument();
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.rootNodeId, 'root');
    assert.equal(document.nodes.length, 2);
    assert.equal(document.edges.length, 1);

    const rebuilt = new EventTreeBuilder(document);
    assert.deepEqual(rebuilt.toDocument(), document);
    assert.deepEqual(rebuilt.build(), {
      nodes: document.nodes,
      edges: document.edges,
      rootNodeId: document.rootNodeId,
    });
  });

  test('schemaVersion 非 1 拒绝构造', () => {
    const invalid = { schemaVersion: 2 } as unknown as EventTreeDocument;
    assert.throws(() => new EventTreeBuilder(invalid), RangeError);
  });
});
