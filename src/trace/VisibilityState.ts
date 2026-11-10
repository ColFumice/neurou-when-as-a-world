// ============================================================
// S3 痕接口 · VisibilityState 可见性状态枚举（T5 / AC-10 / AC-11）
// 名库 v0.1 冻结名：VisibilityState(Revealed / Concealed)
// 文件路径：src/trace/VisibilityState.ts（HANDOFF-ROUND-16 明示）
//
// 语义（名库 v0.1 可见性域）：
//   Revealed  明态：实体在当前感知模式下可见；
//   Concealed 形态：实体被隐藏，仅在 Triggered 感知模式下
//                   才可被表现层呈现（AC-10）。
//
// 状态转换原因见 VisibilityTransition.ts：
//   Trigger / Recall / CacheWarm → Revealed；
//   Forget → Concealed。
//
// 本文件仅定义枚举，不含任何业务逻辑；trace 是逻辑模块，
// 不引用 cc（stage-1.md §14 / VERDICT-094）。
// ============================================================

/**
 * VisibilityState 可见性状态
 * 冻结取值：Revealed（明态）/ Concealed（形态）。
 */
export enum VisibilityState {
  /** 明态：可见 */
  Revealed,
  /** 形态：隐藏，Triggered 感知模式下才可呈现 */
  Concealed,
}
