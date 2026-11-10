// ============================================================
// S3 痕接口 · VisibilityTransition 可见性转换（T5 / AC-11）
// 名库 v0.1 冻结名：状态转换 Trigger / Recall / CacheWarm / Forget
// 文件路径：src/trace/VisibilityTransition.ts（HANDOFF-ROUND-16 明示）
//
// 职责：
//   - 声明 VisibilityTransition 转换类型与转换原因枚举；
//   - 提供纯函数 applyTransition(entity, transition)：
//       Concealed → Revealed（Trigger / Recall / CacheWarm）
//       Revealed → Concealed（Forget）
//     相同状态下重复转换幂等。
//
// 阶段 1 占位口径（AC-11）：
//   仅 Trigger（主角靠近实体触发，阶段 4 由解谜链规则细化）
//   与 Forget（移出屏幕 / 远离后暂忘回到形态）有消费点；
//   Recall / CacheWarm 随枚举完整保留，阶段 1 无消费点。
//
// 纯函数：不修改入参实体，返回新的 ElementEntity；
// 不引用 cc；不写账本（可见性是运行时状态，不是账本数据）。
// ============================================================

import { ElementEntity } from './ElementEntity';
import { VisibilityState } from './VisibilityState';

/**
 * VisibilityTransitionReason 可见性转换原因
 * （枚举名为 HANDOFF-ROUND-16 中文描述"原因枚举"的直译，
 *   四个枚举值为名库 v0.1 逐字冻结）。
 */
export enum VisibilityTransitionReason {
  /** 触发：触发条件满足（阶段 1 占位为主角靠近） */
  Trigger,
  /** 回忆：回忆导致显形（阶段 1 无消费点） */
  Recall,
  /** 缓存预热：预热导致显形（阶段 1 无消费点） */
  CacheWarm,
  /** 暂忘：移出屏幕 / 远离后回到形态 */
  Forget,
}

/**
 * VisibilityTransition 可见性转换
 * 仅携带转换原因；目标状态由原因派生：
 *   Forget → Concealed；其余 → Revealed。
 */
export interface VisibilityTransition {
  /** 转换原因（名库 v0.1 冻结四值） */
  readonly reason: VisibilityTransitionReason;
}

/**
 * 应用可见性转换（AC-11；纯函数）。
 *
 * 规则：
 *   - Forget → Concealed（Revealed → Concealed）；
 *   - Trigger / Recall / CacheWarm → Revealed
 *     （Concealed → Revealed）；
 *   - 实体元素类型与坐标不变，仅 visibilityState 改变；
 *   - 相同状态下重复转换幂等（Revealed + Trigger 仍 Revealed）。
 *
 * 函数名 applyTransition 为 HANDOFF-ROUND-16 文本明示。
 *
 * @param entity 转换前实体（不被修改）
 * @param transition 转换请求（携带原因）
 * @returns 转换后的新实体
 */
export function applyTransition(
  entity: ElementEntity,
  transition: VisibilityTransition,
): ElementEntity {
  const nextState: VisibilityState =
    transition.reason === VisibilityTransitionReason.Forget
      ? VisibilityState.Concealed
      : VisibilityState.Revealed;

  const position = entity.getPosition();
  return new ElementEntity({
    elementType: entity.getElementType(),
    visibilityState: nextState,
    lateral: position.lateral,
    depth: position.depth,
  });
}
