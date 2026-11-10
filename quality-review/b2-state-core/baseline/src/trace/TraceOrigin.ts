// ============================================================
// S3 痕接口 · TraceOrigin 枚举
// 名库 v0.5 冻结名：TraceOrigin(Normal / Anomalous / Echo)
// 本文件仅定义枚举，不包含任何实现与业务逻辑
// ============================================================

/**
 * TraceOrigin 痕来源
 * 冻结取值：Normal（常现）/ Anomalous（异现）/ Echo（回响，v0.5 扩展）
 */
export enum TraceOrigin {
  Normal,
  Anomalous,
  Echo,
}
