// ============================================================
// S3 痕接口 · Trace 痕基类
// 名库 v0.5 冻结名：Trace、TraceTier、TraceOrigin
// 本文件实现构造函数骨架（接收层级与来源），
// 不含任何账本、事件图等业务逻辑
// ============================================================

import type { TraceTier } from './TraceTier';
import type { TraceOrigin } from './TraceOrigin';

/**
 * Trace 痕
 * HANDOFF-ROUND-05 指定：构造函数接收 TraceTier 与 TraceOrigin。
 */
export class Trace {
  constructor(
    readonly tier: TraceTier,
    readonly origin: TraceOrigin,
  ) {}
}
