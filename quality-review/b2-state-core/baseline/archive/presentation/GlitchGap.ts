// ============================================================
// 表现层（终末回映）· GlitchGap 已删除世界缺口呈现
// 名库冻结名（ROUND-09 补充裁定）：GlitchGap、
//   GlitchGapDurationCap、WorldClearRecord（账号层）、
//   RouteSignature（路线体系）
// 关联冻结名：WallClock（epochMs）
// 常量：GLITCH_GAP_CAP_RATIO（0.1）
//
// 命名状态（均已经 HANDOFF-ROUND-11 正式追认冻结）：
// - GlitchGap 本体：ROUND-11 HANDOFF 追认冻结；
// - WorldClearRecord.worldId 字段、RouteSignature.narrativeTime
//   字段：ROUND-11 追认；
// - GlitchGapSegment（缺口段）及其字段 sourceRecordId /
//   startMs / durationMs：ROUND-11 特别优先追认冻结；
// - buildGapSegments 方法名：ROUND-11 追认。
//
// 放置说明：WorldClearRecord 属账号层、RouteSignature 属
// 路线体系，本轮未授权其独立文件，按同文件占位策略随本
// 文件声明，后续 HANDOFF 指定拆分时机。
//
// 逻辑边界：
// - 已删除世界在本地已没有 WorldInstance，仅能依据账号层
//   WorldClearRecord 中保留的叙事时间排序（PROTOCOL 裁定）；
// - 缺口总时长受 GlitchGapDurationCap 硬约束
//   （总时长 × GLITCH_GAP_CAP_RATIO）；
// - 本文件只产出缺口段的时间线描述，不包含任何画面故障 /
//   渲染实现。
// ============================================================

import { GLITCH_GAP_CAP_RATIO } from '../../constants';
import type { WallClock } from '../world/WorldInstance';

/**
 * RouteSignature 路线签名（路线体系冻结名，同文件占位）
 *
 * PROTOCOL 说明：WorldClearRecord 借其保留“叙事时间”。
 */
export interface RouteSignature {
  /** 叙事时间（WallClock 口径；字段名 narrativeTime 经 ROUND-11 追认冻结） */
  narrativeTime: WallClock;
  // 路线签名其余结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * WorldClearRecord 世界通关记录（账号层冻结名，同文件占位）
 * 账号体系行（名库）：AccountMilestone、FirstWorldCleared、
 * WorldClearRecord、CopyPermission。
 */
export interface WorldClearRecord {
  /**
   * 已删除世界的标识；当前同时作为缺口段 sourceRecordId 使用。
   * 字段名 worldId 经 ROUND-11 追认冻结；如后续记录自身
   * 主键名另有冻结，再按授权修订。
   */
  worldId: string;

  /** 路线签名（含叙事时间，缺口排序依据） */
  routeSignature: RouteSignature;
  // 通关记录其余结构待 PROTOCOL / ARCHITECT 冻结
}

/**
 * GlitchGapSegment 缺口段（ROUND-11 特别优先追认冻结）
 *
 * 描述一条已删除世界记录在混剪时间线上的缺口位置；
 * 仅数据描述，不含渲染。
 */
export interface GlitchGapSegment {
  /** 来源记录标识（当前承载 WorldClearRecord.worldId） */
  sourceRecordId: string;
  /** 缺口段在混剪时间线上的起始偏移（毫秒） */
  startMs: number;
  /** 缺口段时长（毫秒），全体段总和不超过 Cap */
  durationMs: number;
}

/**
 * GlitchGap 缺口呈现
 */
export class GlitchGap {
  /**
   * 生成已删除世界在混剪中的缺口段序列
   *
   * 流程（无业务决策外溢，仅排序与上限分配）：
   * 1. 按 RouteSignature.narrativeTime 升序排列
   *    （基础时间戳比较，决定缺口出现顺序）；
   * 2. 缺口总预算 = 混剪总时长 × GLITCH_GAP_CAP_RATIO
   *    （GlitchGapDurationCap 的比例落地）；
   * 3. 预算在 N 条记录间均分，段间等间隔排布。
   *
   * 均分 / 等间隔为本轮无平衡系数下的朴素分配
   * （非 ARCHITECT 平衡结论），加权或叙事密度分配待授权。
   *
   * @param clearedRecords 已删除世界的账号层通关记录
   * @param totalDurationMs 混剪总时长（毫秒）
   */
  buildGapSegments(
    clearedRecords: ReadonlyArray<WorldClearRecord>,
    totalDurationMs: number,
  ): GlitchGapSegment[] {
    if (clearedRecords.length === 0) {
      return [];
    }

    const capMs: number = totalDurationMs * GLITCH_GAP_CAP_RATIO;

    const sorted = [...clearedRecords].sort(
      (left, right) =>
        left.routeSignature.narrativeTime.epochMs -
        right.routeSignature.narrativeTime.epochMs,
    );

    const perSegmentMs = capMs / sorted.length;

    return sorted.map((record, index) => ({
      sourceRecordId: record.worldId,
      startMs: index * perSegmentMs,
      durationMs: perSegmentMs,
    }));
  }
}
