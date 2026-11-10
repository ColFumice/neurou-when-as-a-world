// ============================================================
// 谱面域 · ChartReplay 重放 / ReplayEntry 条目类型
// 名库冻结名：ChartReplay、ReplayEntry、VectorEntry、ChartRef
// 名库 v1.1 废止：FileEntry、FinalBossFile（作为谱面文件的含义）
//   —— 最终魔王曲的重玩只通过 VectorEntry（选中终末彼岸
//      事件空间中的向量）进入
// 本文件仅定义类型骨架，不包含任何重放业务逻辑
// ============================================================

/**
 * ChartReplay 谱面重放
 * HANDOFF-ROUND-05 未列举其字段与方法，名库亦未冻结
 * 内部结构，故保持空接口占位。
 *
 * 说明：v0.5 冻结名 ChartSnapshot 本轮未授权建文件，
 * 故未提供 getSnapshot 类签名，待后续 HANDOFF 授权。
 */
export interface ChartReplay {
  // 重放字段与方法待 PROTOCOL / ARCHITECT 冻结
}

/**
 * ChartRef 谱面引用
 * 谱面域冻结名，随本文件同文件声明（是否拆分待 PROTOCOL
 * 指定）。
 *
 * 现状说明：ChartRef 原随已废止的 FileEntry 作为文件载荷；
 * v1.1 废止 FileEntry 后，本类型当前无消费点，因属独立
 * 冻结名而保留占位，归属与用途以后续 HANDOFF 为准
 * （ChartSnapshot / ChartScore 的个人层迁移见 ROUND-10）。
 */
export interface ChartRef {
  // 引用结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * VectorEntry 向量条目
 * 名库 v1.1：最终魔王曲重玩的唯一进入形态
 * （选中终末彼岸事件空间中的向量）。
 *
 * 字段 vector 为冻结名 VectorEntry 中“Vector”的直译；
 * 维度是否等于 LedgerPosition 的 20 维待 PROTOCOL 裁定，
 * 当前仅以 number[] 承载，不写维度约束。
 */
export interface VectorEntry {
  /** 条目向量（维度归属待裁定） */
  vector: number[];
}

/**
 * ReplayEntry 重放条目
 *
 * 历史：曾为 VectorEntry | FileEntry 联合；FileEntry 已随
 * 名库 v1.1 废止并从本文件移除，重玩只通过 VectorEntry。
 * 保留类型别名（而非直接 everywhere 写 VectorEntry）以维持
 * 冻结名 ReplayEntry 的单一引用点；后续条目形态扩展时
 * 在 PROTOCOL 授权下恢复联合。
 */
export type ReplayEntry = VectorEntry;
