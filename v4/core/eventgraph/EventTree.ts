import type { WorldKind } from '../world/types';

/**
 * G · eventgraph — 事件树数据层（R3.2）。
 *
 * 事件树节点只存 worldId；WorldInstance 由 W 持有，不嵌入这里。
 * 本文件只做 DAG 数据与校验；EventGraph 运行时（AC4-20~22）留 R4。
 */

export interface EventTreeNode {
  readonly nodeId: string;
  readonly worldId: string;
  readonly position: { readonly x: number; readonly y: number };
  orphan: boolean;
  readonly entryAnchor?: { readonly timelineMs: number; readonly lateral: number };
}

export interface EventTreeEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

export interface EventTreeDAG {
  readonly nodes: readonly EventTreeNode[];
  readonly edges: readonly EventTreeEdge[];
  readonly rootNodeId: string | null;
}

export interface EventTreeDocument {
  readonly schemaVersion: 1;
  readonly nodes: readonly EventTreeNode[];
  readonly edges: readonly EventTreeEdge[];
  readonly rootNodeId: string | null;
}

/** 内部诊断；不导出，避免引入 A 类外的公开名字。 */
interface Diagnostic {
  readonly severity: 'ERROR' | 'WARN';
  readonly code: string;
  readonly message: string;
  readonly nodeIds?: readonly string[];
  readonly edgeIds?: readonly string[];
}

/** addNode 的输入；不导出，调用方按结构传对象即可。 */
interface EventTreeNodeInput {
  nodeId: string;
  worldId: string;
  position?: { x: number; y: number };
  orphan?: boolean;
  entryAnchor?: { timelineMs: number; lateral: number };
}

function cloneNode(node: EventTreeNode): EventTreeNode {
  return {
    nodeId: node.nodeId,
    worldId: node.worldId,
    position: { x: node.position.x, y: node.position.y },
    orphan: node.orphan,
    ...(node.entryAnchor
      ? { entryAnchor: { timelineMs: node.entryAnchor.timelineMs, lateral: node.entryAnchor.lateral } }
      : {}),
  };
}

function cloneEdge(edge: EventTreeEdge): EventTreeEdge {
  return { edgeId: edge.edgeId, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId };
}

export class EventTreeBuilder {
  private nodes: EventTreeNode[];
  private edges: EventTreeEdge[];
  private rootNodeId: string | null;
  private nextEdgeNumber = 1;

  constructor(documentInput?: EventTreeDocument) {
    if (documentInput !== undefined && documentInput.schemaVersion !== 1) {
      throw new RangeError(`unsupported event-tree schemaVersion: ${String(documentInput.schemaVersion)}`);
    }
    this.nodes = documentInput ? documentInput.nodes.map(cloneNode) : [];
    this.edges = documentInput ? documentInput.edges.map(cloneEdge) : [];
    this.rootNodeId = documentInput ? documentInput.rootNodeId : null;
    this.refreshEdgeCounter();
  }

  addNode(input: EventTreeNodeInput): EventTreeNode {
    if (input.nodeId.length === 0) throw new Error('nodeId must not be empty');
    if (input.worldId.length === 0) throw new Error('worldId must not be empty');
    if (this.nodes.some((node) => node.nodeId === input.nodeId)) {
      throw new Error(`duplicate nodeId: ${input.nodeId}`);
    }

    const node: EventTreeNode = {
      nodeId: input.nodeId,
      worldId: input.worldId,
      position: input.position
        ? { x: input.position.x, y: input.position.y }
        : { x: 0, y: 0 },
      orphan: input.orphan ?? false,
      ...(input.entryAnchor
        ? { entryAnchor: { timelineMs: input.entryAnchor.timelineMs, lateral: input.entryAnchor.lateral } }
        : {}),
    };
    this.nodes.push(node);
    return cloneNode(node);
  }

