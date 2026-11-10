// ============================================================
// 同步机制 · Observer 观察者接口
// 名库 v0.3 冻结名：Observer（同步机制域）
// 本文件仅定义接口骨架，不包含任何同步、网络与业务逻辑
// ============================================================

/**
 * Observer 观察者
 * 字段范围依据 HANDOFF-ROUND-03：账号 ID 等。
 * 同步行为相关名称（ObserverSync / ObserverLayer /
 * ObserverSyncChannel 等）待后续轮次授权后定义。
 */
export interface Observer {
  /** 账号 ID（HANDOFF 指定字段“账号ID”的直译结构名，基础类型） */
  accountId: string;

  // 其余字段（“等”）待 PROTOCOL / ARCHITECT 后续冻结
}
