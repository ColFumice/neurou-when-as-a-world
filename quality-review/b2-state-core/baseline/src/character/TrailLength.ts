// ============================================================
// S6 角色域 · TrailLength 逻辑拖尾长度（T3 拖尾 / AC-07）
// 名库 v1.9 冻结名：TrailLength（v0.2 颜色体系冻结名；
//                  stage-1.md §7 拖尾参数表：单位 WorldMeter，
//                  ≥0，有上限，随移动速度增加只增不减）
// 关联冻结名：MoveSpeed（character 域，速度承载类型）
//             WorldMeter（world 域，全游戏唯一距离单位）
//
// HANDOFF-ROUND-14 明示：
//   - 文件路径：src/character/TrailLength.ts（名库硬约束）
//   - 类型名：TrailLength（已冻结，行 51）
//   - 函数名：calculateTrailLength(moveSpeed: MoveSpeed): TrailLength
//     （HANDOFF 明示签名；名库未冻结函数名，列入待追认）
//
// 职责：
//   纯函数，由 MoveSpeed 推导逻辑拖尾长度（TrailLength）；
//   不读取任何渲染状态、感绪值、颜色映射（INV-6 逻辑拖尾色
//   与渲染分离；HANDOFF-14 禁感绪系统、禁颜色映射）。
//
// 规则（AC-07 / stage-1.md §7 拖尾参数表）：
//   - 随移动速度增加只增不减（单调不减函数）；
//   - 静止（速度为 0）时返回 0（拖尾收拢）。
//
// 上限口径（HANDOFF-14）：
//   - "拖尾长度上限等视觉参数放在 TrailRender 内部或
//     presentation 配置中，绝对不准放进 constants"。
//   - 本文件不定义上限常量；上限由表现侧 TrailRender
//     在显示前对 calculateTrailLength 的返回值再做视觉裁剪。
//   - 速度本身已有 MAX_MOVE_SPEED_WM_PER_SECONDS 上限
//     （constants 内登记），故本函数输出有自然边界，
//     不会发散。
//
// 边界：
//   ✗ 不引用 cc（character 是逻辑模块，stage-1.md §14 / VERDICT-094）
//   ✗ 不实现颜色映射 / 感绪系统 / 网络同步
//   ✗ 不写账本（账本追加专属 director / INV-2）
//
// 依赖矩阵（stage-1.md §6）：
//   character → constants A（MAX_MOVE_SPEED_WM_PER_SECONDS）
//   character → character 自身（MoveSpeed 同模块）
// ============================================================

import type { MoveSpeed } from './MoveSpeed';

/**
 * TrailLength 逻辑拖尾长度
 * 单位 WorldMeter（stage-1.md §7 拖尾参数表；INV-9 全游戏
 * 唯一距离单位）；取值 ≥ 0。
 *
 * 语义：由 MoveSpeed 单调不减推导的"理论拖尾长度"，不含
 * 上限裁剪（上限属表现侧视觉参数，由 TrailRender 在显示
 * 前应用）。本类型不携带任何颜色或感绪信息——逻辑拖尾色
 * 与渲染分离（INV-6）。
 */
export type TrailLength = number;

/**
 * 速度 → 拖尾长度的占位线性系数（character 域内部常量）。
 *
 * 不进 constants（HANDOFF-14 明令："拖尾长度上限等视觉参数
 * 放在 TrailRender 内部或 presentation 配置中，绝对不准
 * 放进 constants"；本系数亦属拖尾专属数值，按口径不入
 * constants）。占位取 0.8，待数值平衡阶段在 character
 * 域内部调整。
 *
 * 选择线性映射而非阶跃/分段，是为了满足 AC-07"随移动速度
 * 增加只增不减"的单调不减约束——线性映射天然单调不减。
 */
const SPEED_TO_TRAIL_FACTOR = 0.8;

/**
 * 由移动速度推导逻辑拖尾长度（AC-07；纯函数）。
 *
 * 规则（stage-1.md §7 + AC-07）：
 *   - 速度为 0（静止）时返回 0（拖尾收拢）；
 *   - 速度 > 0 时按 SPEED_TO_TRAIL_FACTOR 线性映射，单调不减；
 *   - 不在本函数做上限裁剪——上限属表现侧视觉参数
 *     （HANDOFF-14）；速度本身受 MAX_MOVE_SPEED_WM_PER_SECONDS
 *     约束，故输出有自然边界。
 *
 * 函数名 calculateTrailLength 由 HANDOFF-14 文本明示（名库
 * v1.9 未冻结此函数名，列入待追认事项）。
 *
 * @param moveSpeed 当前移动速度（WorldMeter/秒）
 * @returns 逻辑拖尾长度（WorldMeter，≥ 0）
 */
export function calculateTrailLength(moveSpeed: MoveSpeed): TrailLength {
  if (moveSpeed <= 0) {
    return 0;
  }
  return moveSpeed * SPEED_TO_TRAIL_FACTOR;
}
