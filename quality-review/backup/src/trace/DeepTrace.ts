// ============================================================
// S3 痕接口 · DeepTrace 深痕（T6 / AC-14）
// 名库 v0 冻结名：DeepTrace、Trace、TraceTier(Common / Deep /
//   Rain)、TraceOrigin(Normal / Anomalous / Echo)
// 名库 v2.3 深痕身份段：TraceTier = Deep，但触发前与普通痕无
//   视觉区别；TraceTier 不替代 ElementType
//
// 文件职责：
//   承载深痕的痕身份（层级固定 Deep，经痕基类 Trace 落地）、
//   平面坐标与触发状态。触发前与普通痕无视觉区别——本类型
//   不携带任何表现信息，表现层不显示特殊标记 / 颜色 / 轮廓 /
//   粒子（SceneBuilder 以与普通痕相同的灰盒占位色与尺寸放置）。
//
// 边界（HANDOFF-ROUND-17 任务三 3 / INV-11）：
//   ✗ 触发不修改 TraceTier（层级构造即冻结为 Deep）
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14）
//   ✗ 不写账本（链终点结算专属 director，INV-2）
//   ✗ 不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：trace → trace 自身（同模块基类
//   Trace 与枚举；ElementEntityPosition 为同模块类型导入）。
// ============================================================

import { Trace } from './Trace';
import { TraceTier } from './TraceTier';
import { TraceOrigin } from './TraceOrigin';
import type { ElementEntityPosition } from './ElementEntity';

/**
 * DeepTrace 深痕（名库 v0 冻结类型名）
 *
 * 阶段 1 承载：
 *   - 痕身份：层级固定 TraceTier.Deep（构造即冻结，不可变）；
 *   - 平面坐标（与元素实体同基准，lateral / depth）；
 *   - 触发状态（触发前 false；由 director 在链终点结算时标记）。
 *
 * 触发状态只标记"已触发"事实本身（供表现层轮询启动揭示序列
 * DeepTraceRevealSequence）；触发不修改层级、解谜进度、账本
 * 或世界运动门控（INV-11 / HANDOFF-ROUND-17 任务三 3）。
 */
export class DeepTrace extends Trace {
  /** 平面坐标（构造后不变；阶段 1 痕位置固定） */
  private readonly position: ElementEntityPosition;

  /** 触发状态（触发前 false；仅 markTriggered 置位） */
  private triggered = false;

  /**
   * @param position 深痕平面坐标（横轴 / 纵深轴，WorldMeter）
   */
  constructor(position: ElementEntityPosition) {
    // 层级固定 Deep（名库 v2.3 深痕身份段）；来源暂以 Normal
    // 占位——来源归属（TraceOrigin 语义分配）待后续任务冻结。
    super(TraceTier.Deep, TraceOrigin.Normal);
    this.position = position;
  }

  /**
   * 读取深痕平面坐标（只读；供 director 计算主角到痕的距离）。
   * 方法名 getPosition 呼应 ElementEntity.getPosition 同名模式。
   */
  getPosition(): ElementEntityPosition {
    return this.position;
  }

  /**
   * 是否已触发（只读；表现层据此轮询启动揭示序列）。
   * 方法名 isTriggered 为"触发"直译，待 PROTOCOL 追认。
   */
  isTriggered(): boolean {
    return this.triggered;
  }

  /**
   * 标记为已触发（仅由 director 在链终点结算时调用一次）。
   * 方法名 markTriggered 为"触发"直译，待 PROTOCOL 追认。
   */
  markTriggered(): void {
    this.triggered = true;
  }
}
