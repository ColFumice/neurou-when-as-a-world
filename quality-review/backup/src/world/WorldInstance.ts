// ============================================================
// 世界域 · WorldInstance 接口
// 名库冻结名：WorldInstance、WorldKind(Primary / Shore)、
//            FormatTime、LinkState(Bound / Orphaned)、
//            WallClock、WorldThemeColor（ROUND-08 解冻）
// 本文件仅定义接口与枚举骨架，不包含任何实现与业务逻辑
// ============================================================

/**
 * WorldKind 世界种类
 * 名库冻结取值：Primary / Shore
 *
 * 占位说明：枚举暂随本文件同文件声明；
 * 是否拆分为独立 WorldKind.ts 待 PROTOCOL 指定。
 */
export enum WorldKind {
  Primary,
  Shore,
}

/**
 * WallClock 挂钟时刻（时间体系冻结名）
 * HANDOFF-ROUND-08 统一定义：epochMs 毫秒级纪元时间戳。
 * 全局时间结构以此为唯一定义；需要秒级口径时由消费方
 * 在边界处换算（epochMs / 1000）。
 */
export interface WallClock {
  /** 纪元毫秒时间戳（ROUND-08 裁定字段名） */
  epochMs: number;
}

/**
 * FormatTime 格式化时间
 * 名库时间体系冻结名（WallClock / FormatTime）
 *
 * 占位说明：具体结构名库未冻结，暂为空接口占位；
 * 是否拆分为独立文件待 PROTOCOL 指定。
 */
export interface FormatTime {
  // 结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * WorldThemeColor 世界主题色
 * HANDOFF-ROUND-08 裁定：WorldInstance.themeColor 的颜色
 * 类型统一命名为 WorldThemeColor（自 ROUND-02 阻塞解除）。
 *
 * 占位说明：颜色结构（是否 RGB 等）名库尚未冻结，
 * 暂为空接口占位；TrailColor 为痕迹拖尾颜色，语义不符，
 * 不挪用；是否拆分独立文件待 PROTOCOL 指定。
 */
export interface WorldThemeColor {
  // 主题色结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * LinkState 世界链接状态
 * 名库冻结取值：Bound（已绑定）/ Orphaned（已孤立）
 * 彼岸的引用与孤立逻辑（WorldLink 弱引用）。
 *
 * 占位说明：枚举随本文件同文件声明；
 * 是否拆分为独立文件待 PROTOCOL 指定。
 */
export enum LinkState {
  Bound,
  Orphaned,
}

/**
 * WorldInstance 世界实例
 * 字段范围依据 HANDOFF-ROUND-02 / ROUND-03 及 ROUND-08 解冻：
 * id / kind / formatTime / themeColor
 */
export interface WorldInstance {
  /** 实例标识（HANDOFF 指定字段，基础类型） */
  id: string;

  /** 世界种类，取值域见 WorldKind */
  kind: WorldKind;

  /** 格式化时间，结构见 FormatTime 占位 */
  formatTime: FormatTime;

  /** 世界主题色（ROUND-08 解冻：冻结类型 WorldThemeColor） */
  themeColor: WorldThemeColor;
}