  removeNode(nodeId: string): boolean {
    const index = this.nodes.findIndex((node) => node.nodeId === nodeId);
    if (index < 0) return false;
    this.nodes.splice(index, 1);
    this.edges = this.edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
    );
    if (this.rootNodeId === nodeId) this.rootNodeId = null;
    return true;
  }

  addEdge(fromNodeId: string, toNodeId: string): EventTreeEdge {
    if (fromNodeId.length === 0 || toNodeId.length === 0) {
      throw new Error('edge endpoints must not be empty');
    }
    let edgeId = '';
    do {
      edgeId = `edge-${this.nextEdgeNumber}`;
      this.nextEdgeNumber += 1;
    } while (this.edges.some((edge) => edge.edgeId === edgeId));

    const edge: EventTreeEdge = { edgeId, fromNodeId, toNodeId };
    this.edges.push(edge);
    return cloneEdge(edge);
  }

  removeEdge(edgeId: string): boolean {
    const index = this.edges.findIndex((edge) => edge.edgeId === edgeId);
    if (index < 0) return false;
    this.edges.splice(index, 1);
    return true;
  }

  setRoot(nodeId: string | null): void {
    this.rootNodeId = nodeId;
  }

  markOrphans(existingWorldIds: readonly string[]): void {
    const existing = new Set(existingWorldIds);
    for (const node of this.nodes) {
      node.orphan = !existing.has(node.worldId);
    }
  }

  validate(
    existingWorldIds: readonly string[],
    worlds: readonly { worldId: string; kind: WorldKind }[],
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const nodeById = new Map<string, EventTreeNode>();
    const knownWorlds = new Set(existingWorldIds);

    for (const node of this.nodes) {
      if (nodeIds.has(node.nodeId)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'duplicate-node-id',
          message: `重复节点 ID：${node.nodeId}`,
          nodeIds: [node.nodeId],
        });
        continue;
      }
      nodeIds.add(node.nodeId);
      nodeById.set(node.nodeId, node);
      if (!knownWorlds.has(node.worldId) && !node.orphan) {
        diagnostics.push({
          severity: 'WARN',
          code: 'orphan-missing',
          message: `节点 ${node.nodeId} 的世界 ${node.worldId} 不存在，但未标 orphan`,
          nodeIds: [node.nodeId],
        });
      }
    }

    const adjacency = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    for (const node of this.nodes) {
      adjacency.set(node.nodeId, []);
      indegree.set(node.nodeId, 0);
    }

    for (const edge of this.edges) {
      if (edgeIds.has(edge.edgeId)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'duplicate-edge-id',
          message: `重复边 ID：${edge.edgeId}`,
          edgeIds: [edge.edgeId],
        });
      } else {
        edgeIds.add(edge.edgeId);
      }

      const fromExists = nodeById.has(edge.fromNodeId);
      const toExists = nodeById.has(edge.toNodeId);
      if (!fromExists || !toExists) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'missing-edge-endpoint',
          message: `边 ${edge.edgeId} 端点不存在：${edge.fromNodeId} → ${edge.toNodeId}`,
          edgeIds: [edge.edgeId],
        });
        continue;
      }
      if (edge.fromNodeId === edge.toNodeId) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'self-loop',
          message: `边 ${edge.edgeId} 是自环：${edge.fromNodeId}`,
          edgeIds: [edge.edgeId],
          nodeIds: [edge.fromNodeId],
        });
      }
      adjacency.get(edge.fromNodeId)!.push(edge.toNodeId);
      indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1);
    }

    const cycle = this.findCycle(adjacency, nodeById);
    if (cycle !== null) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'cycle',
        message: `事件树存在环：${cycle.join(' → ')}`,
        nodeIds: cycle,
      });
    }

    const roots = this.nodes
      .filter((node) => (indegree.get(node.nodeId) ?? 0) === 0)
      .map((node) => node.nodeId);

    if (this.nodes.length === 0 || roots.length === 0) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'no-root',
        message: '事件树没有入度为 0 的根节点',
      });
    } else if (roots.length > 1) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'multi-root',
        message: `事件树有多个根节点：${roots.join(', ')}`,
        nodeIds: roots,
      });
    }

    if (this.rootNodeId === null) {
      if (this.nodes.length > 0) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'root-missing',
          message: 'rootNodeId 未设置',
        });
      }
    } else if (!nodeById.has(this.rootNodeId)) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'root-missing',
        message: `rootNodeId 指向不存在的节点：${this.rootNodeId}`,
        nodeIds: [this.rootNodeId],
      });
    } else if (!roots.includes(this.rootNodeId)) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'root-not-source',
        message: `rootNodeId 指向的节点不是入度为 0 的根：${this.rootNodeId}`,
        nodeIds: [this.rootNodeId],
      });
    }

    if (this.rootNodeId !== null && nodeById.has(this.rootNodeId)) {
      const reachable = this.collectReachable(this.rootNodeId, adjacency);
      const unreachable = this.nodes
        .filter((node) => !reachable.has(node.nodeId))
        .map((node) => node.nodeId);
      if (unreachable.length > 0) {
        diagnostics.push({
          severity: 'WARN',
          code: 'unreachable',
          message: `从 root 不可达的节点：${unreachable.join(', ')}`,
          nodeIds: unreachable,
        });
      }
    }

    const primaryWorlds = worlds.filter((world) => world.kind === ('Primary' as WorldKind));
    if (primaryWorlds.length !== 1) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'primary-count',
        message: `Primary 世界必须恰好 1 个，实际 ${primaryWorlds.length} 个`,
      });
    } else if (this.rootNodeId !== null && nodeById.has(this.rootNodeId)) {
      const rootWorldId = nodeById.get(this.rootNodeId)!.worldId;
      if (rootWorldId !== primaryWorlds[0].worldId) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'primary-root-mismatch',
          message: `root 世界 ${rootWorldId} 不等于 Primary 世界 ${primaryWorlds[0].worldId}`,
          nodeIds: [this.rootNodeId],
        });
      }
    }

    return diagnostics;
  }

  toDocument(): EventTreeDocument {
    return {
      schemaVersion: 1,
      nodes: this.nodes.map(cloneNode),
      edges: this.edges.map(cloneEdge),
      rootNodeId: this.rootNodeId,
    };
  }

  build(): EventTreeDAG {
    return {
      nodes: this.nodes.map(cloneNode),
      edges: this.edges.map(cloneEdge),
      rootNodeId: this.rootNodeId,
    };
  }

  private refreshEdgeCounter(): void {
    let max = 0;
    for (const edge of this.edges) {
      const match = /^edge-(\d+)$/.exec(edge.edgeId);
      if (match) max = Math.max(max, Number(match[1]));
    }
    this.nextEdgeNumber = max + 1;
  }

  private findCycle(
    adjacency: ReadonlyMap<string, readonly string[]>,
    nodeById: ReadonlyMap<string, EventTreeNode>,
  ): string[] | null {
    const color = new Map<string, 0 | 1 | 2>();
    const stack: string[] = [];
    let cycle: string[] | null = null;

    const visit = (nodeId: string): void => {
      if (cycle !== null) return;
      color.set(nodeId, 1);
      stack.push(nodeId);

      for (const next of adjacency.get(nodeId) ?? []) {
        if (!nodeById.has(next)) continue;
        const nextColor = color.get(next) ?? 0;
        if (nextColor === 1) {
          const start = stack.indexOf(next);
          cycle = [...stack.slice(start)];
          return;
        }
        if (nextColor === 0) visit(next);
        if (cycle !== null) return;
      }

      stack.pop();
      color.set(nodeId, 2);
    };

    for (const node of this.nodes) {
      if ((color.get(node.nodeId) ?? 0) === 0) visit(node.nodeId);
      if (cycle !== null) break;
    }
    return cycle;
  }

  private collectReachable(
    rootNodeId: string,
    adjacency: ReadonlyMap<string, readonly string[]>,
  ): Set<string> {
    const reachable = new Set<string>();
    const queue = [rootNodeId];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      for (const next of adjacency.get(nodeId) ?? []) {
        if (!reachable.has(next)) queue.push(next);
      }
    }
    return reachable;
  }
}
