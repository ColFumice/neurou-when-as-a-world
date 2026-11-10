// ============================================================
// 同步机制 · WorldCommit 世界提交接口
// 名库 v0.3 冻结名：WorldCommit、AppendedAt（感绪域冻结名）
// 本文件仅定义接口骨架，不包含任何提交、中继与业务逻辑
// ============================================================

/**
 * AppendedAt 追加时间点
 * 名库 v0.3 感绪域冻结名（EmotionWindow / AppendedAt /
 * EmotionWindowSum）。
 *
 * 占位说明：具体结构名库未冻结，暂为空接口占位；
 * 当前同步域无独立时间文件授权，故随本文件声明，
 * 是否拆分及归属待 PROTOCOL 指定。
 */
export interface AppendedAt {
  // 结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * WorldCommit 世界提交
 * 字段范围严格依据 HANDOFF-ROUND-03：ID、AppendedAt。
 */
export interface WorldCommit {
  /** 提交标识（HANDOFF 指定字段“ID”，基础类型） */
  id: string;

  /** 追加时间点，结构见 AppendedAt 占位 */
  appendedAt: AppendedAt;
}
