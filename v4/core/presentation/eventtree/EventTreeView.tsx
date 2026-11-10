import { useState } from 'react';
import type { EventTreeDAG, EventTreeNode } from '../../eventgraph/EventTree';

interface EventTreeViewProps {
  dag: EventTreeDAG;
  onAddNode: () => void;
  onRemoveNode: (nodeId: string) => void;
  onAddEdge: (fromNodeId: string, toNodeId: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onOpenNode?: (nodeId: string, worldId: string) => void;
}

const NODE_WIDTH = 132;
const NODE_HEIGHT = 58;

export function EventTreeView({
  dag,
  onAddNode,
  onRemoveNode,
  onAddEdge,
  onRemoveEdge,
  onOpenNode,
}: EventTreeViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);

  const nodeById = new Map<string, EventTreeNode>(
    dag.nodes.map((node) => [node.nodeId, node]),
  );
  const selectedNode = selectedNodeId === null ? null : nodeById.get(selectedNodeId) ?? null;
  const menuNode = menuNodeId === null ? null : nodeById.get(menuNodeId) ?? null;

  const addEdge = () => {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) return;
    onAddEdge(edgeFrom, edgeTo);
    setEdgeFrom('');
    setEdgeTo('');
  };

  return (
    <section className="event-tree" aria-label="事件树 DAG">
      <div className="event-tree__toolbar">
        <button type="button" onClick={onAddNode}>+ 节点</button>
        <span className="event-tree__hint">连线</span>
        <select
          aria-label="连线起点"
          value={edgeFrom}
          onChange={(event) => setEdgeFrom(event.target.value)}
        >
          <option value="">起点</option>
          {dag.nodes.map((node) => (
            <option key={node.nodeId} value={node.nodeId}>
              {node.nodeId} · {node.worldId}
            </option>
          ))}
        </select>
        <span className="event-tree__arrow">→</span>
        <select
          aria-label="连线终点"
          value={edgeTo}
          onChange={(event) => setEdgeTo(event.target.value)}
        >
          <option value="">终点</option>
          {dag.nodes.map((node) => (
            <option key={node.nodeId} value={node.nodeId}>
              {node.nodeId} · {node.worldId}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addEdge}
          disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo}
        >
          连线
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedNode && onOpenNode) {
              onOpenNode(selectedNode.nodeId, selectedNode.worldId);
            }
          }}
          disabled={!selectedNode || !onOpenNode}
        >
          进入世界
        </button>
        <button
          type="button"
          className="event-tree__danger"
          onClick={() => {
            if (selectedNodeId !== null) {
              onRemoveNode(selectedNodeId);
              setSelectedNodeId(null);
            }
          }}
          disabled={selectedNodeId === null}
        >
          删除选中节点
        </button>
      </div>

      <div
        className="event-tree__canvas"
        onClick={() => setMenuNodeId(null)}
        role="presentation"
      >
        <svg className="event-tree__edges" aria-hidden="true">
          {dag.edges.map((edge) => {
            const from = nodeById.get(edge.fromNodeId);
            const to = nodeById.get(edge.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={edge.edgeId}
                x1={from.position.x + NODE_WIDTH}
                y1={from.position.y + NODE_HEIGHT / 2}
                x2={to.position.x}
                y2={to.position.y + NODE_HEIGHT / 2}
                className="event-tree__edge"
              />
            );
          })}
        </svg>

        {dag.nodes.map((node) => (
          <button
            type="button"
            key={node.nodeId}
            className={[
              'event-tree__node',
              selectedNodeId === node.nodeId ? 'is-selected' : '',
              node.orphan ? 'is-orphan' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: node.position.x, top: node.position.y }}
            title={onOpenNode ? '双击进入世界' : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedNodeId(node.nodeId);
              setMenuNodeId(null);
              if (onOpenNode) onOpenNode(node.nodeId, node.worldId);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenNode?.(node.nodeId, node.worldId);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedNodeId(node.nodeId);
              setMenuNodeId(node.nodeId);
            }}
          >
            <span className="event-tree__node-id">{node.nodeId}</span>
            <span className="event-tree__node-world">{node.worldId}</span>
            {node.orphan ? <span className="event-tree__node-warning">⚠ orphan</span> : null}
          </button>
        ))}

        {dag.nodes.length === 0 ? (
          <p className="event-tree__empty">事件树为空。点击“+ 节点”开始。</p>
        ) : null}

        {menuNode ? (
          <div
            className="event-tree__menu"
            style={{ left: menuNode.position.x + 16, top: menuNode.position.y + 66 }}
          >
            <button
              type="button"
              onClick={() => {
                onRemoveNode(menuNode.nodeId);
                setSelectedNodeId(null);
                setMenuNodeId(null);
              }}
            >
              删除节点
            </button>
          </div>
        ) : null}
      </div>

      <div className="event-tree__edges-list">
        <span className="event-tree__hint">边</span>
        {dag.edges.length === 0 ? <span className="event-tree__empty-inline">无</span> : null}
        {dag.edges.map((edge) => (
          <span className="event-tree__edge-chip" key={edge.edgeId}>
            {edge.fromNodeId} → {edge.toNodeId}
            <button type="button" onClick={() => onRemoveEdge(edge.edgeId)} aria-label="删除边">
              ×
            </button>
          </span>
        ))}
      </div>

      {selectedNode ? (
        <p className="event-tree__selection">
          已选：{selectedNode.nodeId} · {selectedNode.worldId}
        </p>
      ) : null}
    </section>
  );
}
