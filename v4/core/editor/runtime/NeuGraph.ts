import type { NeuModule } from './types';

export interface NeuGraphCompileResult {
  readonly order: readonly NeuModule[];
  readonly cycle: readonly string[] | null;
  readonly error: string | null;
}

/**
 * E · NEU graph：只按 outputs 建边，Kahn 拓扑排序。
 * 输入数组在 JSON 中同时持久化，执行时以 outputs 为 canonical。
 *
 * 环不再视为编译错误：NEU 事件图允许原生 feedback loop，由 runtime 以
 * 100 次硬上限执行并产生 CycleWarning。
 */
export function compileNeuGraph(modules: readonly NeuModule[]): NeuGraphCompileResult {
  const byId = new Map(modules.map((module) => [module.moduleId, module]));
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const module of modules) {
    indegree.set(module.moduleId, 0);
    adjacency.set(module.moduleId, []);
  }
  for (const module of modules) {
    for (const output of module.outputs) {
      for (const target of output.targets) {
        if (!byId.has(target.moduleId)) {
          return {
            order: [],
            cycle: null,
            error: `module ${module.moduleId} targets unknown ${target.moduleId}`,
          };
        }
        adjacency.get(module.moduleId)?.push(target.moduleId);
        indegree.set(target.moduleId, (indegree.get(target.moduleId) ?? 0) + 1);
      }
    }
  }

  const queue = modules
    .filter((module) => (indegree.get(module.moduleId) ?? 0) === 0)
    .map((module) => module.moduleId);
  const order: NeuModule[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const module = byId.get(id);
    if (!module) continue;
    order.push(module);
    for (const next of adjacency.get(id) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  if (order.length !== modules.length) {
    const ordered = new Set(order.map((module) => module.moduleId));
    const cycle = modules
      .filter((module) => !ordered.has(module.moduleId))
      .map((module) => module.moduleId);
    return {
      order: [...order, ...modules.filter((module) => cycle.includes(module.moduleId))],
      cycle,
      error: null,
    };
  }
  return { order, cycle: null, error: null };
}
