// ============================================================
// S3 痕接口 · PuzzleProgress 解谜链进度（T6 / AC-13）
// 名库冻结名：PuzzleProgress（名库 v0 事件域；v2.3 解谜链段
//   明示"两步链……→ PuzzleProgress 推进"）
//
// 文件职责：
//   承载解谜链进度的状态字段（记录当前阶段），并提供阶段
//   推进入口。阶段推进只发生在本对象，不写账本（HANDOFF-
//   ROUND-17：解谜链进度只更新 PuzzleProgress，不写账本）。
//
// 同文件占位：PuzzleChainStage 阶段类型。阶段取值来自
//   HANDOFF-ROUND-17 / AC-13 中文描述的直译（第一步 / 待敲击 /
//   到达终点），非名库逐字冻结名，待 PROTOCOL 追认；是否拆分
//   为独立文件待 PROTOCOL 指定。
//
// 边界：
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14）
//   ✗ 不写账本（链终点结算专属 director，INV-2）
//   ✗ 不含链规则（规则归 PuzzleChain，本文件只承载状态）
// ============================================================

/**
 * PuzzleChainStage 解谜链阶段（直译结构名，待 PROTOCOL 追认）
 *
 * 三阶段与 AC-13 条文一一对应：
 *   - 'Step1'：第一步进行中（主角移动接近 + 屏幕投影进入敲击区）；
 *   - 'AwaitingStrike'：待敲击（第一步条件成立后推进至此；
 *     敲击超出窗口时保留本阶段，允许重试）；
 *   - 'Completed'：到达终点（第二步 RhythmStrike 命中后推进；
 *     终点结算由 director 恰好写入一条 NarrativeEvent）。
 */
export type PuzzleChainStage = 'Step1' | 'AwaitingStrike' | 'Completed';

/**
 * PuzzleProgress 解谜链进度（名库 v0 / v2.3 冻结类型名）
 *
 * 状态字段 currentStage 记录当前阶段（HANDOFF-ROUND-17：
 * "PuzzleProgress：状态字段，记录当前阶段"；字段名为直译，
 * 待 PROTOCOL 追认）。初始为第一步。
 */
export class PuzzleProgress {
  /** 当前阶段（初始第一步；只经 applyStage 推进） */
  private currentStage: PuzzleChainStage = 'Step1';

  /**
   * 读取当前阶段（只读；AC-13 要求第一步形成可观察的进度
   * 阶段，表现层经本方法读取后展示）。
   * 方法名 getStage 为"记录当前阶段"直译，待 PROTOCOL 追认。
   */
  getStage(): PuzzleChainStage {
    return this.currentStage;
  }

  /**
   * 应用一次阶段推进 / 退回（仅由同模块 PuzzleChain 调用）。
   * 方法名 applyStage 呼应 ElementEntity.applyVisibility 同域
   * 应用模式，为直译，待 PROTOCOL 追认。
   *
   * @param next 目标阶段
   */
  applyStage(next: PuzzleChainStage): void {
    this.currentStage = next;
  }
}
