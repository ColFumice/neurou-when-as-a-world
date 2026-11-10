// ============================================================
// S3 痕接口 · EchoTrace 回响痕
// 名库 v0.5 冻结名：EchoTrace、TraceOrigin.Echo
// 本文件仅实现来源自动绑定，不含任何业务逻辑
// ============================================================

import type { TraceTier } from './TraceTier';
import { TraceOrigin } from './TraceOrigin';
import { Trace } from './Trace';

/**
 * EchoTrace 回响痕
 * HANDOFF-ROUND-05 指定：继承 Trace，TraceOrigin 自动设为 Echo。
 *
 * 构造签名（仅接收 TraceTier，来源固定）：
 * HANDOFF-ROUND-11 正式追认冻结。
 */
export class EchoTrace extends Trace {
  constructor(tier: TraceTier) {
    super(tier, TraceOrigin.Echo);
  }
}
