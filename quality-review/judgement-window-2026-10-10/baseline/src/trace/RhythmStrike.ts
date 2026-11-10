// ============================================================
// S3 痕接口 · RhythmStrike 节奏敲击（T6 / AC-12）
// 名库 v2.3 冻结名：RhythmStrike（trace 模块）、
//                  RHYTHM_STRIKE_WINDOW_MS = 50（constants）
//
// 文件职责：
//   声明"一次具有成功 / 失败判定的敲击"的数据形状，并提供
//   唯一的判定纯函数：输入敲击时间戳与目标节拍时间戳，
//   输出 boolean（绝对偏差 ≤ RHYTHM_STRIKE_WINDOW_MS）。
//
// 边界（HANDOFF-ROUND-17 禁止事项）：
//   ✗ 不引用 cc（逻辑模块，stage-1.md §14）
//   ✗ 不写账本（解谜链终点结算专属 director，INV-2）
//   ✗ 不播放 / 不改动背景音乐（音量归 TraceProximityVolume，
//     节拍与播放速度归表现层音频，判定窗口不因音量改变）
//   ✗ 不实现向量计算 / 网络同步 / 颜色映射 / 雨模式
//
// 依赖矩阵（stage-1.md §6）：trace → constants A
// ============================================================

import { RHYTHM_STRIKE_WINDOW_MS } from '../../constants/index';

/**
 * RhythmStrike 节奏敲击（名库 v2.3 冻结类型名）
 *
 * "一次具有成功 / 失败判定的敲击"：只承载判定所需的时间戳对
 * （HANDOFF-ROUND-17 明示"输入为敲击时间戳与目标节拍时间戳"），
 * 判定结果由 judgeRhythmStrike 推导，不在数据形状内缓存。
 * 字段名 strikeTimeMs / targetBeatTimeMs 为 HANDOFF 中文描述
 * 直译，待 PROTOCOL 追认。
 */
export interface RhythmStrike {
  /** 敲击时间戳（毫秒；阶段 1 来自表现层占位 BGM 播放时钟） */
  readonly strikeTimeMs: number;
  /** 目标节拍时间戳（毫秒；阶段 1 来自表现层占位节拍网格） */
  readonly targetBeatTimeMs: number;
}

/**
 * 节奏敲击判定（AC-12：判定窗口为目标拍点前后各 50ms）。
 *
 * 绝对偏差 |敲击时间戳 - 目标节拍时间戳| ≤
 * RHYTHM_STRIKE_WINDOW_MS（名库 v2.3 冻结取值 50）判为命中。
 * 纯函数；函数名 judgeRhythmStrike 为"判定"直译，待 PROTOCOL 追认。
 *
 * @param strikeTimeMs 敲击时间戳（毫秒）
 * @param targetBeatTimeMs 目标节拍时间戳（毫秒）
 * @returns 是否命中（成功 / 失败判定结果）
 */
export function judgeRhythmStrike(
  strikeTimeMs: number,
  targetBeatTimeMs: number,
): boolean {
  return (
    Math.abs(strikeTimeMs - targetBeatTimeMs) <= RHYTHM_STRIKE_WINDOW_MS
  );
}
