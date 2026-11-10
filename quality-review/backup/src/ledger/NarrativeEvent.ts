﻿﻿// ============================================================
// S4 账本域 · NarrativeEvent 叙事事件数据形状（T4 账本桩）
//
// 依据：
// - 名库 v1.6：NarrativeEvent、NarrativeDimension、
//   VectorSchemaVersion = 1、AppendedAt、
//   InputSource(Player / Autopilot)、ChapterTag、ChartRef、Ledger
// - docs/spec/stage-1.md §9（20 维顺序，只读）、AC-22
// - VERDICT-085（20 维冻结）、VERDICT-086（ledger 只依赖 constants）
//
// 职责：只声明账本记录的数据形状；不含任何向量计算
//   （球面穿越、窗口统计 T4 明令留空，本文件无任何方法体）。
//
// 同文件占位（是否拆分 / 上提 constants 待 PROTOCOL / ARCHITECT
// 指定，各声明处另有注释）：
//   NarrativeVector、AppendedAt、InputSource、ChapterTag
// ============================================================

import { NarrativeDimension, VectorSchemaVersion } from '../../constants/index';
import type { NarrativeEventId, ChartRef } from '../../constants/index';

/**
 * NarrativeVector 20 维有序叙事向量
 *
 * 存储格式（名库 v1.6 / stage-1.md §9）：按冻结顺序存为
 * 20 位有序数组；每个维度取值均为非负实数；
 * 附带 VectorSchemaVersion = 1（见 NarrativeEvent 字段）。
 *
 * 元组 20 个位置与 NarrativeDimension 枚举逐位对应：
 *   [0] NarrativeDimension.Red        [10] NarrativeDimension.Commented
 *   [1] NarrativeDimension.Green      [11] NarrativeDimension.Residue
 *   [2] NarrativeDimension.Blue       [12] NarrativeDimension.Trust
 *   [3] NarrativeDimension.Black      [13] NarrativeDimension.Closeness
 *   [4] NarrativeDimension.White      [14] NarrativeDimension.Understanding
 *   [5] NarrativeDimension.Grey       [15] NarrativeDimension.Conflict
 *   [6] NarrativeDimension.Initial    [16] NarrativeDimension.TruthLevel
 *   [7] NarrativeDimension.Process    [17] NarrativeDimension.NarrativeTime
 *   [8] NarrativeDimension.Trace      [18] NarrativeDimension.InfluenceRadius
 *   [9] NarrativeDimension.Highlight  [19] NarrativeDimension.PlayerEmpathy
 *
 * 访问铁律：一律 `event.vector[NarrativeDimension.X]`，
 * 禁止数字下标；本类型仅声明形状，不提供任何计算方法。
 * （类型名 NarrativeVector 与字段名 vector 已经 PROTOCOL
 * 验收轮第一部分第 3 条正式追认。）
 */
export type NarrativeVector = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * AppendedAt 写入时刻（名库 v0.5 感绪域冻结名；
 * 名库 v0.6 确认为账本附加信息，与 InputSource / ChapterTag 并列，
 * 不属于 20 维向量）。
 *
 * 结构 { epochMs: number } 与 world 域 WallClock 逐字一致
 * （WallClock 经 ROUND-08 冻结为 { epochMs: number }）。
 * VERDICT-086 矩阵禁止 ledger → world，故此处不导入 WallClock，
 * 以同结构在本文件声明：director 传入的 WallClock 经结构化
 * 类型可直接赋值。是否将 WallClock 上提 constants 统一承载，
 * 待 PROTOCOL / ARCHITECT 裁定。
 */
export interface AppendedAt {
  /** 纪元毫秒时间戳（与 WallClock.epochMs 同口径） */
  readonly epochMs: number;
}

/**
 * InputSource 输入来源（名库 v0.6 冻结取值 Player / Autopilot）。
 * 账本附加信息，不属于 20 维向量。
 */
export enum InputSource {
  /** 玩家亲自操作写入 */
  Player,
  /** 自动接管写入 */
  Autopilot,
}

/**
 * ChapterTag 章节标记（名库 v0.6 冻结名，账本附加信息，
 * 不属于 20 维向量）。
 *
 * 结构尚未冻结：空接口占位，未臆造字段。ledger 依矩阵禁止
 * 依赖 director，故此处不得直接使用 director 域 Chapter 类型；
 * 是否承载 Chapter 的标识 / 序号待 PROTOCOL / ARCHITECT 冻结。
 */
export interface ChapterTag {
  // 章节标记结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * NarrativeEvent 叙事事件（名库 v0 冻结名；T4 账本桩数据形状）
 *
 * 每条记录 = 完整 20 维有序向量（AC-22）+ 版本 +
 * 写入时刻 / 输入来源 / 章节标记 / ChartRef 四项附加信息。
 * 全字段只读：记录一经追加不可修改（INV-1）。
 */
export interface NarrativeEvent {
  /**
   * 叙事事件标识：读取接口“按 ID 查询”的键
   * （类型 constants.NarrativeEventId）；
   * 字段名 eventId 已经 PROTOCOL 验收轮第一部分第 3 条追认。
   */
  readonly eventId: NarrativeEventId;

  /**
   * 完整 20 维有序数组；访问一律使用
   * NarrativeDimension 枚举名，禁止数字下标。
   * 字段名 vector 已经 PROTOCOL 验收轮第一部分第 3 条追认。
   */
  readonly vector: NarrativeVector;

  /** 向量存储格式版本（冻结值 VectorSchemaVersion = 1） */
  readonly VectorSchemaVersion: typeof VectorSchemaVersion;

  /** 写入时刻（名库冻结附加信息，见 AppendedAt） */
  readonly AppendedAt: AppendedAt;

  /** 输入来源：Player / Autopilot（名库冻结附加信息） */
  readonly InputSource: InputSource;

  /** 章节标记（名库冻结附加信息，结构待冻结） */
  readonly ChapterTag: ChapterTag;

  /** 谱面引用（AC-20：完整演奏后写入，与得分无关） */
  readonly ChartRef: ChartRef;
}

// 维度访问示例（注释，不产生运行时代码）：
//   const red = someEvent.vector[NarrativeDimension.Red];
//   const truth = someEvent.vector[NarrativeDimension.TruthLevel];
